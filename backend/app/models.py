from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Integer,
    String,
    Float,
    ForeignKey,
    DateTime,
    func,
)
from sqlalchemy.orm import relationship

from .database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    stock = Column(Integer, nullable=False, default=0)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String, nullable=False)
    # The negotiation offer is delivered to whichever of these is present.
    customer_email = Column(String, nullable=True)
    customer_phone = Column(String, nullable=True)

    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    # Set when a negotiated alternative replaces the original item, so the
    # dashboard can still report what the customer first asked for.
    original_item_id = Column(Integer, ForeignKey("items.id"), nullable=True)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)

    # "low" or "high" — set by the fraud-check node
    risk_score = Column(String, nullable=False, default="low")

    # processing | flagged_for_audit | fulfilled | awaiting_customer_response
    # | fulfilled_with_alternative | refunded
    status = Column(String, nullable=False, default="processing")

    # Agent latency: intake -> fulfilment or negotiation offer sent. Kept apart
    # from resolved_at, which for a negotiated order waits on the customer and
    # so measures human time, not system time.
    processing_ms = Column(Float, nullable=True)

    created_at = Column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now()
    )
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    item = relationship("Item", foreign_keys=[item_id])
    original_item = relationship("Item", foreign_keys=[original_item_id])
    negotiation_offer = relationship(
        "NegotiationOffer", back_populates="order", uselist=False, cascade="all, delete-orphan"
    )
    history = relationship(
        "OrderEvent", back_populates="order", cascade="all, delete-orphan", order_by="OrderEvent.at"
    )

    @property
    def item_name(self) -> str | None:
        return self.item.name if self.item else None

    @property
    def original_item_name(self) -> str | None:
        return self.original_item.name if self.original_item else None


class NegotiationOffer(Base):
    __tablename__ = "negotiation_offers"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, unique=True)
    alternative_item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    discount_percent = Column(Float, nullable=False, default=15.0)
    discounted_price = Column(Float, nullable=False)

    # How the offer reached the customer, per the BRD's email/SMS requirement.
    channel = Column(String, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    responded_at = Column(DateTime(timezone=True), nullable=True)
    accepted = Column(Boolean, nullable=True)

    order = relationship("Order", back_populates="negotiation_offer")
    alternative_item = relationship("Item", foreign_keys=[alternative_item_id])

    @property
    def alternative_item_name(self) -> str | None:
        return self.alternative_item.name if self.alternative_item else None

    @property
    def original_price(self) -> float | None:
        """List price of the substitute, for the struck-through price in the UI."""
        return self.alternative_item.price if self.alternative_item else None


class OrderEvent(Base):
    """Audit trail of each workflow step the order passed through."""

    __tablename__ = "order_events"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    step = Column(String, nullable=False)
    result = Column(String, nullable=False)
    at = Column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now()
    )

    order = relationship("Order", back_populates="history")
