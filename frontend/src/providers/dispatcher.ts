import { recordProviderFailure, recordProviderSuccess } from "../db/settings";
import type { Candle } from "../types";
import { finmindProvider } from "./finmind";
import { tpexProvider } from "./tpex";
import { twseProvider } from "./twse";
import type { CandleResult, PriceProvider, PriceQuery, PriceRecord, ProviderResult } from "./types";

const ONLINE_CHAIN: PriceProvider[] = [finmindProvider, twseProvider, tpexProvider];

export interface AttemptOutcome {
  providerId: PriceProvider["id"];
  providerName: string;
  kind: "ok" | "unsupported" | "error";
  reason?: string;
}

export type DispatchResult =
  | { kind: "ok"; record: PriceRecord; attempts: AttemptOutcome[] }
  | { kind: "all_failed"; attempts: AttemptOutcome[] };

async function callProvider(
  p: PriceProvider,
  q: PriceQuery,
  isFallback: boolean
): Promise<ProviderResult> {
  // 個別 provider 的 getDailyClose 接受第二參數 isFallback；用 any 兼容沒有覆寫的實作
  const fn = p.getDailyClose as (q: PriceQuery, isFallback?: boolean) => Promise<ProviderResult>;
  return fn.call(p, q, isFallback);
}

async function callLatest(p: PriceProvider, symbol: string, isFallback: boolean): Promise<ProviderResult> {
  const fn = p.getLatest as (sym: string, isFallback?: boolean) => Promise<ProviderResult>;
  return fn.call(p, symbol, isFallback);
}

export async function fetchDailyClose(q: PriceQuery): Promise<DispatchResult> {
  const attempts: AttemptOutcome[] = [];
  for (let i = 0; i < ONLINE_CHAIN.length; i++) {
    const p = ONLINE_CHAIN[i];
    const isFallback = i > 0;
    const result = await callProvider(p, q, isFallback);
    if (result.kind === "ok") {
      attempts.push({ providerId: p.id, providerName: p.name, kind: "ok" });
      await recordProviderSuccess(p.id);
      return { kind: "ok", record: result.record, attempts };
    }
    attempts.push({
      providerId: p.id,
      providerName: p.name,
      kind: result.kind,
      reason: result.reason,
    });
    if (result.kind === "error") {
      await recordProviderFailure(p.id, result.reason);
    }
  }
  return { kind: "all_failed", attempts };
}

export async function fetchLatest(symbol: string): Promise<DispatchResult> {
  const attempts: AttemptOutcome[] = [];
  for (let i = 0; i < ONLINE_CHAIN.length; i++) {
    const p = ONLINE_CHAIN[i];
    const isFallback = i > 0;
    const result = await callLatest(p, symbol, isFallback);
    if (result.kind === "ok") {
      attempts.push({ providerId: p.id, providerName: p.name, kind: "ok" });
      await recordProviderSuccess(p.id);
      return { kind: "ok", record: result.record, attempts };
    }
    attempts.push({
      providerId: p.id,
      providerName: p.name,
      kind: result.kind,
      reason: result.reason,
    });
    if (result.kind === "error") {
      await recordProviderFailure(p.id, result.reason);
    }
  }
  return { kind: "all_failed", attempts };
}

export interface CandleDispatchResult {
  kind: "ok" | "all_failed";
  candles?: Candle[];
  providerId?: PriceProvider["id"];
  attempts: AttemptOutcome[];
}

export async function fetchCandles(symbol: string, days: number): Promise<CandleDispatchResult> {
  const attempts: AttemptOutcome[] = [];
  for (const p of ONLINE_CHAIN) {
    if (!p.getCandles) continue;
    const result: CandleResult = await p.getCandles(symbol, days);
    if (result.kind === "ok") {
      attempts.push({ providerId: p.id, providerName: p.name, kind: "ok" });
      await recordProviderSuccess(p.id);
      return { kind: "ok", candles: result.candles, providerId: p.id, attempts };
    }
    attempts.push({
      providerId: p.id,
      providerName: p.name,
      kind: result.kind,
      reason: result.reason,
    });
    if (result.kind === "error") {
      await recordProviderFailure(p.id, result.reason);
    }
  }
  return { kind: "all_failed", attempts };
}

export function formatAttempts(attempts: AttemptOutcome[]): string {
  return attempts
    .map(
      (a) =>
        `${a.providerName}: ${a.kind === "ok" ? "成功" : a.kind === "unsupported" ? "不支援" : "錯誤"}${
          a.reason ? `（${a.reason}）` : ""
        }`
    )
    .join("；");
}
