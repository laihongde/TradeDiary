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

// 上櫃日成交資訊 OpenAPI（當日 snapshot）
const TPEX_DAILY_CLOSE =
  "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes";
const PROVIDER_NAME = "TPEx OpenAPI";

interface TPExRow {
  Date: string;
  SecuritiesCompanyCode: string;
  CompanyName: string;
  Close: string;
  Change: string;
  Open: string;
  High: string;
  Low: string;
  TradingShares: string;
  TradingAmount: string;
}

function parseNumber(s: string | undefined): number | undefined {
  if (s == null || s === "----" || s === "--") return undefined;
  const n = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function rocDateToIso(roc: string): string | undefined {
  // 上櫃格式可能為 "1130102" 或 "113/01/02"
  let parts: string[];
  if (roc.includes("/")) {
    parts = roc.split("/");
  } else if (/^\d{7}$/.test(roc)) {
    parts = [roc.slice(0, 3), roc.slice(3, 5), roc.slice(5, 7)];
  } else {
    return undefined;
  }
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
      providerId: "tpex",
      providerName: PROVIDER_NAME,
      fetchedAt: new Date().toISOString(),
      actualDate: args.actualDate,
      isFallbackSource: args.isFallback,
      dataSourceNote: args.note,
    },
  };
}

async function fetchDailyClose(): Promise<TPExRow[]> {
  const res = await fetch(TPEX_DAILY_CLOSE);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as TPExRow[];
}

export class TPExProvider implements PriceProvider {
  readonly id = "tpex" as const;
  readonly name = PROVIDER_NAME;
  readonly supportsHistorical = false;

  async getDailyClose(q: PriceQuery, isFallback = false): Promise<ProviderResult> {
    const sym = normalizeSymbol(q.symbol);
    if (!isFourDigitNumeric(sym)) {
      return { kind: "unsupported", reason: "TPEx 僅支援上櫃股票純數字代號" };
    }

    const today = todayInTaiwan();
    if (q.date !== today) {
      return {
        kind: "unsupported",
        reason: "TPEx OpenAPI 僅提供當日 snapshot，不支援歷史日期查詢",
      };
    }

    try {
      const rows = await fetchDailyClose();
      const row = rows.find((r) => r.SecuritiesCompanyCode === sym);
      if (!row) return { kind: "unsupported", reason: "TPEx 找不到此代號（可能為上市股票）" };
      const close = parseNumber(row.Close);
      if (close == null) return { kind: "unsupported", reason: "TPEx 今日尚未公布收盤價" };
      const iso = rocDateToIso(row.Date) ?? today;
      return {
        kind: "ok",
        record: makeRecord({
          close,
          actualDate: iso,
          open: parseNumber(row.Open),
          high: parseNumber(row.High),
          low: parseNumber(row.Low),
          volume: parseNumber(row.TradingShares),
          isFallback,
        }),
      };
    } catch (e) {
      return { kind: "error", reason: (e as Error).message, cause: e };
    }
  }

  async getLatest(symbol: string, isFallback = false): Promise<ProviderResult> {
    return this.getDailyClose({ symbol, date: todayInTaiwan() }, isFallback);
  }

  // 上櫃 OpenAPI 沒有 by-symbol 的 candle endpoint；以 unsupported 回避
  async getCandles(): Promise<CandleResult> {
    return { kind: "unsupported", reason: "TPEx 無 by-symbol K 線資料" };
  }
}

export const tpexProvider = new TPExProvider();
