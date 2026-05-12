from __future__ import annotations

import asyncio
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import AsyncSessionLocal, get_db
from ..enums import AnalysisStatus, DataStatus, Direction
from ..models import StockAnalysis
from ..schemas import AnalysisCreate, AnalysisResponse, AnalysisUpdate
from ..services.analysis_service import (
    calculate_return,
    determine_success,
    get_review_date,
    is_past_review_cutoff,
)
from ..services.market_data_service import (
    fetch_elapsed_trading_days,
    fetch_latest_price,
    fetch_market_data,
    fetch_nth_trading_day,
    fetch_review_price,
)

router = APIRouter()

_BY_ALIAS = True  # FastAPI response_model_by_alias flag


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── 查詢端點 ──────────────────────────────────────────────────────────────────


@router.get("/today", response_model=List[AnalysisResponse], response_model_by_alias=True)
async def get_today_analyses(db: AsyncSession = Depends(get_db)):
    today = date.today()
    result = await db.execute(
        select(StockAnalysis)
        .where(StockAnalysis.analysis_date == today)
        .order_by(StockAnalysis.created_at.desc())
    )
    return result.scalars().all()


@router.get("/pending", response_model=List[AnalysisResponse], response_model_by_alias=True)
async def get_pending_analyses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(StockAnalysis)
        .where(StockAnalysis.status.in_([AnalysisStatus.PENDING, AnalysisStatus.READY_TO_REVIEW]))
        .order_by(StockAnalysis.analysis_date.desc())
    )
    return result.scalars().all()


@router.get("/review", response_model=List[AnalysisResponse], response_model_by_alias=True)
async def get_review_analyses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(StockAnalysis)
        .where(StockAnalysis.status.in_([AnalysisStatus.REVIEWED, AnalysisStatus.TRACKING]))
        .order_by(StockAnalysis.analysis_date.desc())
    )
    return result.scalars().all()


@router.get("/errors", response_model=List[AnalysisResponse], response_model_by_alias=True)
async def get_error_analyses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(StockAnalysis)
        .where(StockAnalysis.status == AnalysisStatus.DATA_ERROR)
        .order_by(StockAnalysis.analysis_date.desc())
    )
    return result.scalars().all()


@router.get("/stock/{symbol}", response_model=List[AnalysisResponse], response_model_by_alias=True)
async def get_stock_history(symbol: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(StockAnalysis)
        .where(StockAnalysis.symbol == symbol.strip().upper())
        .order_by(StockAnalysis.analysis_date.desc())
    )
    return result.scalars().all()


