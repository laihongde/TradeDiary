import { listAll, listBySymbol, listByDateRange } from "../db/analyses";
import type {
  DailyRecord,
  PeriodStats,
  StockAnalysis,
  StockStats,
  SummaryStats,
  TrackingDaysGroupStats,
} from "../types";
import { roundTo } from "./analysis";
import { addDays, todayInTaiwan } from "./tradingDays";

function isCounted(a: StockAnalysis): boolean {
  return (
    (a.status === "REVIEWED" || a.status === "TRACKING") && a.weekReturn != null
  );
}

function winRate(success: number, total: number): number | undefined {
  return total > 0 ? roundTo((success / total) * 100, 2) : undefined;
}

function avg(values: number[]): number | undefined {
  return values.length
    ? roundTo(values.reduce((a, b) => a + b, 0) / values.length, 4)
    : undefined;
}

function median(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  const m = n % 2 === 0 ? (s[n / 2 - 1] + s[n / 2]) / 2 : s[(n - 1) / 2];
  return roundTo(m, 4);
}

export async function getSummary(): Promise<SummaryStats> {
  const all = await listAll();
  const reviewed = all.filter(isCounted);

  if (reviewed.length === 0) {
    return { total: 0, success: 0, failed: 0 };
  }

  const success = reviewed.filter((a) => a.isSuccess === true).length;
  const returns = reviewed.map((a) => a.weekReturn as number);

  return {
    total: reviewed.length,
    success,
    failed: reviewed.length - success,
    win_rate: winRate(success, reviewed.length),
    avg_return: avg(returns),
    median_return: median(returns),
    best_return: roundTo(Math.max(...returns), 4),
    worst_return: roundTo(Math.min(...returns), 4),
  };
}

function resolvePeriod(
  period: string,
  from?: string,
  to?: string,
): { start: string; end: string } {
  const today = todayInTaiwan();
  const todayDate = new Date(today);
  const dow = (todayDate.getDay() + 6) % 7; // Monday = 0

  if (period === "this_week")
    return { start: addDays(today, -dow), end: today };
  if (period === "last_week")
    return { start: addDays(today, -dow - 7), end: addDays(today, -dow - 1) };
  if (period === "this_month") {
    const start = `${today.slice(0, 7)}-01`;
    return { start, end: today };
  }
  if (period === "last_30d") return { start: addDays(today, -30), end: today };
  if (period === "custom" && from && to) return { start: from, end: to };
  const fallback = `${today.slice(0, 7)}-01`;
  return { start: fallback, end: today };
}

export async function getPeriodStats(
  period: string,
  from?: string,
  to?: string,
): Promise<PeriodStats> {
  const { start, end } = resolvePeriod(period, from, to);
  const inRange = await listByDateRange(start, end);

  const completed = inRange.filter((a) => a.weekReturn != null);
  const returns = completed.map((a) => a.weekReturn as number);
  const success = completed.filter((a) => a.isSuccess === true).length;

  let best: StockAnalysis | undefined;
  let worst: StockAnalysis | undefined;
  for (const a of completed) {
    const r = a.weekReturn ?? 0;
    if (!best || r > (best.weekReturn ?? -Infinity)) best = a;
    if (!worst || r < (worst.weekReturn ?? Infinity)) worst = a;
  }

  return {
    period,
    from_date: start,
    to_date: end,
    total_analyses: inRange.length,
    completed_reviews: completed.length,
    win_rate: winRate(success, completed.length),
    avg_return: avg(returns),
    best_stock: best?.symbol,
    best_return:
      best?.weekReturn != null ? roundTo(best.weekReturn, 4) : undefined,
    worst_stock: worst?.symbol,
    worst_return:
      worst?.weekReturn != null ? roundTo(worst.weekReturn, 4) : undefined,
  };
}

export async function getDailyRecords(
  from?: string,
  to?: string,
): Promise<DailyRecord[]> {
  const today = todayInTaiwan();
  const start = from ?? addDays(today, -30);
  const end = to ?? today;

  const items = await listByDateRange(start, end);
  const byDate = new Map<string, StockAnalysis[]>();
  for (const a of items) {
    const list = byDate.get(a.analysisDate) ?? [];
    list.push(a);
    byDate.set(a.analysisDate, list);
  }

  const result: DailyRecord[] = [];
  for (const [date, list] of byDate) {
    const completed = list.filter((a) => a.weekReturn != null);
    const success = completed.filter((a) => a.isSuccess === true).length;
    const returns = completed.map((a) => a.weekReturn as number);
    result.push({
      date,
      count: list.length,
      symbols: list.map((a) => a.symbol),
      completed_reviews: completed.length,
      win_rate: winRate(success, completed.length),
      avg_return: avg(returns),
    });
  }

  result.sort((a, b) => b.date.localeCompare(a.date));
  return result;
}

export async function getStockStats(symbol: string): Promise<StockStats> {
  const sym = symbol.trim().toUpperCase();
  const list = await listBySymbol(sym);
  const completed = list.filter((a) => a.weekReturn != null);
  const returns = completed.map((a) => a.weekReturn as number);
  const success = completed.filter((a) => a.isSuccess === true).length;

  return {
    symbol: sym,
    total_analyses: list.length,
    completed_reviews: completed.length,
    win_rate: winRate(success, completed.length),
    avg_return: avg(returns),
    best_return: returns.length ? roundTo(Math.max(...returns), 4) : undefined,
    worst_return: returns.length ? roundTo(Math.min(...returns), 4) : undefined,
    analyses: list.map((a) => ({
      id: a.id,
      analysisDate: a.analysisDate,
      direction: a.direction,
      analysisPrice: a.analysisPrice,
      reviewPrice: a.reviewPrice,
      weekReturn: a.weekReturn,
      isSuccess: a.isSuccess,
      status: a.status,
    })),
  };
}

export async function getStatsByTrackingDays(): Promise<
  TrackingDaysGroupStats[]
> {
  const all = await listAll();
  const reviewed = all.filter(isCounted);

  const groupMap = new Map<number, StockAnalysis[]>();
  for (const a of reviewed) {
    const key = a.trackingTradingDays ?? 5;
    const list = groupMap.get(key) ?? [];
    list.push(a);
    groupMap.set(key, list);
  }

  const result: TrackingDaysGroupStats[] = [];
  for (const [days, list] of groupMap) {
    const success = list.filter((a) => a.isSuccess === true).length;
    const returns = list.map((a) => a.weekReturn as number);
    result.push({
      trackingTradingDays: days,
      total: list.length,
      success,
      failed: list.length - success,
      win_rate: winRate(success, list.length),
      avg_return: avg(returns),
    });
  }

  result.sort((a, b) => a.trackingTradingDays - b.trackingTradingDays);
  return result;
}
