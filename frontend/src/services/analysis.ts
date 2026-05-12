import type { Direction } from "../types";

// 報酬率 = (compare - analysis) / analysis * 100，保留 4 位小數
export function calculateReturn(analysisPrice: number, comparePrice: number): number {
  if (analysisPrice === 0) return 0;
  const raw = ((comparePrice - analysisPrice) / analysisPrice) * 100;
  return roundTo(raw, 4);
}

export function determineSuccess(direction: Direction, analysisPrice: number, reviewPrice: number): boolean {
  if (analysisPrice === reviewPrice) return false;
  if (direction === "BULLISH") return reviewPrice > analysisPrice;
  return reviewPrice < analysisPrice;
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function isFlat(analysisPrice?: number, reviewPrice?: number): boolean {
  return analysisPrice != null && reviewPrice != null && analysisPrice === reviewPrice;
}
