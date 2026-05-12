from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional


def resolve_symbol(symbol: str) -> str:
    """台灣股票 (純數字) 自動加上 .TW 後綴 (for yfinance fallback)"""
    s = symbol.strip().upper()
    if s.isdigit():
        return f"{s}.TW"
    return s


def _twstock_code(symbol: str) -> str:
    """取純股票代號給 twstock (去掉 .TW)"""
    s = symbol.strip().upper()
    return s[:-3] if s.endswith(".TW") else s


def _fetch_twstock_map(symbol: str) -> dict:
    """用 twstock 抓近期資料，回傳 {date_str: {close,open,high,low,volume,name}}"""
    import twstock
    code = _twstock_code(symbol)
    s = twstock.Stock(code)
    result: dict = {}
    for i, d in enumerate(s.date):
        ds = d.strftime("%Y-%m-%d")
        result[ds] = {
            "close": s.price[i],
            "open": s.open[i],
            "high": s.high[i],
            "low": s.low[i],
            "volume": s.capacity[i] if hasattr(s, "capacity") else None,
            "name": getattr(twstock.codes.get(code), "name", "") or "",
        }
    return result


@dataclass
class MarketSnapshot:
    symbol: str
    stock_name: Optional[str] = None
    analysis_price: Optional[float] = None
    open_price: Optional[float] = None
    high_price: Optional[float] = None
    low_price: Optional[float] = None
    volume: Optional[int] = None
    data_status: str = "UNKNOWN"
    data_source_note: Optional[str] = None
    fetched_at: Optional[datetime] = None
    actual_date: Optional[date] = None


def _fetch_snapshot_sync(symbol: str, target_date: date) -> MarketSnapshot:
    snap = MarketSnapshot(symbol=symbol, fetched_at=datetime.utcnow())

    # ── twstock ──────────────────────────────────────────────────────────────
    try:
        data = _fetch_twstock_map(symbol)
        if data:
            # 找 <= target_date 的最近交易日
            valid = sorted(ds for ds in data if ds <= target_date.isoformat())
            if valid:
                closest_str = valid[-1]
                row = data[closest_str]
                snap.stock_name = row["name"] or None
                snap.analysis_price = row["close"]
                snap.open_price = row["open"]
                snap.high_price = row["high"]
                snap.low_price = row["low"]
                snap.volume = row["volume"]
                snap.actual_date = date.fromisoformat(closest_str)
                if closest_str < target_date.isoformat():
                    snap.data_status = "PARTIAL"
                    snap.data_source_note = f"使用最近交易日 {closest_str} 的收盤價"
                else:
                    snap.data_status = "SUCCESS"
                return snap
    except Exception as e:
        snap.data_source_note = f"twstock 錯誤: {e}"

    # ── yfinance fallback ─────────────────────────────────────────────────────
    try:
        import yfinance as yf
        resolved = resolve_symbol(symbol)
        ticker = yf.Ticker(resolved)
        try:
            info = ticker.fast_info
            snap.stock_name = getattr(info, "display_name", None) or getattr(info, "long_name", None)
        except Exception:
            pass
        start = target_date - timedelta(days=7)
        end = target_date + timedelta(days=2)
        hist = ticker.history(start=start.isoformat(), end=end.isoformat(), auto_adjust=True)
        if not hist.empty:
            hist.index = hist.index.normalize()
            valid = [d for d in hist.index if d.date() <= target_date]
            if valid:
                closest = max(valid)
                row = hist.loc[closest]
                snap.analysis_price = float(row["Close"])
                snap.open_price = float(row["Open"])
                snap.high_price = float(row["High"])
                snap.low_price = float(row["Low"])
                snap.volume = int(row["Volume"]) if row["Volume"] else None
                snap.actual_date = closest.date()
                if closest.date() < target_date:
                    snap.data_status = "PARTIAL"
                    snap.data_source_note = f"使用最近交易日 {closest.date()} 的收盤價"
                else:
                    snap.data_status = "SUCCESS"
                return snap
    except Exception as e:
        pass

    snap.data_status = "FAILED"
    if not snap.data_source_note:
        snap.data_source_note = "twstock 及 yfinance 均無法取得資料"
    return snap


async def fetch_market_data(symbol: str, target_date: Optional[date] = None) -> MarketSnapshot:
    if target_date is None:
        target_date = date.today()
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch_snapshot_sync, symbol, target_date)


