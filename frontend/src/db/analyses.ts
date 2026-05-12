import type { AnalysisStatus, StockAnalysis } from "../types";
import { getDB } from "./schema";

const nowIso = () => new Date().toISOString();
const genId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export async function listAll(): Promise<StockAnalysis[]> {
  const db = await getDB();
  return db.getAll("analyses");
}

export async function listByDate(date: string): Promise<StockAnalysis[]> {
  const db = await getDB();
  return db.getAllFromIndex("analyses", "by_analysisDate", date);
}

export async function listByDateRange(from: string, to: string): Promise<StockAnalysis[]> {
  const db = await getDB();
  const range = IDBKeyRange.bound(from, to);
  return db.getAllFromIndex("analyses", "by_analysisDate", range);
}

export async function listBySymbol(symbol: string): Promise<StockAnalysis[]> {
  const db = await getDB();
  const result = await db.getAllFromIndex("analyses", "by_symbol", symbol);
  return result.sort((a, b) => b.analysisDate.localeCompare(a.analysisDate));
}

export async function listByStatuses(statuses: AnalysisStatus[]): Promise<StockAnalysis[]> {
  const db = await getDB();
  const all = await db.getAll("analyses");
  return all.filter((a) => statuses.includes(a.status));
}

export async function findBySymbolDate(symbol: string, date: string): Promise<StockAnalysis | undefined> {
  const db = await getDB();
  return db.getFromIndex("analyses", "by_symbol_date", [symbol, date]);
}

export async function get(id: string): Promise<StockAnalysis | undefined> {
  const db = await getDB();
  return db.get("analyses", id);
}

export async function create(input: Omit<StockAnalysis, "id" | "createdAt" | "updatedAt">): Promise<StockAnalysis> {
  const db = await getDB();
  const ts = nowIso();
  const row: StockAnalysis = {
    ...input,
    id: genId(),
    createdAt: ts,
    updatedAt: ts,
  };
  await db.add("analyses", row);
  return row;
}

export async function put(row: StockAnalysis): Promise<StockAnalysis> {
  const db = await getDB();
  const next: StockAnalysis = { ...row, updatedAt: nowIso() };
  await db.put("analyses", next);
  return next;
}

// 保留 analysisPrice / reviewPrice 鎖死語意：只允許首次寫入，後續會被忽略
export async function patch(id: string, changes: Partial<StockAnalysis>): Promise<StockAnalysis> {
  const db = await getDB();
  const existing = await db.get("analyses", id);
  if (!existing) throw new Error(`Analysis ${id} not found`);

  const next: StockAnalysis = { ...existing, ...changes, updatedAt: nowIso() };

  if (existing.analysisPrice != null && changes.analysisPrice != null && changes.analysisPrice !== existing.analysisPrice) {
    next.analysisPrice = existing.analysisPrice;
    next.analysisPriceSource = existing.analysisPriceSource;
  }
  if (existing.reviewPrice != null && changes.reviewPrice != null && changes.reviewPrice !== existing.reviewPrice) {
    next.reviewPrice = existing.reviewPrice;
    next.reviewPriceSource = existing.reviewPriceSource;
    next.reviewActualDate = existing.reviewActualDate;
    next.weekReturn = existing.weekReturn;
    next.isSuccess = existing.isSuccess;
  }

  await db.put("analyses", next);
  return next;
}

export async function remove(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("analyses", id);
}

export async function bulkPut(rows: StockAnalysis[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("analyses", "readwrite");
  await Promise.all(rows.map((r) => tx.store.put(r)));
  await tx.done;
}

export { genId };
