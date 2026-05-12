import {
  type CandleResult,
  type PriceProvider,
  type PriceQuery,
  type PriceRecord,
  type ProviderResult,
  isFourDigitNumeric,
  normalizeSymbol,
} from "./types";
import { todayInTaiwan } from "../services/tradingDays";

const STOCK_DAY_ALL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";
const STOCK_DAY = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY";
const PROVIDER_NAME = "TWSE OpenAPI";

interface StockDayAllRow {
  Code: string;
  Name: string;
  TradeVolume: string;
  OpeningPrice: string;
  HighestPrice: string;
  LowestPrice: string;
  ClosingPrice: string;
}

interface StockDayRow {
  Date: string; // 民國年/月/日，例：113/01/02
  TradeVolume: string;
  TradeValue: string;
  OpeningPrice: string;
  HighestPrice: string;
  LowestPrice: string;
  ClosingPrice: string;
  Change: string;
  Transaction: string;
}

interface StockDayResponse {
  stat?: string;
  data?: StockDayRow[];
  fields?: string[];
}

function parseNumber(s: string | undefined): number | undefined {
  if (s == null) return undefined;
  const n = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function rocDateToIso(roc: string): string | undefined {
  const parts = roc.split("/");
  if (parts.length !== 3) return undefined;
  const y = parseInt(parts[0], 10) + 1911;
  const m = parts[1].padStart(2, "0");
  const d = parts[2].padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function makeRecord(args: {
  close: number;
  actualDate: string;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  isFallback: boolean;
  note?: string;
}): PriceRecord {
  return {
    price: args.close,
    actualDate: args.actualDate,
    open: args.open,
    high: args.high,
    low: args.low,
    volume: args.volume,
    source: {
      providerId: "twse",
      providerName: PROVIDER_NAME,
      fetchedAt: new Date().toISOString(),
      actualDate: args.actualDate,
      isFallbackSource: args.isFallback,
      dataSourceNote: args.note,
    },
  };
}

async function fetchStockDayAll(): Promise<StockDayAllRow[]> {
  const res = await fetch(STOCK_DAY_ALL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as StockDayAllRow[];
}

async function fetchStockDay(symbol: string, yyyymm01: string): Promise<StockDayResponse> {
  const url = `${STOCK_DAY}?date=${yyyymm01}&stockNo=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as StockDayResponse;
}

export class TWSEProvider implements PriceProvider {
  readonly id = "twse" as const;
  readonly name = PROVIDER_NAME;
  readonly supportsHistorical = true;

  async getDailyClose(q: PriceQuery, isFallback = false): Promise<ProviderResult> {
    const sym = normalizeSymbol(q.symbol);
    if (!isFourDigitNumeric(sym)) {
      return { kind: "unsupported", reason: "TWSE 僅支援台股純數字代號" };
    }

    // 若請求日期即為今日（台灣），優先用 STOCK_DAY_ALL 的當日 snapshot
    const today = todayInTaiwan();
    if (q.date === today) {
      try {
        const all = await fetchStockDayAll();
        const row = all.find((r) => r.Code === sym);
        if (!row) return { kind: "unsupported", reason: "TWSE 今日 snapshot 找不到此代號" };
        const close = parseNumber(row.ClosingPrice);
        if (close == null) return { kind: "unsupported", reason: "TWSE 今日尚未公布收盤價" };
        return {
          kind: "ok",
          record: makeRecord({
            close,
            actualDate: today,
            open: parseNumber(row.OpeningPrice),
            high: parseNumber(row.HighestPrice),
            low: parseNumber(row.LowestPrice),
            volume: parseNumber(row.TradeVolume),
            isFallback,
          }),
        };
      } catch (e) {
        return { kind: "error", reason: (e as Error).message, cause: e };
      }
    }

    // 歷史日期：嘗試月份查詢，注意 CORS 可能擋；擋住時回 unsupported
    try {
      const yyyymm01 = q.date.replace(/-/g, "").slice(0, 6) + "01";
      const resp = await fetchStockDay(sym, yyyymm01);
      const rows = (resp.data ?? [])
        .map((r) => {
          const iso = rocDateToIso(r.Date);
          const close = parseNumber(r.ClosingPrice);
          if (!iso || close == null) return null;
          return {
            iso,
            close,
            open: parseNumber(r.OpeningPrice),
            high: parseNumber(r.HighestPrice),
            low: parseNumber(r.LowestPrice),
            volume: parseNumber(r.TradeVolume),
          };
        })
        .filter((r): r is NonNullable<typeof r> => r != null && r.iso >= q.date)
        .sort((a, b) => a.iso.localeCompare(b.iso));

      if (rows.length === 0) return { kind: "unsupported", reason: "TWSE 月份查詢無資料" };
      const r = rows[0];
      return {
        kind: "ok",
        record: makeRecord({
          close: r.close,
          actualDate: r.iso,
          open: r.open,
          high: r.high,
          low: r.low,
          volume: r.volume,
          isFallback,
          note: r.iso === q.date ? undefined : `請求日期 ${q.date} 非交易日，採用 ${r.iso} 收盤價`,
        }),
      };
    } catch (e) {
      // CORS 被擋或網路錯誤 → 對 dispatcher 而言是 unsupported（不要中斷流程）
      return {
        kind: "unsupported",
        reason: `TWSE 月份歷史查詢不可用：${(e as Error).message}`,
      };
    }
  }

  async getLatest(symbol: string, isFallback = false): Promise<ProviderResult> {
    return this.getDailyClose({ symbol, date: todayInTaiwan() }, isFallback);
  }

  async getCandles(symbol: string, days: number): Promise<CandleResult> {
    const sym = normalizeSymbol(symbol);
    if (!isFourDigitNumeric(sym)) {
      return { kind: "unsupported", reason: "TWSE 僅支援台股純數字代號" };
    }
    try {
      const today = todayInTaiwan();
      const candles: { time: string; open: number; high: number; low: number; close: number; volume: number }[] = [];
      // 嘗試抓最近兩個月，足以覆蓋 ~40-60 個交易日
      const cursor = new Date(today);
      for (let m = 0; m < 3 && candles.length < days; m++) {
        const yyyymm01 =
          `${cursor.getFullYear()}${String(cursor.getMonth() + 1).padStart(2, "0")}01`;
        const resp = await fetchStockDay(sym, yyyymm01);
        for (const r of resp.data ?? []) {
          const iso = rocDateToIso(r.Date);
          const close = parseNumber(r.ClosingPrice);
          if (!iso || close == null) continue;
          candles.push({
            time: iso,
            open: parseNumber(r.OpeningPrice) ?? close,
            high: parseNumber(r.HighestPrice) ?? close,
            low: parseNumber(r.LowestPrice) ?? close,
            close,
            volume: parseNumber(r.TradeVolume) ?? 0,
          });
        }
        cursor.setMonth(cursor.getMonth() - 1);
      }
      if (candles.length === 0) return { kind: "unsupported", reason: "TWSE 無 K 線資料" };
      candles.sort((a, b) => a.time.localeCompare(b.time));
      return { kind: "ok", candles: candles.slice(-days) };
    } catch (e) {
      return { kind: "unsupported", reason: `TWSE K 線查詢不可用：${(e as Error).message}` };
    }
  }
}

export const twseProvider = new TWSEProvider();
