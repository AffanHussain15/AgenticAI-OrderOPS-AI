"""add negotiation channel/response fields and order metric columns

Revision ID: d7f4a1c9b820
Revises: c1a2b3d4e5f6
Create Date: 2026-09-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd7f4a1c9b820'
down_revision: Union[str, Sequence[str], None] = 'c1a2b3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Contact channels, the pre-swap item, and agent latency."""
    op.add_column('orders', sa.Column('customer_email', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('customer_phone', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('original_item_id', sa.Integer(), nullable=True))
    op.add_column('orders', sa.Column('processing_ms', sa.Float(), nullable=True))
    op.create_foreign_key(
        'fk_orders_original_item_id', 'orders', 'items', ['original_item_id'], ['id']
    )

    op.add_column('negotiation_offers', sa.Column('channel', sa.String(), nullable=True))
    op.add_column(
        'negotiation_offers',
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        'negotiation_offers',
        sa.Column('responded_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column('negotiation_offers', sa.Column('accepted', sa.Boolean(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('negotiation_offers', 'accepted')
    op.drop_column('negotiation_offers', 'responded_at')
    op.drop_column('negotiation_offers', 'sent_at')
    op.drop_column('negotiation_offers', 'channel')

    op.drop_constraint('fk_orders_original_item_id', 'orders', type_='foreignkey')
    op.drop_column('orders', 'processing_ms')
    op.drop_column('orders', 'original_item_id')
    op.drop_column('orders', 'customer_phone')
    op.drop_column('orders', 'customer_email')
