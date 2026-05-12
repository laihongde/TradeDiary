from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from .enums import AnalysisStatus, DataStatus, Direction


class Base(DeclarativeBase):
    pass


class StockAnalysis(Base):
    __tablename__ = "stock_analyses"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    stock_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    analysis_date: Mapped[date] = mapped_column(Date, nullable=False)
    direction: Mapped[Direction] = mapped_column(
        String(10), nullable=False, default=Direction.BULLISH
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[List[str]] = mapped_column(
        ARRAY(String), nullable=False, default=list, server_default="{}"
    )
    target_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    stop_loss_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    status: Mapped[AnalysisStatus] = mapped_column(
        String(20), nullable=False, default=AnalysisStatus.PENDING
    )

    # 分析當天快照 (保存後不可覆蓋)
    analysis_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    open_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    high_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    low_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    volume: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    data_fetched_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    data_status: Mapped[DataStatus] = mapped_column(
        String(10), nullable=False, default=DataStatus.UNKNOWN
    )
    data_source_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 一週後檢視 (保存後不可覆蓋)
    review_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    review_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    review_actual_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    week_return: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    is_success: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # 實際已過交易日數（每次刷新時更新）
    elapsed_trading_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # 最新追蹤 (可持續更新)
    latest_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    latest_price_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    latest_return: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("symbol", "analysis_date", name="uq_symbol_date"),
        Index("ix_stock_analyses_analysis_date", "analysis_date"),
        Index("ix_stock_analyses_status", "status"),
        Index("ix_stock_analyses_symbol", "symbol"),
    )
