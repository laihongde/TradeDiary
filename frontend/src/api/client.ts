// 純前端 local-first client。完全不呼叫 HTTP；介面保留與舊版相同的 export 簽章，
// 讓 hooks 與 component 無需改動。實作改為 IndexedDB + provider dispatcher。

import * as db from "../db/analyses";
import { fetchCandles, fetchDailyClose, fetchLatest, formatAttempts } from "../providers/dispatcher";
import { buildManualPriceRecord } from "../providers/manual";
import {
  refreshLatestForAnalysis,
  fetchAndSaveReviewPrice,
  runStatusTransitions,
} from "../services/autoCheck";
import {
  getDailyRecords as svcDailyRecords,
  getPeriodStats as svcPeriodStats,
  getStockStats as svcStockStats,
  getSummary as svcSummary,
} from "../services/statistics";
import { calculateReturn, determineSuccess } from "../services/analysis";
import {
  countTradingDaysBetween,
  getReviewDate,
  todayInTaiwan,
} from "../services/tradingDays";
import type {
  Candle,
  CreateAnalysisInput,
  DailyRecord,
  Direction,
  PeriodStats,
  StockAnalysis,
  StockStats,
  SummaryStats,
} from "../types";

// ── Analyses ──────────────────────────────────────────────────────────────────

export async function getToday(): Promise<StockAnalysis[]> {
  return db.listByDate(todayInTaiwan());
}

export async function getAnalysesByDate(date: string): Promise<StockAnalysis[]> {
  return db.listByDate(date);
}

export async function getPending(): Promise<StockAnalysis[]> {
  return db.listByStatuses(["PENDING", "READY_TO_REVIEW"]);
}

export async function getReview(): Promise<StockAnalysis[]> {
  return db.listByStatuses(["REVIEWED", "TRACKING"]);
}

export async function getErrors(): Promise<StockAnalysis[]> {
  return db.listByStatuses(["DATA_ERROR"]);
}

export async function getStockHistory(symbol: string): Promise<StockAnalysis[]> {
  return db.listBySymbol(symbol.trim().toUpperCase());
}

// ── createAnalysis：商業規則 ──────────────────────────────────────────────────
// 1. 同日同 symbol 不可重複
// 2. 同日不超過 3 筆
// 3. dispatcher 抓當日價格；全失敗則建立 DATA_ERROR 紀錄保留使用者輸入

export async function createAnalysis(data: CreateAnalysisInput): Promise<StockAnalysis> {
  const sym = data.symbol.trim().toUpperCase();
  const date = data.analysis_date || todayInTaiwan();

  const dup = await db.findBySymbolDate(sym, date);
  if (dup) throw new ClientError(`${date} 已新增過 ${sym}`);

  const sameDay = await db.listByDate(date);
  if (sameDay.length >= 3) throw new ClientError(`${date} 已達每日 3 支股票上限`);

  const direction: Direction = data.direction ?? "BULLISH";
  const reviewDate = getReviewDate(date);
  const dispatch = await fetchDailyClose({ symbol: sym, date });

  const base: Omit<StockAnalysis, "id" | "createdAt" | "updatedAt"> = {
    symbol: sym,
    analysisDate: date,
    direction,
    notes: data.notes,
    tags: data.tags ?? [],
    targetPrice: data.target_price,
    stopLossPrice: data.stop_loss_price,
    status: "PENDING",
    dataStatus: "UNKNOWN",
    reviewDate,
  };

  if (dispatch.kind === "ok") {
    const r = dispatch.record;
    return db.create({
      ...base,
      analysisPrice: r.price,
      openPrice: r.open,
      highPrice: r.high,
      lowPrice: r.low,
      volume: r.volume,
      dataFetchedAt: r.source.fetchedAt,
      dataStatus: "SUCCESS",
      dataSourceNote: r.source.dataSourceNote,
      analysisPriceSource: r.source,
      status: "PENDING",
    });
  }

  // 全部 provider 失敗 → 保留紀錄，標記 DATA_ERROR
  return db.create({
    ...base,
    status: "DATA_ERROR",
    dataStatus: "FAILED",
    dataSourceNote: `自動抓取分析當日價格失敗：${formatAttempts(dispatch.attempts)}`,
  });
}

// ── updateAnalysis：對應原本 backend PATCH 行為 ──────────────────────────────

export type UpdateAnalysisData = Partial<{
  notes: string;
  tags: string[];
  status: string;
  review_price: number;
  direction: string;
  target_price: number;
  stop_loss_price: number;
}>;

export async function updateAnalysis(id: string, data: UpdateAnalysisData): Promise<StockAnalysis> {
  const existing = await db.get(id);
  if (!existing) throw new ClientError(`找不到紀錄 ${id}`);

  const changes: Partial<StockAnalysis> = {};
  if (data.notes !== undefined) changes.notes = data.notes;
  if (data.tags !== undefined) changes.tags = data.tags;
  if (data.direction) changes.direction = data.direction as Direction;
  if (data.target_price !== undefined) changes.targetPrice = data.target_price;
  if (data.stop_loss_price !== undefined) changes.stopLossPrice = data.stop_loss_price;
  if (data.status) changes.status = data.status as StockAnalysis["status"];

  // 手動補 reviewPrice（僅在尚未存在時生效，由 patch 鎖死）
  if (data.review_price !== undefined && existing.reviewPrice == null) {
    const today = todayInTaiwan();
    const source = buildManualPriceRecord({
      price: data.review_price,
      actualDate: existing.reviewDate ?? today,
      note: "使用者手動補結算價",
    }).source;
    changes.reviewPrice = data.review_price;
    changes.reviewPriceSource = source;
    changes.reviewActualDate = source.actualDate;
    if (existing.analysisPrice != null) {
      changes.weekReturn = calculateReturn(existing.analysisPrice, data.review_price);
      changes.isSuccess = determineSuccess(
        existing.direction,
        existing.analysisPrice,
        data.review_price
      );
    }
    if (!changes.status) changes.status = "REVIEWED";
  }

  return db.patch(id, changes);
}

