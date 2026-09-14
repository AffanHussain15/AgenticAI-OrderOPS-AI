import logging
import os
import time

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from .database import get_db
from .graph import (
    ORDER_GRAPH,
    _utcnow,
    PHASE_CUSTOMER_RESPONSE,
    PHASE_INTAKE,
    PHASE_POST_AUDIT,
)
from .models import Item, Order, OrderEvent
from .schemas import (
    CustomerResponse,
    ItemOut,
    MetricsOut,
    OrderCreate,
    OrderOut,
)

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="OrderOps AI",
    description="Autonomous order triage and resolution agent.",
    version="1.0.0",
)

# Comma-separated list so the deployed frontend origin can be added without a
# code change.
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

STARTED_AT = time.time()

# Statuses that mean the pipeline has stopped at a human, with the phase the
# graph must resume from.
RESUMABLE = {
    "flagged_for_audit": PHASE_POST_AUDIT,
    "awaiting_customer_response": PHASE_CUSTOMER_RESPONSE,
}


def _run_graph(db: Session, order: Order, phase: str, **state) -> Order:
    """Run the workflow and persist whatever it decided, as one transaction."""
    started = time.perf_counter()
    try:
        ORDER_GRAPH.invoke(
            {"order_id": order.id, "phase": phase, **state},
            config={"configurable": {"db": db}},
        )
        elapsed = (time.perf_counter() - started) * 1000
        order.processing_ms = round((order.processing_ms or 0.0) + elapsed, 2)
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(order)
    return order


def _get_order(db: Session, order_id: int) -> Order:
    order = db.query(Order).filter(Order.id == order_id).first()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    return {
        "status": "ok" if db_ok else "degraded",
        "database": "up" if db_ok else "down",
        "uptime_seconds": round(time.time() - STARTED_AT, 1),
    }


@app.get("/items", response_model=list[ItemOut])
def list_items(db: Session = Depends(get_db)):
    return db.query(Item).order_by(Item.id).all()


@app.get("/orders", response_model=list[OrderOut])
def list_orders(db: Session = Depends(get_db)):
    return db.query(Order).order_by(Order.created_at.desc()).all()


@app.get("/orders/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    return _get_order(db, order_id)


@app.post("/orders", response_model=OrderOut, status_code=201)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    """Intake: persist the order, then run it through the triage graph."""
    item = db.query(Item).filter(Item.id == payload.item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    order = Order(
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        customer_phone=payload.customer_phone,
        item_id=item.id,
        quantity=payload.quantity,
        unit_price=item.price,
        status="processing",
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    return _run_graph(db, order, PHASE_INTAKE)


@app.post("/orders/{order_id}/approve", response_model=OrderOut)
def approve_order(order_id: int, db: Session = Depends(get_db)):
    """Manual audit cleared a high-risk order: resume at inventory validation."""
    order = _get_order(db, order_id)
    if order.status != "flagged_for_audit":
        raise HTTPException(
            status_code=409,
            detail=f"Order is {order.status}, not awaiting manual audit",
        )
    db.add(
        OrderEvent(
            order_id=order.id,
            step="manual_audit_approved",
            result="resumed",
            at=_utcnow(),
        )
    )
    return _run_graph(db, order, PHASE_POST_AUDIT)


@app.post("/orders/{order_id}/respond", response_model=OrderOut)
def respond_to_offer(
    order_id: int, payload: CustomerResponse, db: Session = Depends(get_db)
):
    """Human-in-the-loop: the customer accepted or declined the alternative."""
    order = _get_order(db, order_id)
    if order.status != "awaiting_customer_response":
        raise HTTPException(
            status_code=409,
            detail=f"Order is {order.status}, not awaiting a customer response",
        )
    return _run_graph(
        db, order, PHASE_CUSTOMER_RESPONSE, customer_accepted=payload.accepted
    )


@app.get("/metrics", response_model=MetricsOut)
def metrics(db: Session = Depends(get_db)):
    """The three BRD success metrics, plus the counts behind them."""
    rows = db.query(Order.status, func.count(Order.id)).group_by(Order.status).all()
    by_status = {status: count for status, count in rows}
    total = sum(by_status.values())

    saved = by_status.get("fulfilled_with_alternative", 0)
    pending = by_status.get("awaiting_customer_response", 0)
    # Only orders that actually reached negotiation count as out-of-stock cases;
    # a refund with no offer had no alternative to recover.
    refunded_after_offer = (
        db.query(func.count(Order.id))
        .filter(Order.status == "refunded", Order.negotiation_offer.has())
        .scalar()
        or 0
    )
    settled = saved + refunded_after_offer
    recovery_rate = round(saved / settled * 100, 1) if settled else 0.0

    revenue_saved = (
        db.query(func.coalesce(func.sum(Order.unit_price * Order.quantity), 0.0))
        .filter(Order.status == "fulfilled_with_alternative")
        .scalar()
        or 0.0
    )
    avg_ms = (
        db.query(func.coalesce(func.avg(Order.processing_ms), 0.0))
        .filter(Order.processing_ms.isnot(None))
        .scalar()
        or 0.0
    )

    try:
        db.execute(text("SELECT 1"))
        db_healthy = True
    except Exception:
        db_healthy = False

    return MetricsOut(
        total_orders=total,
        orders_by_status=by_status,
        revenue_recovery_rate=recovery_rate,
        settled_out_of_stock_cases=settled,
        saved_by_negotiation=saved,
        pending_negotiations=pending,
        revenue_saved=round(float(revenue_saved), 2),
        avg_processing_ms=round(float(avg_ms), 2),
        uptime_seconds=round(time.time() - STARTED_AT, 1),
        db_healthy=db_healthy,
    )
