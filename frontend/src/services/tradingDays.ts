const TAIWAN_HOLIDAYS: ReadonlySet<string> = new Set([
  // 2026 固定國定假日
  "2026-01-01", // 元旦
  "2026-02-28", // 和平紀念日
  "2026-04-04", // 兒童節（含清明）
  "2026-05-01", // 勞動節
  "2026-10-10", // 國慶日
  // 2026 農曆節日（依 TWSE 公告估算，請每年核對）
  "2026-02-16", // 農曆除夕
  "2026-02-17", // 春節初一
  "2026-02-18", // 春節初二
  "2026-02-19", // 春節初三
  "2026-02-20", // 春節初四
  "2026-06-19", // 端午節
  "2026-09-24", // 中秋節
]);

export const REVIEW_TRADING_DAYS = 5;
export const REVIEW_CUTOFF_HOUR = 18; // 台灣時間 18:00 後才允許取結算價

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split("-").map((p) => parseInt(p, 10));
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseIsoDate(s);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

export function diffDays(from: string, to: string): number {
  const ms = parseIsoDate(to).getTime() - parseIsoDate(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function isTradingDay(iso: string): boolean {
  const d = parseIsoDate(iso);
  const dow = d.getDay(); // 0 = 週日, 6 = 週六
  if (dow === 0 || dow === 6) return false;
  return !TAIWAN_HOLIDAYS.has(iso);
}

export function getReviewDate(analysisDate: string, n?: number): string {
  const target = n ?? REVIEW_TRADING_DAYS;
  let tradingDays = 0;
  let current = analysisDate;
  while (tradingDays < target) {
    current = addDays(current, 1);
    if (isTradingDay(current)) tradingDays++;
  }
  return current;
}

export function shouldBeReadyToReview(
  analysisDate: string,
  today?: string,
  n?: number,
): boolean {
  const t = today ?? toIsoDate(new Date());
  return t >= getReviewDate(analysisDate, n);
}

export function daysUntilReview(
  analysisDate: string,
  today?: string,
  n?: number,
): number {
  const t = today ?? toIsoDate(new Date());
  return diffDays(t, getReviewDate(analysisDate, n));
}

// 台灣時間（UTC+8）的今日日期
export function todayInTaiwan(): string {
  const now = new Date();
  const tw = new Date(
    now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60_000,
  );
  return toIsoDate(tw);
}

export function isPastReviewCutoff(reviewDate: string): boolean {
  const now = new Date();
  const tw = new Date(
    now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60_000,
  );
  const todayTw = toIsoDate(tw);
  if (todayTw > reviewDate) return true;
  if (todayTw === reviewDate && tw.getHours() >= REVIEW_CUTOFF_HOUR)
    return true;
  return false;
}

export function daysSinceAnalysis(
  analysisDate: string,
  today?: string,
): number {
  const t = today ?? toIsoDate(new Date());
  return diffDays(analysisDate, t);
}

// 用於 elapsedTradingDays
export function countTradingDaysBetween(from: string, to: string): number {
  if (from >= to) return 0;
  let count = 0;
  let current = from;
  while (current < to) {
    current = addDays(current, 1);
    if (isTradingDay(current)) count++;
  }
  return count;
}