export async function deleteAnalysis(id: string): Promise<void> {
  await db.remove(id);
}

export async function updateStatuses(): Promise<void> {
  await runStatusTransitions();
}

export async function fetchReviewData(id: string): Promise<StockAnalysis | null> {
  return fetchAndSaveReviewPrice(id);
}

export async function refreshLatestPrice(id: string): Promise<StockAnalysis | null> {
  return refreshLatestForAnalysis(id);
}

export async function refreshAllLatest(): Promise<void> {
  const all = await db.listAll();
  for (const a of all) {
    if (a.status === "REVIEWED" || a.status === "TRACKING") {
      await refreshLatestForAnalysis(a.id);
    }
  }
}

// 重試 DATA_ERROR 紀錄：重新嘗試 dispatcher 抓分析當日 + 結算日
export async function retrySnapshot(id: string): Promise<StockAnalysis | null> {
  const a = await db.get(id);
  if (!a) return null;
  if (a.analysisPrice == null) {
    const dispatch = await fetchDailyClose({ symbol: a.symbol, date: a.analysisDate });
    if (dispatch.kind === "ok") {
      const r = dispatch.record;
      const today = todayInTaiwan();
      const elapsed = countTradingDaysBetween(a.analysisDate, today);
      await db.patch(id, {
        analysisPrice: r.price,
        openPrice: r.open,
        highPrice: r.high,
        lowPrice: r.low,
        volume: r.volume,
        dataFetchedAt: r.source.fetchedAt,
        dataStatus: "SUCCESS",
        dataSourceNote: r.source.dataSourceNote,
        analysisPriceSource: r.source,
        status: "PENDING",
        elapsedTradingDays: elapsed,
      });
    } else {
      await db.patch(id, {
        dataSourceNote: `重試失敗：${formatAttempts(dispatch.attempts)}`,
      });
    }
  }
  return (await db.get(id)) ?? null;
}

// ── Statistics ────────────────────────────────────────────────────────────────

export const getSummary = (): Promise<SummaryStats> => svcSummary();
export const getPeriodStats = (period: string, from?: string, to?: string): Promise<PeriodStats> =>
  svcPeriodStats(period, from, to);
export const getDailyRecords = (from?: string, to?: string): Promise<DailyRecord[]> =>
  svcDailyRecords(from, to);
export const getStockStats = (symbol: string): Promise<StockStats> => svcStockStats(symbol);

// ── Market data ───────────────────────────────────────────────────────────────

export async function getQuote(symbol: string) {
  const result = await fetchLatest(symbol);
  if (result.kind !== "ok") {
    throw new ClientError(`抓取最新價格失敗：${formatAttempts(result.attempts)}`);
  }
  return {
    symbol,
    price: result.record.price,
    open: result.record.open,
    high: result.record.high,
    low: result.record.low,
    volume: result.record.volume,
    actualDate: result.record.actualDate,
    source: result.record.source,
  };
}

export async function getCandles(symbol: string, days = 60): Promise<{ symbol: string; candles: Candle[] }> {
  const result = await fetchCandles(symbol, days);
  if (result.kind !== "ok" || !result.candles) {
    throw new ClientError(`抓取 K 線失敗：${formatAttempts(result.attempts)}`);
  }
  return { symbol, candles: result.candles };
}

export type { Candle };

// ── Manual price entry（給 ManualPriceModal 使用） ───────────────────────────

export type ManualField = "analysisPrice" | "reviewPrice" | "latestPrice";

export async function recordManualPrice(args: {
  analysisId: string;
  field: ManualField;
  price: number;
  actualDate: string;
  note?: string;
}): Promise<StockAnalysis> {
  const a = await db.get(args.analysisId);
  if (!a) throw new ClientError(`找不到紀錄 ${args.analysisId}`);

  const record = buildManualPriceRecord({
    price: args.price,
    actualDate: args.actualDate,
    note: args.note,
  });

  const changes: Partial<StockAnalysis> = {};
  if (args.field === "analysisPrice" && a.analysisPrice == null) {
    changes.analysisPrice = args.price;
    changes.analysisPriceSource = record.source;
    changes.dataFetchedAt = record.source.fetchedAt;
    changes.dataStatus = "PARTIAL";
    changes.status = a.status === "DATA_ERROR" ? "PENDING" : a.status;
  } else if (args.field === "reviewPrice" && a.reviewPrice == null) {
    changes.reviewPrice = args.price;
    changes.reviewPriceSource = record.source;
    changes.reviewActualDate = args.actualDate;
    if (a.analysisPrice != null) {
      changes.weekReturn = calculateReturn(a.analysisPrice, args.price);
      changes.isSuccess = determineSuccess(a.direction, a.analysisPrice, args.price);
    }
    changes.status = "REVIEWED";
  } else if (args.field === "latestPrice") {
    changes.latestPrice = args.price;
    changes.latestPriceSource = record.source;
    changes.latestPriceAt = args.actualDate;
    if (a.analysisPrice != null) {
      changes.latestReturn = calculateReturn(a.analysisPrice, args.price);
    }
  } else {
    throw new ClientError(
      args.field === "analysisPrice"
        ? "分析當日價格已存在，無法手動覆蓋"
        : "結算價已存在，無法手動覆蓋"
    );
  }

  return db.patch(args.analysisId, changes);
}

// ── Errors ────────────────────────────────────────────────────────────────────

export class ClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientError";
  }
}
