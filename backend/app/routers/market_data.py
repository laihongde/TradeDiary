from __future__ import annotations

import asyncio
from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..services.market_data_service import fetch_market_data, fetch_latest_price, resolve_symbol

router = APIRouter()


def _fetch_candles_sync(symbol: str, days: int) -> list[dict]:
    import twstock
    from datetime import datetime, timedelta

    code = symbol.strip().upper()
    if code.endswith(".TW"):
        code = code[:-3]

    # twstock 預設只抓當月資料；需要跨月時要用 fetch()
    s = twstock.Stock(code)

    # 若資料不足，往前多抓一個月
    if len(s.date) < days and s.date:
        oldest = s.date[0]
        prev = oldest - timedelta(days=32)
        s.fetch(prev.year, prev.month)

    rows = []
    for i, d in enumerate(s.date):
        rows.append({
            "time": d.strftime("%Y-%m-%d"),
            "open": s.open[i],
            "high": s.high[i],
            "low": s.low[i],
            "close": s.price[i],
            "volume": s.capacity[i] if hasattr(s, "capacity") else 0,
        })

    # 只回傳最近 days 筆，按時間排序
    rows.sort(key=lambda r: r["time"])
    return rows[-days:]


@router.get("/quote/{symbol}")
async def get_quote(symbol: str, target_date: Optional[date] = None):
    """取得股票即時或歷史報價"""
    snap = await fetch_market_data(symbol, target_date)
    return {
        "symbol": symbol.upper(),
        "resolved_symbol": resolve_symbol(symbol),
        "stock_name": snap.stock_name,
        "price": snap.analysis_price,
        "open": snap.open_price,
        "high": snap.high_price,
        "low": snap.low_price,
        "volume": snap.volume,
        "actual_date": snap.actual_date.isoformat() if snap.actual_date else None,
        "data_status": snap.data_status,
        "note": snap.data_source_note,
        "fetched_at": snap.fetched_at.isoformat() if snap.fetched_at else None,
    }


@router.get("/latest/{symbol}")
async def get_latest(symbol: str):
    """取得股票最新收盤價"""
    price = await fetch_latest_price(symbol)
    if price is None:
        raise HTTPException(422, f"無法取得 {symbol} 的最新價格")
    return {"symbol": symbol.upper(), "price": price}


@router.get("/candles/{symbol}")
async def get_candles(symbol: str, days: int = Query(30, ge=10, le=120)):
    """取得 K 線資料 (OHLCV)，預設近 60 根日 K"""
    loop = asyncio.get_event_loop()
    rows = await loop.run_in_executor(None, _fetch_candles_sync, symbol, days)
    if not rows:
        raise HTTPException(422, f"無法取得 {symbol} 的 K 線資料")
    return {"symbol": symbol.upper(), "candles": rows}
