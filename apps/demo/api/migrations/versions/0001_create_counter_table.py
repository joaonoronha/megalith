"""create counter table

Revision ID: 0001_create_counter_table
Revises:
Create Date: 2026-10-10 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0001_create_counter_table"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "counter",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("value", sa.Integer(), nullable=False, server_default="0"),
    )
    # Seed initial counter record (id=1, value=0)
    op.execute("INSERT INTO counter (id, value) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;")


def downgrade() -> None:
    op.drop_table("counter")
