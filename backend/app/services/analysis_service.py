from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional


def calculate_return(analysis_price: Decimal, compare_price: Decimal) -> Decimal:
    """報酬率 = (比較價格 - 分析價格) / 分析價格 * 100，保留 4 位小數"""
    if analysis_price == 0:
        return Decimal("0")
    raw = (compare_price - analysis_price) / analysis_price * Decimal("100")
    return raw.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def determine_success(
    direction: str,
    analysis_price: Decimal,
    review_price: Decimal,
    threshold: Optional[Decimal] = None,
) -> bool:
    """
    判定五個交易日後是否成功。
    看多：五個交易日後 > 分析當天 (可設定報酬門檻)
    看空：五個交易日後 < 分析當天 (可設定報酬門檻)
    相同 → 失敗
    """
    if analysis_price == review_price:
        return False

    week_return = calculate_return(analysis_price, review_price)

    if direction == "BULLISH":
        if threshold is not None:
            return week_return >= threshold
        return review_price > analysis_price
    else:  # BEARISH
        if threshold is not None:
            return week_return <= -threshold
        return review_price < analysis_price


# ── 台灣股市公休日（每年依 TWSE 公告更新，農曆節日為估算值） ────────────────
TAIWAN_MARKET_HOLIDAYS: frozenset[date] = frozenset({
    # 2026 固定國定假日
    date(2026, 1, 1),    # 元旦
    date(2026, 2, 28),   # 和平紀念日
    date(2026, 4, 4),    # 兒童節（含清明）
    date(2026, 5, 1),    # 勞動節
    date(2026, 10, 10),  # 國慶日
    # 2026 農曆節日（依 TWSE 公告估算，請自行核對）
    date(2026, 2, 16),   # 農曆除夕
    date(2026, 2, 17),   # 春節初一
    date(2026, 2, 18),   # 春節初二
    date(2026, 2, 19),   # 春節初三
    date(2026, 2, 20),   # 春節初四
    date(2026, 6, 19),   # 端午節
    date(2026, 9, 24),   # 中秋節
})


def _is_trading_day(d: date) -> bool:
    """週一至週五且非公休日"""
    return d.weekday() < 5 and d not in TAIWAN_MARKET_HOLIDAYS


def get_review_date(analysis_date: date) -> date:
    """五個交易日後檢視日（跳過週末與台灣市場公休日）"""
    trading_days = 0
    current = analysis_date
    while trading_days < 5:
        current += timedelta(days=1)
        if _is_trading_day(current):
            trading_days += 1
    return current


def should_be_ready_to_review(analysis_date: date, today: Optional[date] = None) -> bool:
    """是否已到達五個交易日後檢視時間"""
    if today is None:
        today = date.today()
    return today >= get_review_date(analysis_date)


def days_until_review(analysis_date: date, today: Optional[date] = None) -> int:
    """距離五個交易日檢視還有幾天 (負數代表已過期)"""
    if today is None:
        today = date.today()
    return (get_review_date(analysis_date) - today).days


_TAIWAN_TZ = timezone(timedelta(hours=8))
_REVIEW_CUTOFF_HOUR = 18  # 台灣時間 18:00 後才允許取結算價


def is_past_review_cutoff(review_date: date) -> bool:
    """結算日當天必須過 18:00（台灣時間）才可取結算價；結算日已過則不限"""
    now_tw = datetime.now(_TAIWAN_TZ)
    today_tw = now_tw.date()
    if today_tw > review_date:
        return True
    if today_tw == review_date and now_tw.hour >= _REVIEW_CUTOFF_HOUR:
        return True
    return False


def days_since_analysis(analysis_date: date, today: Optional[date] = None) -> int:
    """從分析日到現在經過幾天"""
    if today is None:
        today = date.today()
    return (today - analysis_date).days
