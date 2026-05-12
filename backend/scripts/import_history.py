"""
批次匯入歷史分析資料
使用 twstock 抓取台股歷史收盤價
"""
import sys
import os
import uuid
from datetime import date, datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import twstock
import psycopg2
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

# ── 要匯入的分析資料 ──────────────────────────────────────────────────────────
# (analysis_date, symbol, price_date)
# price_date = 取價日期 (非交易日時取上一個交易日)

ENTRIES = [
    # 4/29 當日分析
    ("2026-04-29", "3081", "2026-04-29"),
    ("2026-04-29", "6672", "2026-04-29"),
    ("2026-04-29", "8358", "2026-04-29"),
    # 5/1 非交易日，取 4/30 收盤
    ("2026-05-01", "6672", "2026-04-30"),
    ("2026-05-01", "6414", "2026-04-30"),
    ("2026-05-01", "6197", "2026-04-30"),
    # 5/4
    ("2026-05-04", "2603", "2026-05-04"),
    ("2026-05-04", "6435", "2026-05-04"),
    ("2026-05-04", "3455", "2026-05-04"),
    # 5/5
    ("2026-05-05", "2317", "2026-05-05"),
    ("2026-05-05", "8131", "2026-05-05"),
    ("2026-05-05", "2382", "2026-05-05"),
]

# ── 取得股票歷史資料 ──────────────────────────────────────────────────────────

def get_stock_data(symbol: str) -> dict:
    """使用 twstock 抓取股票近期資料，回傳 {date_str: {close, open, high, low, vol}}"""
    print(f"  Fetching {symbol}.TW via twstock...")
    try:
        s = twstock.Stock(symbol)
        result = {}
        for i, d in enumerate(s.date):
            ds = d.strftime("%Y-%m-%d")
            result[ds] = {
                "close": s.price[i],
                "open":  s.open[i],
                "high":  s.high[i],
                "low":   s.low[i],
                "volume": s.capacity[i] if hasattr(s, 'capacity') else None,
                "name":  getattr(twstock.codes.get(symbol), 'name', '') if hasattr(twstock, 'codes') else '',
            }
        print(f"    Got {len(result)} days of data")
        return result
    except Exception as e:
        print(f"    ERROR: {e}")
        return {}

# ── 連接資料庫並插入 ──────────────────────────────────────────────────────────

def parse_db_url(url: str):
    """Parse postgresql://user:pass@host:port/db"""
    url = url.replace("postgresql+asyncpg://", "postgresql://").replace("postgresql+psycopg2://", "postgresql://")
    from urllib.parse import urlparse
    p = urlparse(url)
    return dict(host=p.hostname, port=p.port or 5432, user=p.username,
                password=p.password, dbname=p.path.lstrip("/"))

def main():
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    print("=== 匯入歷史分析資料 ===\n")

    # 收集所有需要的股票代號
    symbols = list(set(sym for _, sym, _ in ENTRIES))

    # 抓取各股資料
    stock_data: dict = {}
    for sym in symbols:
        stock_data[sym] = get_stock_data(sym)

    # 連接資料庫
    conn = psycopg2.connect(**parse_db_url(db_url))
    cur = conn.cursor()

    inserted, skipped, failed = 0, 0, 0
    now = datetime.now(timezone.utc)

    for analysis_date_str, symbol, price_date_str in ENTRIES:
        analysis_date = date.fromisoformat(analysis_date_str)
        price_date = date.fromisoformat(price_date_str)

        # 檢查是否已存在
        cur.execute(
            "SELECT id FROM stock_analyses WHERE symbol=%s AND analysis_date=%s",
            (symbol, analysis_date)
        )
        if cur.fetchone():
            print(f"SKIP  {symbol} {analysis_date_str}  (已存在)")
            skipped += 1
            continue

        # 取得價格
        day_data = stock_data.get(symbol, {}).get(price_date_str)
        if not day_data:
            print(f"FAIL  {symbol} {analysis_date_str}  (找不到 {price_date_str} 的資料)")
            # 仍插入紀錄，標記 DATA_ERROR
            cur.execute("""
                INSERT INTO stock_analyses
                  (id, symbol, analysis_date, direction, tags, status, data_status,
                   data_source_note, created_at, updated_at)
                VALUES (%s,%s,%s,'BULLISH','{}','DATA_ERROR','FAILED',%s,%s,%s)
            """, (
                str(uuid.uuid4()), symbol, analysis_date,
                f"twstock 找不到 {price_date_str} 的資料", now, now
            ))
            conn.commit()
            failed += 1
            continue

        close = day_data["close"]
        note = None
        if price_date != analysis_date:
            note = f"非交易日，使用 {price_date_str} 收盤價 {close}"

        cur.execute("""
            INSERT INTO stock_analyses
              (id, symbol, stock_name, analysis_date, direction, tags, status,
               analysis_price, open_price, high_price, low_price, volume,
               data_fetched_at, data_status, data_source_note,
               created_at, updated_at)
            VALUES
              (%s,%s,%s,%s,'BULLISH','{}','PENDING',
               %s,%s,%s,%s,%s,
               %s,%s,%s,
               %s,%s)
        """, (
            str(uuid.uuid4()),
            symbol,
            day_data.get("name") or None,
            analysis_date,
            close,
            day_data.get("open"),
            day_data.get("high"),
            day_data.get("low"),
            day_data.get("volume"),
            now,
            "PARTIAL" if price_date != analysis_date else "SUCCESS",
            note,
            now, now
        ))
        conn.commit()

        status_label = "PARTIAL" if price_date != analysis_date else "OK"
        print(f"  OK [{status_label}]  {symbol} {analysis_date_str}  close={close}  {note or ''}")
        inserted += 1

    cur.close()
    conn.close()

    print(f"\n=== 完成：插入 {inserted}，跳過 {skipped}，失敗 {failed} ===")


if __name__ == "__main__":
    main()
