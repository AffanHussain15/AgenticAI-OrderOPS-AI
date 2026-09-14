"""Delivery of negotiation offers over email or SMS.

The BRD requires the alternative-item offer to reach the customer by email or
SMS. Real transports need credentials this project does not ship, so the
default implementation logs the message and records which channel *would* have
carried it. Swap in an SMTP or Twilio notifier by setting NOTIFIER=smtp/twilio
and implementing send(); the graph only depends on the Notifier protocol.
"""
import logging
import os
from dataclasses import dataclass
from typing import Optional, Protocol

logger = logging.getLogger("orderops.notifications")


@dataclass
class OfferMessage:
    customer_name: str
    original_item: str
    alternative_item: str
    quantity: int
    original_price: float
    discounted_price: float
    discount_percent: float
    email: Optional[str] = None
    phone: Optional[str] = None

    def channel(self) -> Optional[str]:
        """Email is preferred; SMS is the fallback when no address is held."""
        if self.email:
            return "email"
        if self.phone:
            return "sms"
        return None

    def body(self) -> str:
        return (
            f"Hi {self.customer_name}, {self.original_item} is out of stock. "
            f"We can send {self.alternative_item} instead at "
            f"{self.discount_percent:.0f}% off — "
            f"${self.original_price:.2f} to ${self.discounted_price:.2f} per unit "
            f"({self.quantity}x). Reply to accept, or we will refund you in full."
        )


class Notifier(Protocol):
    def send(self, message: OfferMessage) -> Optional[str]:
        """Deliver the offer. Returns the channel used, or None if undeliverable."""


class ConsoleNotifier:
    """Logs the offer instead of sending it. Safe default for local runs."""

    def send(self, message: OfferMessage) -> Optional[str]:
        channel = message.channel()
        if channel is None:
            logger.warning(
                "No email or phone on file for %s - offer not delivered",
                message.customer_name,
            )
            return None
        target = message.email if channel == "email" else message.phone
        logger.info("[%s -> %s] %s", channel.upper(), target, message.body())
        return channel


def get_notifier() -> Notifier:
    kind = os.getenv("NOTIFIER", "console").lower()
    if kind != "console":
        logger.warning("NOTIFIER=%s is not implemented; using console", kind)
    return ConsoleNotifier()
