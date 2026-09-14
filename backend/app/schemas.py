from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    price: float
    stock: int


class OrderCreate(BaseModel):
    customer_name: str = Field(min_length=1, max_length=120)
    item_id: int
    quantity: int = Field(gt=0, le=1000)
    # Offers go out over whichever channel is supplied; email wins if both are.
    customer_email: Optional[EmailStr] = None
    customer_phone: Optional[str] = Field(default=None, max_length=32)


class NegotiationOfferOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    alternative_item_id: int
    alternative_item_name: Optional[str] = None
    original_price: Optional[float] = None
    discount_percent: float
    discounted_price: float
    channel: Optional[str] = None
    sent_at: Optional[datetime] = None
    responded_at: Optional[datetime] = None
    accepted: Optional[bool] = None


class OrderEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    step: str
    result: str
    at: datetime


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    item_id: int
    item_name: Optional[str] = None
    original_item_id: Optional[int] = None
    original_item_name: Optional[str] = None
    quantity: int
    unit_price: float
    risk_score: str
    status: str
    processing_ms: Optional[float] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
    negotiation_offer: Optional[NegotiationOfferOut] = None
    history: list[OrderEventOut] = []


class CustomerResponse(BaseModel):
    accepted: bool


class MetricsOut(BaseModel):
    total_orders: int
    orders_by_status: dict[str, int]
    # Share of *settled* out-of-stock cases saved by negotiation. Offers still
    # awaiting a reply are excluded, not counted as failures.
    revenue_recovery_rate: float
    settled_out_of_stock_cases: int
    saved_by_negotiation: int
    pending_negotiations: int
    revenue_saved: float
    avg_processing_ms: float
    uptime_seconds: float
    db_healthy: bool
