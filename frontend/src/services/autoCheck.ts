import { listAll, patch } from "../db/analyses";
import { getSetting, setSetting } from "../db/settings";
import { fetchDailyClose, fetchLatest, formatAttempts } from "../providers/dispatcher";
import type { StockAnalysis } from "../types";
import { calculateReturn, determineSuccess } from "./analysis";
import {
  countTradingDaysBetween,
  getReviewDate,
  isPastReviewCutoff,
  shouldBeReadyToReview,
  todayInTaiwan,
} from "./tradingDays";

const LAST_RUN_KEY = "autoCheck.lastRunAt";
const RUN_THROTTLE_MS = 5 * 60 * 1000; // 5 min

export async function runAutoCheckOnMount(force = false): Promise<void> {
  if (!force) {
    const last = await getSetting<string>(LAST_RUN_KEY);
    if (last && Date.now() - new Date(last).getTime() < RUN_THROTTLE_MS) return;
  }
  await setSetting(LAST_RUN_KEY, new Date().toISOString());
  await runStatusTransitions();
  await runFetchReviewForDue();
  await runRefreshLatest();
}

// ── 1. Status transitions: PENDING → READY_TO_REVIEW ─────────────────────────
export async function runStatusTransitions(): Promise<void> {
  const all = await listAll();
  const today = todayInTaiwan();
  for (const a of all) {
    if (a.status === "PENDING" && shouldBeReadyToReview(a.analysisDate, today)) {
      const elapsed = countTradingDaysBetween(a.analysisDate, today);
      await patch(a.id, { status: "READY_TO_REVIEW", elapsedTradingDays: elapsed });
    }
  }
}

// ── 2. 已到結算日且過 18:00 cutoff 的紀錄，抓 reviewPrice ────────────────────
export async function runFetchReviewForDue(): Promise<void> {
  const all = await listAll();
  for (const a of all) {
    if (a.status !== "READY_TO_REVIEW") continue;
    if (a.reviewPrice != null) continue;
    const reviewDate = a.reviewDate ?? getReviewDate(a.analysisDate);
    if (!isPastReviewCutoff(reviewDate)) continue;
    await fetchAndSaveReviewPrice(a.id);
  }
}

export async function fetchAndSaveReviewPrice(id: string): Promise<StockAnalysis | null> {
  const all = await listAll();
  const a = all.find((x) => x.id === id);
  if (!a) return null;
  if (a.reviewPrice != null) return a; // 鎖死
  const reviewDate = a.reviewDate ?? getReviewDate(a.analysisDate);
  const result = await fetchDailyClose({ symbol: a.symbol, date: reviewDate });

  if (result.kind === "ok") {
    const reviewPrice = result.record.price;
    const analysisPrice = a.analysisPrice ?? 0;
    const weekReturn = analysisPrice > 0 ? calculateReturn(analysisPrice, reviewPrice) : 0;
    const isSuccess = analysisPrice > 0 ? determineSuccess(a.direction, analysisPrice, reviewPrice) : false;
    return patch(id, {
      reviewPrice,
      reviewActualDate: result.record.actualDate,
      reviewPriceSource: result.record.source,
      weekReturn,
      isSuccess,
      status: "REVIEWED",
    });
  }

  return patch(id, {
    status: "DATA_ERROR",
    dataStatus: "FAILED",
    dataSourceNote: `自動抓取結算價失敗：${formatAttempts(result.attempts)}`,
  });
}

// ── 3. 已 REVIEWED / TRACKING 的紀錄，更新 latestPrice ───────────────────────
export async function runRefreshLatest(): Promise<void> {
  const all = await listAll();
  for (const a of all) {
    if (a.status !== "REVIEWED" && a.status !== "TRACKING") continue;
    await refreshLatestForAnalysis(a.id);
  }
}

export async function refreshLatestForAnalysis(id: string): Promise<StockAnalysis | null> {
  const all = await listAll();
  const a = all.find((x) => x.id === id);
  if (!a) return null;
  const result = await fetchLatest(a.symbol);
  if (result.kind !== "ok") {
    return patch(id, {
      dataSourceNote: `更新最新價失敗：${formatAttempts(result.attempts)}`,
    });
  }
  const latestPrice = result.record.price;
  const analysisPrice = a.analysisPrice ?? 0;
  const latestReturn = analysisPrice > 0 ? calculateReturn(analysisPrice, latestPrice) : 0;
  const today = todayInTaiwan();
  return patch(id, {
    latestPrice,
    latestPriceAt: result.record.actualDate,
    latestPriceSource: result.record.source,
    latestReturn,
    elapsedTradingDays: countTradingDaysBetween(a.analysisDate, today),
    status: a.status === "REVIEWED" ? "TRACKING" : a.status,
  });
}
