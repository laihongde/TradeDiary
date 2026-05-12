import type { Candle } from "../types";
import {
  type CandleResult,
  type PriceProvider,
  type PriceQuery,
  type PriceRecord,
  type ProviderResult,
  isFourDigitNumeric,
  normalizeSymbol,
} from "./types";
import { addDays } from "../services/tradingDays";

const FINMIND_BASE = "https://api.finmindtrade.com/api/v4/data";
const PROVIDER_NAME = "FinMind";

interface FinMindRow {
  date: string;
  stock_id: string;
  Trading_Volume: number;
  open: number;
  max: number;
  min: number;
  close: number;
}

interface FinMindResponse {
  status?: number;
  msg?: string;
  data?: FinMindRow[];
}

async function callFinMind(params: Record<string, string>): Promise<FinMindResponse> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${FINMIND_BASE}?${qs}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as FinMindResponse;
}

function makeRecord(row: FinMindRow, requestedDate: string, isFallback: boolean): PriceRecord {
  return {
    price: row.close,
    actualDate: row.date,
    open: row.open,
    high: row.max,
    low: row.min,
    volume: row.Trading_Volume,
    source: {
      providerId: "finmind",
      providerName: PROVIDER_NAME,
      fetchedAt: new Date().toISOString(),
      actualDate: row.date,
      isFallbackSource: isFallback,
      dataSourceNote:
        row.date === requestedDate
          ? undefined
          : `請求日期 ${requestedDate} 非交易日，採用 ${row.date} 收盤價`,
    },
  };
}

export class FinMindProvider implements PriceProvider {
  readonly id = "finmind" as const;
  readonly name = PROVIDER_NAME;
  readonly supportsHistorical = true;

  // isFallback flag is supplied by dispatcher; provider doesn't know its position
  async getDailyClose(q: PriceQuery, isFallback = false): Promise<ProviderResult> {
    const sym = normalizeSymbol(q.symbol);
    if (!isFourDigitNumeric(sym)) {
      return { kind: "unsupported", reason: "FinMind 僅支援台股純數字代號" };
    }
    try {
      const resp = await callFinMind({
        dataset: "TaiwanStockPrice",
        data_id: sym,
        start_date: q.date,
        end_date: addDays(q.date, 14),
      });
      if (resp.status && resp.status !== 200) {
        return { kind: "error", reason: resp.msg || `FinMind 回傳狀態 ${resp.status}` };
      }
      const rows = (resp.data ?? []).filter((r) => r.date >= q.date && Number.isFinite(r.close));
      if (rows.length === 0) {
        return { kind: "unsupported", reason: "FinMind 查無此期間資料" };
      }
      rows.sort((a, b) => a.date.localeCompare(b.date));
      return { kind: "ok", record: makeRecord(rows[0], q.date, isFallback) };
    } catch (e) {
      return { kind: "error", reason: (e as Error).message, cause: e };
    }
  }

  async getLatest(symbol: string, isFallback = false): Promise<ProviderResult> {
    const sym = normalizeSymbol(symbol);
    if (!isFourDigitNumeric(sym)) {
      return { kind: "unsupported", reason: "FinMind 僅支援台股純數字代號" };
    }
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const start = addDays(end, -14);
    try {
      const resp = await callFinMind({
        dataset: "TaiwanStockPrice",
        data_id: sym,
        start_date: start,
        end_date: end,
      });
      const rows = resp.data ?? [];
      if (rows.length === 0) {
        return { kind: "unsupported", reason: "FinMind 查無最新資料" };
      }
      rows.sort((a, b) => b.date.localeCompare(a.date));
      return { kind: "ok", record: makeRecord(rows[0], end, isFallback) };
    } catch (e) {
      return { kind: "error", reason: (e as Error).message, cause: e };
    }
  }

  async getCandles(symbol: string, days: number): Promise<CandleResult> {
    const sym = normalizeSymbol(symbol);
    if (!isFourDigitNumeric(sym)) {
      return { kind: "unsupported", reason: "FinMind 僅支援台股純數字代號" };
    }
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const start = addDays(end, -Math.max(days, 30) * 2);
    try {
      const resp = await callFinMind({
        dataset: "TaiwanStockPrice",
        data_id: sym,
        start_date: start,
        end_date: end,
      });
      const rows = resp.data ?? [];
      if (rows.length === 0) {
        return { kind: "unsupported", reason: "FinMind 查無 K 線資料" };
      }
      rows.sort((a, b) => a.date.localeCompare(b.date));
      const candles: Candle[] = rows.slice(-days).map((r) => ({
        time: r.date,
        open: r.open,
        high: r.max,
        low: r.min,
        close: r.close,
        volume: r.Trading_Volume,
      }));
      return { kind: "ok", candles };
    } catch (e) {
      return { kind: "error", reason: (e as Error).message, cause: e };
    }
  }
}

export const finmindProvider = new FinMindProvider();
