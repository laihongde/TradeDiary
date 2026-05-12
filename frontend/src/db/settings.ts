import type { ProviderHealthEntry, ProviderId } from "../types";
import { getDB } from "./schema";

export async function getSetting<T = unknown>(key: string): Promise<T | undefined> {
  const db = await getDB();
  const row = await db.get("settings", key);
  return row ? (row.value as T) : undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put("settings", { key, value, updatedAt: new Date().toISOString() });
}

const ALL_PROVIDERS: ProviderId[] = ["finmind", "twse", "tpex", "manual", "mock"];

export async function listProviderHealth(): Promise<ProviderHealthEntry[]> {
  const db = await getDB();
  const stored = await db.getAll("providerHealth");
  const map = new Map(stored.map((r) => [r.providerId, r]));
  return ALL_PROVIDERS.map(
    (id) =>
      map.get(id) ?? {
        providerId: id,
        successCount: 0,
        failureCount: 0,
      }
  );
}

export async function recordProviderSuccess(providerId: ProviderId): Promise<void> {
  const db = await getDB();
  const existing = (await db.get("providerHealth", providerId)) ?? {
    providerId,
    successCount: 0,
    failureCount: 0,
  };
  await db.put("providerHealth", {
    ...existing,
    lastSuccessAt: new Date().toISOString(),
    successCount: existing.successCount + 1,
  });
}

export async function recordProviderFailure(providerId: ProviderId, reason: string): Promise<void> {
  const db = await getDB();
  const existing = (await db.get("providerHealth", providerId)) ?? {
    providerId,
    successCount: 0,
    failureCount: 0,
  };
  await db.put("providerHealth", {
    ...existing,
    lastFailureAt: new Date().toISOString(),
    lastFailureReason: reason,
    failureCount: existing.failureCount + 1,
  });
}
