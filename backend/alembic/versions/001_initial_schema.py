"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-05-06
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "stock_analyses",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("symbol", sa.String(20), nullable=False),
        sa.Column("stock_name", sa.String(), nullable=True),
        sa.Column("analysis_date", sa.Date(), nullable=False),
        sa.Column("direction", sa.String(10), nullable=False, server_default="BULLISH"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("target_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("stop_loss_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        # 分析當天快照
        sa.Column("analysis_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("open_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("high_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("low_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("volume", sa.BigInteger(), nullable=True),
        sa.Column("data_fetched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("data_status", sa.String(10), nullable=False, server_default="UNKNOWN"),
        sa.Column("data_source_note", sa.Text(), nullable=True),
        # 一週後
        sa.Column("review_date", sa.Date(), nullable=True),
        sa.Column("review_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("review_actual_date", sa.Date(), nullable=True),
        sa.Column("week_return", sa.Numeric(10, 4), nullable=True),
        sa.Column("is_success", sa.Boolean(), nullable=True),
        # 最新追蹤
        sa.Column("latest_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("latest_price_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("latest_return", sa.Numeric(10, 4), nullable=True),
        # 時間戳
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("symbol", "analysis_date", name="uq_symbol_date"),
    )
    op.create_index("ix_stock_analyses_analysis_date", "stock_analyses", ["analysis_date"])
    op.create_index("ix_stock_analyses_status", "stock_analyses", ["status"])
    op.create_index("ix_stock_analyses_symbol", "stock_analyses", ["symbol"])


def downgrade() -> None:
    op.drop_index("ix_stock_analyses_symbol", table_name="stock_analyses")
    op.drop_index("ix_stock_analyses_status", table_name="stock_analyses")
    op.drop_index("ix_stock_analyses_analysis_date", table_name="stock_analyses")
    op.drop_table("stock_analyses")
