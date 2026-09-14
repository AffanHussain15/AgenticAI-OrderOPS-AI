"""The order triage workflow, as a LangGraph StateGraph.

Shape of the graph (every branch below is a conditional edge):

    START -> entry -+-> fraud_check -+-> hold_for_audit -> END
                    |                +-> inventory_check
                    |
                    +-> inventory_check -+-> fulfill -> END
                    |                    +-> negotiate -+-> await_customer -> END
                    |                                   +-> refund -> END
                    +-> apply_customer_decision -+-> fulfill_alternative -> END
                                                 +-> refund -> END

Durable state lives in Postgres, not in a graph checkpointer. Each human pause
(`hold_for_audit`, `await_customer`) ends the run; the admin-approval and
customer-response endpoints re-enter at `entry` with a different `phase`, and
the router dispatches to the right node. That re-entry is the cycle the BRD
asks for, and it survives a process restart because the order row -- not an
in-memory checkpoint -- is the source of truth.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional, TypedDict

from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph
from sqlalchemy.orm import Session

from .models import Item, NegotiationOffer, Order, OrderEvent
from .notifications import OfferMessage, get_notifier

logger = logging.getLogger("orderops.graph")

DISCOUNT_PERCENT = 15.0
HIGH_VALUE_THRESHOLD = 500.0
HIGH_QUANTITY_THRESHOLD = 5

# Re-entry points. `intake` is a brand new order; the other two resume a run
# that paused on a human.
PHASE_INTAKE = "intake"
PHASE_POST_AUDIT = "post_audit"
PHASE_CUSTOMER_RESPONSE = "customer_response"


class OrderState(TypedDict, total=False):
    order_id: int
    phase: str
    customer_accepted: Optional[bool]
    risk_score: Optional[str]
    in_stock: Optional[bool]
    offer_made: Optional[bool]
    alternative_available: Optional[bool]
    status: str


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _db(config: RunnableConfig) -> Session:
    return config["configurable"]["db"]


def _order(db: Session, state: OrderState) -> Order:
    return db.query(Order).filter(Order.id == state["order_id"]).one()


def _record(db: Session, order: Order, step: str, result: str) -> None:
    db.add(OrderEvent(order_id=order.id, step=step, result=result, at=_utcnow()))


def find_alternative(db: Session, item: Item, quantity: int) -> Optional[Item]:
    """Best substitute for an out-of-stock item.

    Only items that can cover the whole quantity are eligible, and the closest
    price to the original wins (cheaper breaks a tie) -- picking the first row
    would answer an out-of-stock $55 keyboard with a $30 mouse.
    """
    candidates = (
        db.query(Item)
        .filter(
            Item.category == item.category,
            Item.id != item.id,
            Item.stock >= quantity,
        )
        .all()
    )
    if not candidates:
        return None
    return min(candidates, key=lambda c: (abs(c.price - item.price), c.price))


def _take_stock(db: Session, item_id: int, quantity: int) -> bool:
    """Decrement stock under a row lock. False if it cannot be covered.

    The lock closes the window where two concurrent orders both pass the
    availability check and oversell the same units.
    """
    locked = db.query(Item).filter(Item.id == item_id).with_for_update().one()
    if locked.stock < quantity:
        return False
    locked.stock -= quantity
    return True


# ── Nodes ──────────────────────────────────────────────────────────────────


def entry(state: OrderState, config: RunnableConfig) -> dict:
    """Dispatch marker: the work happens in the conditional edge below."""
    return {}


def fraud_check(state: OrderState, config: RunnableConfig) -> dict:
    db = _db(config)
    order = _order(db, state)
    value = order.unit_price * order.quantity
    risk = (
        "high"
        if value > HIGH_VALUE_THRESHOLD or order.quantity > HIGH_QUANTITY_THRESHOLD
        else "low"
    )
    order.risk_score = risk
    _record(db, order, "fraud_check", risk)
    return {"risk_score": risk}


def hold_for_audit(state: OrderState, config: RunnableConfig) -> dict:
    db = _db(config)
    order = _order(db, state)
    order.status = "flagged_for_audit"
    return {"status": order.status}


def inventory_check(state: OrderState, config: RunnableConfig) -> dict:
    db = _db(config)
    order = _order(db, state)
    item = db.query(Item).filter(Item.id == order.item_id).one()
    in_stock = item.stock >= order.quantity
    _record(db, order, "inventory_check", "in_stock" if in_stock else "out_of_stock")
    return {"in_stock": in_stock}


def negotiate(state: OrderState, config: RunnableConfig) -> dict:
    db = _db(config)
    order = _order(db, state)
    item = db.query(Item).filter(Item.id == order.item_id).one()
    alternative = find_alternative(db, item, order.quantity)

    if alternative is None:
        _record(db, order, "refund", "no_alternative_available")
        return {"offer_made": False}

    discounted = round(alternative.price * (1 - DISCOUNT_PERCENT / 100), 2)
    channel = get_notifier().send(
        OfferMessage(
            customer_name=order.customer_name,
            original_item=item.name,
            alternative_item=alternative.name,
            quantity=order.quantity,
            original_price=alternative.price,
            discounted_price=discounted,
            discount_percent=DISCOUNT_PERCENT,
            email=order.customer_email,
            phone=order.customer_phone,
        )
    )

    db.add(
        NegotiationOffer(
            order_id=order.id,
            alternative_item_id=alternative.id,
            discount_percent=DISCOUNT_PERCENT,
            discounted_price=discounted,
            channel=channel,
            sent_at=_utcnow(),
        )
    )
    _record(db, order, "negotiation_offer_sent", alternative.name)
    return {"offer_made": True}


def await_customer(state: OrderState, config: RunnableConfig) -> dict:
    db = _db(config)
    order = _order(db, state)
    order.status = "awaiting_customer_response"
    return {"status": order.status}


def apply_customer_decision(state: OrderState, config: RunnableConfig) -> dict:
    db = _db(config)
    order = _order(db, state)
    accepted = bool(state.get("customer_accepted"))
    offer = order.negotiation_offer

    offer.accepted = accepted
    offer.responded_at = _utcnow()
    _record(db, order, "customer_response", "accepted" if accepted else "declined")

    if not accepted:
        return {"alternative_available": False}

    # The substitute was in stock when the offer went out; it may have sold out
    # while the customer was deciding, so re-validate before committing to it.
    alternative = (
        db.query(Item).filter(Item.id == offer.alternative_item_id).with_for_update().one()
    )
    available = alternative.stock >= order.quantity
    if not available:
        _record(db, order, "refund", "alternative_sold_out_before_acceptance")
    return {"alternative_available": available}


def fulfill(state: OrderState, config: RunnableConfig) -> dict:
    db = _db(config)
    order = _order(db, state)
    if not _take_stock(db, order.item_id, order.quantity):
        # Lost a race against a concurrent order between check and commit.
        _record(db, order, "refund", "stock_taken_by_concurrent_order")
        order.status = "refunded"
        order.resolved_at = _utcnow()
        return {"status": order.status}
    order.status = "fulfilled"
    order.resolved_at = _utcnow()
    _record(db, order, "fulfilled", "released_to_warehouse")
    return {"status": order.status}


def fulfill_alternative(state: OrderState, config: RunnableConfig) -> dict:
    db = _db(config)
    order = _order(db, state)
    offer = order.negotiation_offer
    if not _take_stock(db, offer.alternative_item_id, order.quantity):
        _record(db, order, "refund", "alternative_sold_out_before_acceptance")
        order.status = "refunded"
        order.resolved_at = _utcnow()
        return {"status": order.status}

    order.original_item_id = order.item_id
    order.item_id = offer.alternative_item_id
    order.unit_price = offer.discounted_price
    order.status = "fulfilled_with_alternative"
    order.resolved_at = _utcnow()
    _record(db, order, "fulfilled_with_alternative", "revenue_recovered")
    return {"status": order.status}


def refund(state: OrderState, config: RunnableConfig) -> dict:
    db = _db(config)
    order = _order(db, state)
    order.status = "refunded"
    order.resolved_at = _utcnow()
    return {"status": order.status}


# ── Conditional edges ──────────────────────────────────────────────────────


def route_entry(state: OrderState) -> str:
    phase = state.get("phase", PHASE_INTAKE)
    if phase == PHASE_POST_AUDIT:
        return "inventory_check"
    if phase == PHASE_CUSTOMER_RESPONSE:
        return "apply_customer_decision"
    return "fraud_check"


def route_fraud(state: OrderState) -> str:
    return "hold_for_audit" if state.get("risk_score") == "high" else "inventory_check"


def route_inventory(state: OrderState) -> str:
    return "fulfill" if state.get("in_stock") else "negotiate"


def route_negotiation(state: OrderState) -> str:
    return "await_customer" if state.get("offer_made") else "refund"


def route_customer_decision(state: OrderState) -> str:
    return "fulfill_alternative" if state.get("alternative_available") else "refund"


def build_graph():
    g = StateGraph(OrderState)

    g.add_node("entry", entry)
    g.add_node("fraud_check", fraud_check)
    g.add_node("hold_for_audit", hold_for_audit)
    g.add_node("inventory_check", inventory_check)
    g.add_node("negotiate", negotiate)
    g.add_node("await_customer", await_customer)
    g.add_node("apply_customer_decision", apply_customer_decision)
    g.add_node("fulfill", fulfill)
    g.add_node("fulfill_alternative", fulfill_alternative)
    g.add_node("refund", refund)

    g.add_edge(START, "entry")
    g.add_conditional_edges(
        "entry",
        route_entry,
        ["fraud_check", "inventory_check", "apply_customer_decision"],
    )
    g.add_conditional_edges("fraud_check", route_fraud, ["hold_for_audit", "inventory_check"])
    g.add_conditional_edges("inventory_check", route_inventory, ["fulfill", "negotiate"])
    g.add_conditional_edges("negotiate", route_negotiation, ["await_customer", "refund"])
    g.add_conditional_edges(
        "apply_customer_decision",
        route_customer_decision,
        ["fulfill_alternative", "refund"],
    )

    for terminal in (
        "hold_for_audit",
        "await_customer",
        "fulfill",
        "fulfill_alternative",
        "refund",
    ):
        g.add_edge(terminal, END)

    return g.compile()


ORDER_GRAPH = build_graph()