@router.get("", response_model=List[AnalysisResponse], response_model_by_alias=True)
async def list_analyses(
    status: Optional[str] = None,
    symbol: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    success: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(StockAnalysis)
    if status:
        stmt = stmt.where(StockAnalysis.status == status.upper())
    if symbol:
        stmt = stmt.where(StockAnalysis.symbol == symbol.strip().upper())
    if from_date:
        stmt = stmt.where(StockAnalysis.analysis_date >= from_date)
    if to_date:
        stmt = stmt.where(StockAnalysis.analysis_date <= to_date)
    if success is not None:
        stmt = stmt.where(StockAnalysis.is_success == success)
    stmt = stmt.order_by(StockAnalysis.analysis_date.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{analysis_id}", response_model=AnalysisResponse, response_model_by_alias=True)
async def get_analysis(analysis_id: str, db: AsyncSession = Depends(get_db)):
    analysis = await db.get(StockAnalysis, analysis_id)
    if not analysis:
        raise HTTPException(404, "找不到該分析紀錄")
    return analysis


# ── 新增 ──────────────────────────────────────────────────────────────────────


@router.post("", response_model=AnalysisResponse, status_code=201, response_model_by_alias=True)
async def create_analysis(
    data: AnalysisCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    symbol = data.symbol.strip().upper()
    analysis_date = data.analysis_date or date.today()

    existing = await db.execute(
        select(StockAnalysis).where(
            StockAnalysis.symbol == symbol,
            StockAnalysis.analysis_date == analysis_date,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"{symbol} 在 {analysis_date} 已有分析紀錄，請勿重複新增")

    now = _now()
    analysis = StockAnalysis(
        id=str(uuid.uuid4()),
        symbol=symbol,
        analysis_date=analysis_date,
        direction=data.direction or Direction.BULLISH,
        notes=data.notes,
        tags=data.tags or [],
        target_price=data.target_price,
        stop_loss_price=data.stop_loss_price,
        status=AnalysisStatus.DATA_ERROR,
        data_status=DataStatus.UNKNOWN,
        created_at=now,
        updated_at=now,
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    background_tasks.add_task(_fetch_and_save_snapshot, analysis.id, symbol, analysis_date)
    return analysis


async def _fetch_and_save_snapshot(analysis_id: str, symbol: str, target_date: date):
    snap = await fetch_market_data(symbol, target_date)
    new_status = AnalysisStatus.PENDING if snap.data_status != "FAILED" else AnalysisStatus.DATA_ERROR

    values: dict = {
        "data_fetched_at": snap.fetched_at,
        "data_status": snap.data_status,
        "data_source_note": snap.data_source_note,
        "status": new_status,
        "updated_at": _now(),
    }
    if snap.stock_name:
        values["stock_name"] = snap.stock_name
    if snap.analysis_price is not None:
        values["analysis_price"] = snap.analysis_price
    if snap.open_price is not None:
        values["open_price"] = snap.open_price
    if snap.high_price is not None:
        values["high_price"] = snap.high_price
    if snap.low_price is not None:
        values["low_price"] = snap.low_price
    if snap.volume is not None:
        values["volume"] = snap.volume

    async with AsyncSessionLocal() as db:
        await db.execute(
            update(StockAnalysis).where(StockAnalysis.id == analysis_id).values(**values)
        )
        await db.commit()


# ── 狀態批次更新 ──────────────────────────────────────────────────────────────


@router.post("/update-statuses")
async def update_statuses(db: AsyncSession = Depends(get_db)):
    """已滿五個交易日的 PENDING 移至 READY_TO_REVIEW"""
    today = date.today()
    result = await db.execute(
        select(StockAnalysis).where(StockAnalysis.status == AnalysisStatus.PENDING)
    )
    pending = result.scalars().all()

    ids_to_update = [
        a.id for a in pending
        if is_past_review_cutoff(get_review_date(a.analysis_date))
    ]
    if not ids_to_update:
        return {"updated": 0}

    await db.execute(
        update(StockAnalysis)
        .where(StockAnalysis.id.in_(ids_to_update))
        .values(status=AnalysisStatus.READY_TO_REVIEW, updated_at=_now())
    )
    await db.commit()
    return {"updated": len(ids_to_update)}


# ── 一週後取價 ────────────────────────────────────────────────────────────────


@router.post("/{analysis_id}/fetch-review", response_model=AnalysisResponse, response_model_by_alias=True)
async def fetch_review_data(analysis_id: str, db: AsyncSession = Depends(get_db)):
    analysis = await db.get(StockAnalysis, analysis_id)
    if not analysis:
        raise HTTPException(404, "找不到該分析紀錄")
    if analysis.status not in (
        AnalysisStatus.READY_TO_REVIEW,
        AnalysisStatus.DATA_ERROR,
        AnalysisStatus.PENDING,
        AnalysisStatus.REVIEWED,  # 允許重新取結算價以修正假日偏差
    ):
        raise HTTPException(400, f"當前狀態 {analysis.status} 不支援此操作")
    if not analysis.analysis_price:
        raise HTTPException(400, "缺少分析當天價格，無法計算報酬率")

    # REVIEWED 為修正重取，不受時間限制；首次結算需等結算日 18:00 後
    if analysis.status != AnalysisStatus.REVIEWED:
        review_date_target = get_review_date(analysis.analysis_date)
        if not is_past_review_cutoff(review_date_target):
            from datetime import datetime as _dt, timezone as _tz, timedelta as _td
            now_tw = _dt.now(_tz(_td(hours=8)))
            raise HTTPException(
                400,
                f"結算日 {review_date_target} 尚未到 18:00（台灣時間，目前 {now_tw.strftime('%H:%M')}），請收盤後再取",
            )

    # 用真實市場資料找第 5 個交易日（跳過假日）
    (price, actual_date, note), elapsed = await asyncio.gather(
        fetch_nth_trading_day(analysis.symbol, analysis.analysis_date, n=5),
        fetch_elapsed_trading_days(analysis.symbol, analysis.analysis_date),
    )

    if price is None or actual_date is None:
        await db.execute(
            update(StockAnalysis)
            .where(StockAnalysis.id == analysis_id)
            .values(status=AnalysisStatus.DATA_ERROR, data_source_note=note, updated_at=_now())
        )
        await db.commit()
        raise HTTPException(422, f"結算價格取得失敗：{note}")

    a_price = Decimal(str(analysis.analysis_price))
    r_price = Decimal(str(price))
    week_ret = calculate_return(a_price, r_price)
    success = determine_success(analysis.direction, a_price, r_price)

    values: dict = dict(
        review_date=actual_date,
        review_price=r_price,
        review_actual_date=actual_date,
        week_return=week_ret,
        is_success=success,
        latest_price=r_price,
        latest_return=week_ret,
        latest_price_at=_now(),
        status=AnalysisStatus.REVIEWED,
        data_source_note=note if note != "SUCCESS" else analysis.data_source_note,
        updated_at=_now(),
    )
    if elapsed is not None:
        values["elapsed_trading_days"] = elapsed

    await db.execute(
        update(StockAnalysis).where(StockAnalysis.id == analysis_id).values(**values)
    )
    await db.commit()
    await db.refresh(analysis)
    return analysis


# ── 最新價更新 ────────────────────────────────────────────────────────────────


@router.post("/{analysis_id}/refresh-latest", response_model=AnalysisResponse, response_model_by_alias=True)
async def refresh_latest_price(analysis_id: str, db: AsyncSession = Depends(get_db)):
    analysis = await db.get(StockAnalysis, analysis_id)
    if not analysis:
        raise HTTPException(404, "找不到該分析紀錄")

    price, elapsed = await asyncio.gather(
        fetch_latest_price(analysis.symbol),
        fetch_elapsed_trading_days(analysis.symbol, analysis.analysis_date),
    )
    if price is None:
        raise HTTPException(422, "無法取得最新價格")

    latest_ret = None
    if analysis.analysis_price:
        latest_ret = calculate_return(Decimal(str(analysis.analysis_price)), Decimal(str(price)))

    values: dict = dict(
        latest_price=Decimal(str(price)),
        latest_return=latest_ret,
        latest_price_at=_now(),
        updated_at=_now(),
    )
    if elapsed is not None:
        values["elapsed_trading_days"] = elapsed

    await db.execute(
        update(StockAnalysis).where(StockAnalysis.id == analysis_id).values(**values)
    )
    await db.commit()
    await db.refresh(analysis)
    return analysis


@router.post("/refresh-all-latest")
async def refresh_all_latest(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(StockAnalysis).where(
            StockAnalysis.status.in_(
                [AnalysisStatus.PENDING, AnalysisStatus.READY_TO_REVIEW, AnalysisStatus.REVIEWED, AnalysisStatus.TRACKING]
            )
        )
    )
    analyses = result.scalars().all()

    updated, errors = 0, 0
    for a in analyses:
        price, elapsed = await asyncio.gather(
            fetch_latest_price(a.symbol),
            fetch_elapsed_trading_days(a.symbol, a.analysis_date),
        )
        if price is None:
            errors += 1
            continue
        latest_ret = None
        if a.analysis_price:
            latest_ret = calculate_return(Decimal(str(a.analysis_price)), Decimal(str(price)))
        vals: dict = dict(
            latest_price=Decimal(str(price)),
            latest_return=latest_ret,
            latest_price_at=_now(),
            updated_at=_now(),
        )
        if elapsed is not None:
            vals["elapsed_trading_days"] = elapsed
        await db.execute(
            update(StockAnalysis).where(StockAnalysis.id == a.id).values(**vals)
        )
        updated += 1

    await db.commit()
    return {"updated": updated, "errors": errors}


# ── 重試快照 ──────────────────────────────────────────────────────────────────


@router.post("/{analysis_id}/retry-snapshot", response_model=AnalysisResponse, response_model_by_alias=True)
async def retry_snapshot(
    analysis_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    analysis = await db.get(StockAnalysis, analysis_id)
    if not analysis:
        raise HTTPException(404, "找不到該分析紀錄")
    background_tasks.add_task(_fetch_and_save_snapshot, analysis.id, analysis.symbol, analysis.analysis_date)
    return analysis


# ── 更新 & 刪除 ───────────────────────────────────────────────────────────────


@router.patch("/{analysis_id}", response_model=AnalysisResponse, response_model_by_alias=True)
async def update_analysis(analysis_id: str, data: AnalysisUpdate, db: AsyncSession = Depends(get_db)):
    analysis = await db.get(StockAnalysis, analysis_id)
    if not analysis:
        raise HTTPException(404, "找不到該分析紀錄")

    values: dict = {"updated_at": _now()}
    if data.notes is not None:
        values["notes"] = data.notes
    if data.tags is not None:
        values["tags"] = data.tags
    if data.target_price is not None:
        values["target_price"] = data.target_price
    if data.stop_loss_price is not None:
        values["stop_loss_price"] = data.stop_loss_price
    if data.status is not None:
        values["status"] = data.status.upper()

    if data.review_price is not None and not analysis.review_price:
        r_price = data.review_price
        values["review_price"] = r_price
        values["review_date"] = get_review_date(analysis.analysis_date)
        if analysis.analysis_price:
            a_price = Decimal(str(analysis.analysis_price))
            values["week_return"] = calculate_return(a_price, r_price)
            values["is_success"] = determine_success(analysis.direction, a_price, r_price)
            values["status"] = AnalysisStatus.REVIEWED

    if len(values) > 1:
        await db.execute(update(StockAnalysis).where(StockAnalysis.id == analysis_id).values(**values))
        await db.commit()
        await db.refresh(analysis)

    return analysis


@router.delete("/{analysis_id}")
async def delete_analysis(analysis_id: str, db: AsyncSession = Depends(get_db)):
    analysis = await db.get(StockAnalysis, analysis_id)
    if not analysis:
        raise HTTPException(404, "找不到該分析紀錄")
    await db.execute(delete(StockAnalysis).where(StockAnalysis.id == analysis_id))
    await db.commit()
    return {"deleted": True}
