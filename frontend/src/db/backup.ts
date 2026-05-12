import type { StockAnalysis } from "../types";
import { listAll, bulkPut, findBySymbolDate, genId } from "./analyses";
import { DB_VERSION } from "./schema";

export interface BackupFile {
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  analyses: StockAnalysis[];
}

export type MergeStrategy = "skipDuplicates" | "overwrite";

export interface ImportResult {
  inserted: number;
  skipped: number;
  overwritten: number;
  errors: string[];
}

export async function exportAll(): Promise<BackupFile> {
  const analyses = await listAll();
  return {
    schemaVersion: DB_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: "2.0.0-local-first",
    analyses,
  };
}

export async function exportAllAsBlob(): Promise<Blob> {
  const data = await exportAll();
  return new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
}

function isAnalysis(x: unknown): x is StockAnalysis {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.symbol === "string" &&
    typeof o.analysisDate === "string" &&
    typeof o.direction === "string" &&
    typeof o.status === "string"
  );
}

function validateBackup(parsed: unknown): { ok: true; file: BackupFile } | { ok: false; error: string } {
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "備份檔不是合法的 JSON 物件" };
  const o = parsed as Record<string, unknown>;
  if (typeof o.schemaVersion !== "number") return { ok: false, error: "缺少 schemaVersion" };
  if (!Array.isArray(o.analyses)) return { ok: false, error: "缺少 analyses 陣列" };
  if (o.schemaVersion > DB_VERSION) {
    return {
      ok: false,
      error: `備份檔版本 ${o.schemaVersion} 高於目前系統版本 ${DB_VERSION}，請升級後再匯入`,
    };
  }
  for (const [i, a] of o.analyses.entries()) {
    if (!isAnalysis(a)) return { ok: false, error: `第 ${i + 1} 筆紀錄格式不符` };
  }
  return {
    ok: true,
    file: {
      schemaVersion: o.schemaVersion,
      exportedAt: typeof o.exportedAt === "string" ? o.exportedAt : "",
      appVersion: typeof o.appVersion === "string" ? o.appVersion : "",
      analyses: o.analyses as StockAnalysis[],
    },
  };
}

export async function importAll(
  raw: string,
  strategy: MergeStrategy = "skipDuplicates"
): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { inserted: 0, skipped: 0, overwritten: 0, errors: [`JSON 解析失敗：${(e as Error).message}`] };
  }

  const v = validateBackup(parsed);
  if (!v.ok) {
    return { inserted: 0, skipped: 0, overwritten: 0, errors: [v.error] };
  }

  const result: ImportResult = { inserted: 0, skipped: 0, overwritten: 0, errors: [] };
  const toPut: StockAnalysis[] = [];

  for (const incoming of v.file.analyses) {
    const dup = await findBySymbolDate(incoming.symbol, incoming.analysisDate);
    if (dup) {
      if (strategy === "skipDuplicates") {
        result.skipped++;
        continue;
      }
      toPut.push({ ...incoming, id: dup.id, createdAt: dup.createdAt, updatedAt: new Date().toISOString() });
      result.overwritten++;
    } else {
      toPut.push({
        ...incoming,
        id: incoming.id || genId(),
        createdAt: incoming.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      result.inserted++;
    }
  }

  if (toPut.length > 0) await bulkPut(toPut);
  return result;
}
