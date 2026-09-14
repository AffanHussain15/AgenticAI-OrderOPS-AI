from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    ForeignKey,
    DateTime,
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

    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)

    # "low" or "high" — set by the fraud-check step
    risk_score = Column(String, nullable=False, default="low")

    # processing | flagged_for_audit | fulfilled | awaiting_customer_response
    # | fulfilled_with_alternative | refunded
    status = Column(String, nullable=False, default="processing")

    created_at = Column(DateTime(timezone=True), default=utcnow)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    item = relationship("Item", foreign_keys=[item_id])
    negotiation_offer = relationship(
        "NegotiationOffer", back_populates="order", uselist=False, cascade="all, delete-orphan"
    )
    history = relationship(
        "OrderEvent", back_populates="order", cascade="all, delete-orphan", order_by="OrderEvent.at"
    )


class NegotiationOffer(Base):
    __tablename__ = "negotiation_offers"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, unique=True)
    alternative_item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    discount_percent = Column(Float, nullable=False, default=15.0)
    discounted_price = Column(Float, nullable=False)

    order = relationship("Order", back_populates="negotiation_offer")
    alternative_item = relationship("Item", foreign_keys=[alternative_item_id])


class OrderEvent(Base):
    """Audit trail of each workflow step the order passed through."""

    __tablename__ = "order_events"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    step = Column(String, nullable=False)
    result = Column(String, nullable=False)
    at = Column(DateTime(timezone=True), default=utcnow)

    order = relationship("Order", back_populates="history")
