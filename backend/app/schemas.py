from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class AnalysisCreate(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=20)
    analysis_date: Optional[date] = None
    direction: Optional[str] = "BULLISH"
    notes: Optional[str] = None
    tags: Optional[List[str]] = []
    target_price: Optional[Decimal] = None
    stop_loss_price: Optional[Decimal] = None


class AnalysisUpdate(BaseModel):
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    target_price: Optional[Decimal] = None
    stop_loss_price: Optional[Decimal] = None
    status: Optional[str] = None
    review_price: Optional[Decimal] = None


class AnalysisResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        alias_generator=to_camel,
    )

    id: str
    symbol: str
    stock_name: Optional[str] = None
    analysis_date: date
    direction: str
    notes: Optional[str] = None
    tags: List[str] = []
    target_price: Optional[Decimal] = None
    stop_loss_price: Optional[Decimal] = None
    status: str

    analysis_price: Optional[Decimal] = None
    open_price: Optional[Decimal] = None
    high_price: Optional[Decimal] = None
    low_price: Optional[Decimal] = None
    volume: Optional[int] = None
    data_fetched_at: Optional[datetime] = None
    data_status: str = "UNKNOWN"
    data_source_note: Optional[str] = None

    review_date: Optional[date] = None
    review_price: Optional[Decimal] = None
    review_actual_date: Optional[date] = None
    week_return: Optional[Decimal] = None
    is_success: Optional[bool] = None

    elapsed_trading_days: Optional[int] = None

    latest_price: Optional[Decimal] = None
    latest_price_at: Optional[datetime] = None
    latest_return: Optional[Decimal] = None

    created_at: datetime
    updated_at: datetime
