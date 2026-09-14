"""add server defaults + NOT NULL to timestamp columns

Revision ID: c1a2b3d4e5f6
Revises: b5dd314387b1
Create Date: 2026-09-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c1a2b3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'b5dd314387b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Backfill any NULL timestamps, then enforce a server-side default."""
    op.execute("UPDATE orders SET created_at = now() WHERE created_at IS NULL")
    op.execute("UPDATE order_events SET at = now() WHERE at IS NULL")

    op.alter_column(
        'orders', 'created_at',
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
    op.alter_column(
        'order_events', 'at',
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        'order_events', 'at',
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
        server_default=None,
    )
    op.alter_column(
        'orders', 'created_at',
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
        server_default=None,
    )
