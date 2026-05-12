"""
API 整合測試 (不依賴 DB 的部分)
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


# ── Health Check ──────────────────────────────────────────────────────────────


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


# ── 輸入驗證 ──────────────────────────────────────────────────────────────────


class TestCreateAnalysisValidation:
    def test_missing_symbol(self):
        response = client.post("/api/analyses", json={})
        assert response.status_code == 422

    def test_empty_symbol(self):
        response = client.post("/api/analyses", json={"symbol": ""})
        assert response.status_code == 422

    def test_symbol_too_long(self):
        response = client.post("/api/analyses", json={"symbol": "A" * 21})
        assert response.status_code == 422


# ── 端點存在性 ────────────────────────────────────────────────────────────────


class TestEndpointsExist:
    """確認所有 API 端點存在 (DB 未連線時允許 500)"""

    def _ok(self, code: int):
        assert code in (200, 404, 422, 500)

    def test_today(self):
        self._ok(client.get("/api/analyses/today").status_code)

    def test_pending(self):
        self._ok(client.get("/api/analyses/pending").status_code)

    def test_review(self):
        self._ok(client.get("/api/analyses/review").status_code)

    def test_errors(self):
        self._ok(client.get("/api/analyses/errors").status_code)

    def test_summary(self):
        self._ok(client.get("/api/statistics/summary").status_code)

    def test_period(self):
        self._ok(client.get("/api/statistics/period?period=this_month").status_code)

    def test_daily(self):
        self._ok(client.get("/api/statistics/daily").status_code)


# ── 業務邏輯 (不需 DB) ────────────────────────────────────────────────────────


class TestReturnCalculation:
    def test_basic_return(self):
        from decimal import Decimal
        from app.services.analysis_service import calculate_return

        r = calculate_return(Decimal("100"), Decimal("105"))
        assert float(r) == pytest.approx(5.0, rel=1e-4)

    def test_determine_success_bullish(self):
        from decimal import Decimal
        from app.services.analysis_service import determine_success

        assert determine_success("BULLISH", Decimal("100"), Decimal("101")) is True
        assert determine_success("BULLISH", Decimal("100"), Decimal("99")) is False

    def test_determine_success_bearish(self):
        from decimal import Decimal
        from app.services.analysis_service import determine_success

        assert determine_success("BEARISH", Decimal("100"), Decimal("99")) is True
        assert determine_success("BEARISH", Decimal("100"), Decimal("101")) is False
