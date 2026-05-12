import type { PriceProvider, PriceRecord, ProviderResult } from "./types";

const PROVIDER_NAME = "手動輸入";

export function buildManualPriceRecord(args: {
  price: number;
  actualDate: string;
  note?: string;
}): PriceRecord {
  return {
    price: args.price,
    actualDate: args.actualDate,
    source: {
      providerId: "manual",
      providerName: PROVIDER_NAME,
      fetchedAt: new Date().toISOString(),
      actualDate: args.actualDate,
      isFallbackSource: true,
      dataSourceNote: args.note ?? "使用者手動輸入",
    },
  };
}

export class ManualPriceProvider implements PriceProvider {
  readonly id = "manual" as const;
  readonly name = PROVIDER_NAME;
  readonly supportsHistorical = true;

  async getDailyClose(): Promise<ProviderResult> {
    return { kind: "unsupported", reason: "Manual provider 不主動抓取，須由 UI 觸發" };
  }

  async getLatest(): Promise<ProviderResult> {
    return { kind: "unsupported", reason: "Manual provider 不主動抓取，須由 UI 觸發" };
  }
}

export const manualProvider = new ManualPriceProvider();
