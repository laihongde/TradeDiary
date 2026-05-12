from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from ..database import get_db
from ..enums import AnalysisStatus
from ..models import StockAnalysis

router = APIRouter()


def _win_rate(successes: int, total: int) -> Optional[float]:
    return round(successes / total * 100, 2) if total > 0 else None


def _avg(values: List[float]) -> Optional[float]:
    return round(sum(values) / len(values), 4) if values else None


def _median(values: List[float]) -> Optional[float]:
    if not values:
        return None
    s = sorted(values)
    n = len(s)
    return round(s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2, 4)


# ── 總覽 ──────────────────────────────────────────────────────────────────────


@router.get("/summary")
async def get_summary(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(StockAnalysis).where(
            StockAnalysis.status.in_([AnalysisStatus.REVIEWED, AnalysisStatus.TRACKING]),
            StockAnalysis.week_return.is_not(None),
        )
    )
    reviewed = result.scalars().all()

    total = len(reviewed)
    if total == 0:
        return {"total": 0, "success": 0, "failed": 0, "win_rate": None,
                "avg_return": None, "median_return": None, "best_return": None, "worst_return": None}

    successes = sum(1 for a in reviewed if a.is_success is True)
    returns = sorted([float(a.week_return) for a in reviewed])

    return {
        "total": total,
        "success": successes,
        "failed": total - successes,
        "win_rate": _win_rate(successes, total),
        "avg_return": _avg(returns),
        "median_return": _median(returns),
        "best_return": round(max(returns), 4),
        "worst_return": round(min(returns), 4),
    }


# ── 依時間區間 ────────────────────────────────────────────────────────────────


@router.get("/period")
async def get_period_stats(
    period: str = Query("this_month"),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    if period == "this_week":
        start, end = today - timedelta(days=today.weekday()), today
    elif period == "last_week":
        start = today - timedelta(days=today.weekday() + 7)
        end = today - timedelta(days=today.weekday() + 1)
    elif period == "this_month":
        start, end = today.replace(day=1), today
    elif period == "last_30d":
        start, end = today - timedelta(days=30), today
    elif period == "custom" and from_date and to_date:
        start, end = from_date, to_date
    else:
        start, end = today.replace(day=1), today

    result = await db.execute(
        select(StockAnalysis).where(
            StockAnalysis.analysis_date >= start,
            StockAnalysis.analysis_date <= end,
        )
    )
    all_analyses = result.scalars().all()

    completed = [a for a in all_analyses if a.week_return is not None]
    returns = [float(a.week_return) for a in completed]
    successes = sum(1 for a in completed if a.is_success is True)

    best = max(completed, key=lambda a: float(a.week_return or 0), default=None)
    worst = min(completed, key=lambda a: float(a.week_return or 0), default=None)

    return {
        "period": period,
        "from_date": start.isoformat(),
        "to_date": end.isoformat(),
        "total_analyses": len(all_analyses),
        "completed_reviews": len(completed),
        "win_rate": _win_rate(successes, len(completed)),
        "avg_return": _avg(returns),
        "best_stock": best.symbol if best else None,
        "best_return": round(float(best.week_return), 4) if best and best.week_return else None,
        "worst_stock": worst.symbol if worst else None,
        "worst_return": round(float(worst.week_return), 4) if worst and worst.week_return else None,
    }


# ── 每日紀錄 ──────────────────────────────────────────────────────────────────


@router.get("/daily")
async def get_daily_records(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    if from_date is None:
        from_date = today - timedelta(days=30)
    if to_date is None:
        to_date = today

    result = await db.execute(
        select(StockAnalysis)
        .where(
            StockAnalysis.analysis_date >= from_date,
            StockAnalysis.analysis_date <= to_date,
        )
        .order_by(StockAnalysis.analysis_date.desc())
    )
    analyses = result.scalars().all()

    daily: dict = defaultdict(list)
    for a in analyses:
        daily[a.analysis_date.isoformat()].append(a)

    return [
        {
            "date": day_str,
            "count": len(items),
            "symbols": [a.symbol for a in items],
            "completed_reviews": len([a for a in items if a.week_return is not None]),
            "win_rate": _win_rate(
                sum(1 for a in items if a.is_success is True),
                len([a for a in items if a.week_return is not None]),
            ),
            "avg_return": _avg([float(a.week_return) for a in items if a.week_return is not None]),
        }
        for day_str, items in sorted(daily.items(), reverse=True)
    ]


# ── 個股統計 ──────────────────────────────────────────────────────────────────


@router.get("/stock/{symbol}")
async def get_stock_stats(symbol: str, db: AsyncSession = Depends(get_db)):
    sym = symbol.strip().upper()
    result = await db.execute(
        select(StockAnalysis).where(StockAnalysis.symbol == sym).order_by(StockAnalysis.analysis_date.desc())
    )
    analyses = result.scalars().all()

    completed = [a for a in analyses if a.week_return is not None]
    returns = [float(a.week_return) for a in completed]
    successes = sum(1 for a in completed if a.is_success is True)

    return {
        "symbol": sym,
        "total_analyses": len(analyses),
        "completed_reviews": len(completed),
        "win_rate": _win_rate(successes, len(completed)),
        "avg_return": _avg(returns),
        "best_return": round(max(returns), 4) if returns else None,
        "worst_return": round(min(returns), 4) if returns else None,
        "analyses": [
            {
                "id": a.id,
                "analysisDate": a.analysis_date.isoformat(),
                "direction": a.direction,
                "analysisPrice": float(a.analysis_price) if a.analysis_price else None,
                "reviewPrice": float(a.review_price) if a.review_price else None,
                "weekReturn": float(a.week_return) if a.week_return else None,
                "isSuccess": a.is_success,
                "status": a.status,
            }
            for a in analyses
        ],
    }
