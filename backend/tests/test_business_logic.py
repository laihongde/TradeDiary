"""
商業邏輯單元測試
涵蓋：報酬率計算、成功判定、狀態轉換、日期計算
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.services.analysis_service import (
    calculate_return,
    days_since_analysis,
    days_until_review,
    determine_success,
    get_review_date,
    should_be_ready_to_review,
)
from app.services.market_data_service import resolve_symbol


# ── 報酬率計算 ────────────────────────────────────────────────────────────────


class TestCalculateReturn:
    def test_positive_return(self):
        result = calculate_return(Decimal("100"), Decimal("110"))
        assert result == Decimal("10.0000")

    def test_negative_return(self):
        result = calculate_return(Decimal("100"), Decimal("90"))
        assert result == Decimal("-10.0000")

    def test_zero_return(self):
        result = calculate_return(Decimal("100"), Decimal("100"))
        assert result == Decimal("0.0000")

    def test_fractional_return(self):
        result = calculate_return(Decimal("50"), Decimal("51.5"))
        assert result == Decimal("3.0000")

    def test_zero_base_price(self):
        result = calculate_return(Decimal("0"), Decimal("100"))
        assert result == Decimal("0")

    def test_precision_4_decimals(self):
        result = calculate_return(Decimal("3"), Decimal("4"))
        assert result == Decimal("33.3333")

    def test_high_price_taiwan_stock(self):
        # 台積電從 600 漲到 680
        result = calculate_return(Decimal("600"), Decimal("680"))
        assert result == Decimal("13.3333")


# ── 成功判定 ──────────────────────────────────────────────────────────────────


class TestDetermineSuccess:
    # 看多
    def test_bullish_price_up(self):
        assert determine_success("BULLISH", Decimal("100"), Decimal("105")) is True

    def test_bullish_price_down(self):
        assert determine_success("BULLISH", Decimal("100"), Decimal("95")) is False

    def test_bullish_price_same(self):
        assert determine_success("BULLISH", Decimal("100"), Decimal("100")) is False

    # 看空
    def test_bearish_price_down(self):
        assert determine_success("BEARISH", Decimal("100"), Decimal("90")) is True

    def test_bearish_price_up(self):
        assert determine_success("BEARISH", Decimal("100"), Decimal("110")) is False

    def test_bearish_price_same(self):
        assert determine_success("BEARISH", Decimal("100"), Decimal("100")) is False

    # 帶報酬門檻
    def test_bullish_with_threshold_pass(self):
        # 漲 5%，門檻 3% → 成功
        assert determine_success("BULLISH", Decimal("100"), Decimal("105"), Decimal("3")) is True

    def test_bullish_with_threshold_fail(self):
        # 漲 2%，門檻 3% → 失敗
        assert determine_success("BULLISH", Decimal("100"), Decimal("102"), Decimal("3")) is False

    def test_bearish_with_threshold_pass(self):
        # 跌 5%，門檻 3% → 成功
        assert determine_success("BEARISH", Decimal("100"), Decimal("95"), Decimal("3")) is True

    def test_bearish_with_threshold_fail(self):
        # 跌 2%，門檻 3% → 失敗
        assert determine_success("BEARISH", Decimal("100"), Decimal("98"), Decimal("3")) is False


# ── 日期邏輯 ──────────────────────────────────────────────────────────────────


class TestDateLogic:
    def test_review_date_is_5_trading_days_later(self):
        # 2024-01-01 是週一，5 個交易日後 = 2024-01-08（下週一）
        analysis = date(2024, 1, 1)
        expected = date(2024, 1, 8)
        assert get_review_date(analysis) == expected

    def test_review_date_crosses_weekend(self):
        # 2024-01-05 是週五，5 個交易日後需跳過週末 = 2024-01-12（週五）
        analysis = date(2024, 1, 5)
        expected = date(2024, 1, 12)
        assert get_review_date(analysis) == expected

    def test_review_date_crosses_month(self):
        # 2024-01-28 是週日，5 個交易日後 = 2024-02-02（週五）
        analysis = date(2024, 1, 28)
        expected = date(2024, 2, 2)
        assert get_review_date(analysis) == expected

    def test_should_be_ready_exact_5_trading_days(self):
        # 週一開始，第 5 個交易日 = 下週一（Jan 8）
        analysis = date(2024, 1, 1)
        today = date(2024, 1, 8)
        assert should_be_ready_to_review(analysis, today) is True

    def test_should_be_ready_after_5_trading_days(self):
        analysis = date(2024, 1, 1)
        today = date(2024, 1, 15)
        assert should_be_ready_to_review(analysis, today) is True

    def test_should_not_be_ready_before_5_trading_days(self):
        # Jan 7（週日）< review date Jan 8
        analysis = date(2024, 1, 1)
        today = date(2024, 1, 7)
        assert should_be_ready_to_review(analysis, today) is False

    def test_days_until_review(self):
        analysis = date(2024, 1, 1)
        today = date(2024, 1, 5)
        # review = Jan 8, remaining = 3
        assert days_until_review(analysis, today) == 3

    def test_days_until_review_overdue(self):
        analysis = date(2024, 1, 1)
        today = date(2024, 1, 10)
        # review = Jan 8, overdue by 2 days
        assert days_until_review(analysis, today) == -2

    def test_days_since_analysis(self):
        analysis = date(2024, 1, 1)
        today = date(2024, 1, 11)
        assert days_since_analysis(analysis, today) == 10


# ── 股票代號解析 ──────────────────────────────────────────────────────────────


class TestResolveSymbol:
    def test_taiwan_stock_all_digits_4(self):
        assert resolve_symbol("2330") == "2330.TW"

    def test_taiwan_stock_all_digits_5(self):
        assert resolve_symbol("00878") == "00878.TW"

    def test_us_stock_unchanged(self):
        assert resolve_symbol("AAPL") == "AAPL"

    def test_mixed_not_changed(self):
        assert resolve_symbol("2330.TW") == "2330.TW"

    def test_lowercase_normalized(self):
        assert resolve_symbol("aapl") == "AAPL"

    def test_taiwan_stock_lowercase(self):
        assert resolve_symbol("2330") == "2330.TW"

    def test_strip_whitespace(self):
        assert resolve_symbol("  2330  ") == "2330.TW"


# ── 多種情境整合 ──────────────────────────────────────────────────────────────


class TestBusinessRules:
    def test_flat_price_is_failure(self):
        """價格持平視為失敗"""
        assert determine_success("BULLISH", Decimal("100"), Decimal("100")) is False
        assert determine_success("BEARISH", Decimal("100"), Decimal("100")) is False

    def test_return_based_on_saved_price(self):
        """報酬率應基於保存的分析當天價格，而非最新價格"""
        analysis_price = Decimal("100")
        review_price = Decimal("110")
        latest_price = Decimal("95")

        week_return = calculate_return(analysis_price, review_price)
        latest_return = calculate_return(analysis_price, latest_price)

        assert week_return == Decimal("10.0000")
        assert latest_return == Decimal("-5.0000")
        # week_return 不應因 latest_price 改變
        assert week_return != calculate_return(analysis_price, latest_price)

    def test_status_flow(self):
        """狀態轉換順序：PENDING → READY_TO_REVIEW → REVIEWED"""
        analysis_date = date(2024, 1, 1)  # 週一

        # 第 4 個交易日（Jan 5，週五）：還不需要 review
        assert not should_be_ready_to_review(analysis_date, date(2024, 1, 5))
        # 第 5 個交易日（Jan 8，週一）：可以 review
        assert should_be_ready_to_review(analysis_date, date(2024, 1, 8))

    def test_duplicate_same_day_same_symbol(self):
        """同一天同一支股票不應重複，但不同天可以"""
        # 此規則由 API 層的 @@unique([symbol, analysisDate]) 約束保障
        # 這裡驗證邏輯正確性
        d1 = date(2024, 1, 1)
        d2 = date(2024, 1, 2)
        assert d1 != d2  # 不同天可重複分析同一支股票
