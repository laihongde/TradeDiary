import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ProviderHealthEntry, StockAnalysis } from "../types";

export const DB_NAME = "stock_analysis_db";
export const DB_VERSION = 1;

export interface SettingsRow {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface ProviderHealthRow extends ProviderHealthEntry {
  providerId: ProviderHealthEntry["providerId"];
}

export interface StockAnalysisDB extends DBSchema {
  analyses: {
    key: string;
    value: StockAnalysis;
    indexes: {
      by_analysisDate: string;
      by_symbol: string;
      by_status: string;
      by_symbol_date: [string, string];
    };
  };
  settings: {
    key: string;
    value: SettingsRow;
  };
  providerHealth: {
    key: string;
    value: ProviderHealthRow;
  };
}

let dbPromise: Promise<IDBPDatabase<StockAnalysisDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<StockAnalysisDB>> {
  if (!dbPromise) {
    dbPromise = openDB<StockAnalysisDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore("analyses", { keyPath: "id" });
          store.createIndex("by_analysisDate", "analysisDate");
          store.createIndex("by_symbol", "symbol");
          store.createIndex("by_status", "status");
          store.createIndex("by_symbol_date", ["symbol", "analysisDate"], {
            unique: true,
          });
          db.createObjectStore("settings", { keyPath: "key" });
          db.createObjectStore("providerHealth", { keyPath: "providerId" });
        }
      },
    });
  }
  return dbPromise;
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["analyses", "settings", "providerHealth"], "readwrite");
  await Promise.all([
    tx.objectStore("analyses").clear(),
    tx.objectStore("settings").clear(),
    tx.objectStore("providerHealth").clear(),
  ]);
  await tx.done;
}
