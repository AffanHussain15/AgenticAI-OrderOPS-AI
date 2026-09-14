from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    price: float
    stock: int


class OrderCreate(BaseModel):
    customer_name: str
    item_id: int
    quantity: int


class NegotiationOfferOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    alternative_item_id: int
    discount_percent: float
    discounted_price: float


class OrderEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    step: str
    result: str
    at: datetime


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_name: str
    item_id: int
    quantity: int
    unit_price: float
    risk_score: str
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None
    negotiation_offer: Optional[NegotiationOfferOut] = None
    history: list[OrderEventOut] = []


class CustomerResponse(BaseModel):
    accepted: bool


class MetricsOut(BaseModel):
    total_orders: int
    revenue_recovery_rate: float
    avg_processing_time_ms: float
    system_uptime_percent: float
