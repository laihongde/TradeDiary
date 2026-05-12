export type Direction = "BULLISH" | "BEARISH";
export type AnalysisStatus =
  | "PENDING"
  | "READY_TO_REVIEW"
  | "REVIEWED"
  | "TRACKING"
  | "DATA_ERROR";
export type DataStatus = "UNKNOWN" | "SUCCESS" | "FAILED" | "PARTIAL";

export type ProviderId = "finmind" | "twse" | "tpex" | "manual" | "mock";

export interface PriceSource {
  providerId: ProviderId;
  providerName: string;
  fetchedAt: string;
  actualDate: string;
  isFallbackSource: boolean;
  dataSourceNote?: string;
}

export interface StockAnalysis {
  id: string;
  symbol: string;
  stockName?: string;
  analysisDate: string;
  direction: Direction;
  notes?: string;
  tags: string[];
  targetPrice?: number;
  stopLossPrice?: number;
  status: AnalysisStatus;

  // 分析當天快照
  analysisPrice?: number;
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  volume?: number;
  dataFetchedAt?: string;
  dataStatus: DataStatus;
  dataSourceNote?: string;
  analysisPriceSource?: PriceSource;

  // 追蹤週期設定（預設 5）
  trackingTradingDays?: number;

  // 結算（第 N 個交易日）
  reviewDate?: string;
  reviewPrice?: number;
  reviewActualDate?: string;
  weekReturn?: number;
  isSuccess?: boolean;
  elapsedTradingDays?: number;
  reviewPriceSource?: PriceSource;

  // 最新追蹤
  latestPrice?: number;
  latestPriceAt?: string;
  latestReturn?: number;
  latestPriceSource?: PriceSource;

  createdAt: string;
  updatedAt: string;
}

export interface CreateAnalysisInput {
  symbol: string;
  analysis_date?: string;
  direction?: Direction;
  notes?: string;
  tags?: string[];
  target_price?: number;
  stop_loss_price?: number;
  tracking_trading_days?: number;
}

export interface SummaryStats {
  total: number;
  success: number;
  failed: number;
  win_rate?: number;
  avg_return?: number;
  median_return?: number;
  best_return?: number;
  worst_return?: number;
}

export interface PeriodStats {
  period: string;
  from_date: string;
  to_date: string;
  total_analyses: number;
  completed_reviews: number;
  win_rate?: number;
  avg_return?: number;
  best_stock?: string;
  best_return?: number;
  worst_stock?: string;
  worst_return?: number;
}

export interface DailyRecord {
  date: string;
  count: number;
  symbols: string[];
  completed_reviews: number;
  win_rate?: number;
  avg_return?: number;
}

export interface StockStats {
  symbol: string;
  total_analyses: number;
  completed_reviews: number;
  win_rate?: number;
  avg_return?: number;
  best_return?: number;
  worst_return?: number;
  analyses: Array<{
    id: string;
    analysisDate: string;
    direction: Direction;
    analysisPrice?: number;
    reviewPrice?: number;
    weekReturn?: number;
    isSuccess?: boolean;
    status: AnalysisStatus;
  }>;
}

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TrackingDaysGroupStats {
  trackingTradingDays: number;
  total: number;
  success: number;
  failed: number;
  win_rate?: number;
  avg_return?: number;
}

export interface ProviderHealthEntry {
  providerId: ProviderId;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastFailureReason?: string;
  successCount: number;
  failureCount: number;
}
