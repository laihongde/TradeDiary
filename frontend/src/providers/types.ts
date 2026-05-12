import type { Candle, PriceSource, ProviderId } from "../types";

export interface PriceQuery {
  symbol: string;
  date: string; // ISO yyyy-mm-dd
}

export interface PriceRecord {
  price: number;
  actualDate: string;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  source: PriceSource;
}

export type ProviderResult =
  | { kind: "ok"; record: PriceRecord }
  | { kind: "unsupported"; reason: string }
  | { kind: "error"; reason: string; cause?: unknown };

export type CandleResult =
  | { kind: "ok"; candles: Candle[] }
  | { kind: "unsupported"; reason: string }
  | { kind: "error"; reason: string; cause?: unknown };

export interface PriceProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly supportsHistorical: boolean;
  getDailyClose(q: PriceQuery): Promise<ProviderResult>;
  getLatest(symbol: string): Promise<ProviderResult>;
  getCandles?(symbol: string, days: number): Promise<CandleResult>;
}

// 將任意輸入正規化為 TWSE/TPEx/FinMind 接受的格式（純數字代號，去掉 .TW / .TWO 後綴）
export function normalizeSymbol(input: string): string {
  return input.trim().toUpperCase().replace(/\.(TW|TWO)$/i, "");
}

export function isFourDigitNumeric(symbol: string): boolean {
  return /^\d{4,6}$/.test(symbol);
}
