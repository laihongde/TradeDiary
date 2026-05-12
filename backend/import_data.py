"""一次性資料補匯入腳本 — 執行前請先 alembic upgrade head"""
import asyncio
import os
import sys
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

sys.path.insert(0, os.path.dirname(__file__))

from app.database import AsyncSessionLocal
from app.enums import AnalysisStatus, DataStatus, Direction
from app.models import StockAnalysis
from app.services.analysis_service import get_review_date, is_past_review_cutoff

# (symbol, stock_name, analysis_date, analysis_price, data_source_note, data_status)
DATA = [
    ("3081",  "聯亞",          date(2026, 4, 29), Decimal("2445.00"), None,                   DataStatus.SUCCESS),
    ("6672",  "騰輝電子-KY",   date(2026, 4, 29), Decimal("208.00"),  None,                   DataStatus.SUCCESS),
    ("8358",  "金居",          date(2026, 4, 29), Decimal("369.50"),  None,                   DataStatus.SUCCESS),
    ("6672",  "騰輝電子-KY",   date(2026, 5,  1), Decimal("219.00"),  "非交易日，取 4/30 收盤", DataStatus.PARTIAL),
    ("6414",  "樺漢",          date(2026, 5,  1), Decimal("322.00"),  "非交易日，取 4/30 收盤", DataStatus.PARTIAL),
    ("6197",  "佳必琪",        date(2026, 5,  1), Decimal("208.00"),  "非交易日，取 4/30 收盤", DataStatus.PARTIAL),
    ("2603",  "長榮",          date(2026, 5,  4), Decimal("206.00"),  None,                   DataStatus.SUCCESS),
    ("6435",  "大中",          date(2026, 5,  4), Decimal("197.00"),  None,                   DataStatus.SUCCESS),
    ("3455",  "由田",          date(2026, 5,  4), Decimal("267.00"),  None,                   DataStatus.SUCCESS),
    ("2317",  "鴻海",          date(2026, 5,  5), Decimal("239.50"),  None,                   DataStatus.SUCCESS),
    ("8131",  "福懋科",        date(2026, 5,  5), Decimal("69.00"),   None,                   DataStatus.SUCCESS),
    ("2382",  "廣達",          date(2026, 5,  5), Decimal("321.00"),  None,                   DataStatus.SUCCESS),
]


async def main() -> None:
    now = datetime.now(timezone.utc)
    added = skipped = 0

    async with AsyncSessionLocal() as db:
        for symbol, stock_name, analysis_date, price, note, data_status in DATA:
            review_date = get_review_date(analysis_date)
            status = (
                AnalysisStatus.READY_TO_REVIEW
                if is_past_review_cutoff(review_date)
                else AnalysisStatus.PENDING
            )

            record = StockAnalysis(
                id=str(uuid.uuid4()),
                symbol=symbol,
                stock_name=stock_name,
                analysis_date=analysis_date,
                direction=Direction.BULLISH,
                notes=None,
                tags=[],
                status=status,
                analysis_price=price,
                data_status=data_status,
                data_source_note=note,
                data_fetched_at=now,
                created_at=now,
                updated_at=now,
            )
            db.add(record)
            added += 1
            print(f"  + {analysis_date} {symbol} {stock_name} {price}  →  {status.value}")

        await db.commit()

    print(f"\n✓ 匯入完成：{added} 筆，略過：{skipped} 筆")


if __name__ == "__main__":
    asyncio.run(main())