def _fetch_review_price_sync(symbol: str, review_date: date) -> tuple[Optional[float], date, str]:
    # ── twstock ──────────────────────────────────────────────────────────────
    try:
        data = _fetch_twstock_map(symbol)
        if data:
            valid = sorted(ds for ds in data if ds >= review_date.isoformat())
            if valid:
                actual_str = valid[0]
                price = data[actual_str]["close"]
                actual = date.fromisoformat(actual_str)
                note = "SUCCESS" if actual == review_date else f"一週後為非交易日，使用 {actual_str} 的收盤價"
                return price, actual, note
    except Exception:
        pass

    # ── yfinance fallback ─────────────────────────────────────────────────────
    try:
        import yfinance as yf
        resolved = resolve_symbol(symbol)
        ticker = yf.Ticker(resolved)
        end = review_date + timedelta(days=10)
        hist = ticker.history(start=review_date.isoformat(), end=end.isoformat(), auto_adjust=True)
        if not hist.empty:
            hist.index = hist.index.normalize()
            valid = [d for d in hist.index if d.date() >= review_date]
            if valid:
                actual = min(valid).date()
                row = hist.loc[min(valid)]
                price = float(row["Close"])
                note = "SUCCESS" if actual == review_date else f"一週後為非交易日，使用 {actual} 的收盤價"
                return price, actual, note
    except Exception:
        pass

    return None, review_date, "twstock 及 yfinance 均無法取得一週後資料"


async def fetch_review_price(symbol: str, review_date: date) -> tuple[Optional[float], date, str]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch_review_price_sync, symbol, review_date)


def _fetch_nth_trading_day_sync(
    symbol: str, analysis_date: date, n: int = 5
) -> tuple[Optional[float], Optional[date], str]:
    """用真實市場資料找第 n 個交易日（跳過假日），不依賴週曆法"""
    look_end = analysis_date + timedelta(days=n + 14)

    # twstock
    try:
        data = _fetch_twstock_map(symbol)
        if data:
            valid = sorted(d for d in data if d > analysis_date.isoformat())
            if len(valid) >= n:
                actual_str = valid[n - 1]
                actual = date.fromisoformat(actual_str)
                return data[actual_str]["close"], actual, "SUCCESS"
    except Exception:
        pass

    # yfinance fallback
    try:
        import yfinance as yf
        resolved = resolve_symbol(symbol)
        ticker = yf.Ticker(resolved)
        hist = ticker.history(
            start=(analysis_date + timedelta(days=1)).isoformat(),
            end=look_end.isoformat(),
            auto_adjust=True,
        )
        if not hist.empty:
            hist.index = hist.index.normalize()
            valid = sorted(d.date() for d in hist.index if d.date() > analysis_date)
            if len(valid) >= n:
                actual = valid[n - 1]
                matching = [d for d in hist.index if d.date() == actual]
                if matching:
                    row = hist.loc[matching[0]]
                    return float(row["Close"]), actual, "SUCCESS"
    except Exception:
        pass

    return None, None, "無法取得第 N 個交易日資料"


async def fetch_nth_trading_day(
    symbol: str, analysis_date: date, n: int = 5
) -> tuple[Optional[float], Optional[date], str]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch_nth_trading_day_sync, symbol, analysis_date, n)


def _fetch_elapsed_trading_days_sync(symbol: str, analysis_date: date) -> Optional[int]:
    """計算分析日後已結束的實際交易日數（不含分析當天及今天）"""
    today = date.today()

    # twstock（資料本身只含交易日，直接計數）
    try:
        data = _fetch_twstock_map(symbol)
        if data:
            return sum(
                1 for d in data
                if analysis_date.isoformat() < d < today.isoformat()
            )
    except Exception:
        pass

    # yfinance fallback（history 也只含交易日）
    try:
        import yfinance as yf
        resolved = resolve_symbol(symbol)
        ticker = yf.Ticker(resolved)
        hist = ticker.history(
            start=(analysis_date + timedelta(days=1)).isoformat(),
            end=today.isoformat(),
            auto_adjust=True,
        )
        if not hist.empty:
            return len(hist)
    except Exception:
        pass

    return None


async def fetch_elapsed_trading_days(symbol: str, analysis_date: date) -> Optional[int]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch_elapsed_trading_days_sync, symbol, analysis_date)


def _fetch_latest_price_sync(symbol: str) -> Optional[float]:
    # ── twstock ──────────────────────────────────────────────────────────────
    try:
        data = _fetch_twstock_map(symbol)
        if data:
            latest_str = max(data.keys())
            return data[latest_str]["close"]
    except Exception:
        pass

    # ── yfinance fallback ─────────────────────────────────────────────────────
    try:
        import yfinance as yf
        resolved = resolve_symbol(symbol)
        ticker = yf.Ticker(resolved)
        hist = ticker.history(period="5d", auto_adjust=True)
        if not hist.empty:
            return float(hist["Close"].iloc[-1])
    except Exception:
        pass

    return None


async def fetch_latest_price(symbol: str) -> Optional[float]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch_latest_price_sync, symbol)
