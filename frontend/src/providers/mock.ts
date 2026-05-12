import { type PriceProvider, type PriceQuery, type ProviderResult, normalizeSymbol } from "./types";

const PROVIDER_NAME = "Mock";

export class MockProvider implements PriceProvider {
  readonly id = "mock" as const;
  readonly name = PROVIDER_NAME;
  readonly supportsHistorical = true;

  async getDailyClose(q: PriceQuery): Promise<ProviderResult> {
    const sym = normalizeSymbol(q.symbol);
    const price = 100 + (sym.charCodeAt(0) % 50);
    return {
      kind: "ok",
      record: {
        price,
        actualDate: q.date,
        source: {
          providerId: "mock",
          providerName: PROVIDER_NAME,
          fetchedAt: new Date().toISOString(),
          actualDate: q.date,
          isFallbackSource: false,
          dataSourceNote: "Mock 資料，僅供開發測試",
        },
      },
    };
  }

  async getLatest(symbol: string): Promise<ProviderResult> {
    return this.getDailyClose({ symbol, date: new Date().toISOString().slice(0, 10) });
  }
}

export const mockProvider = new MockProvider();
