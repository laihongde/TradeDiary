import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/client";
import type { CreateAnalysisInput } from "../types";

export const QUERY_KEYS = {
  today: ["analyses", "today"],
  pending: ["analyses", "pending"],
  review: ["analyses", "review"],
  errors: ["analyses", "errors"],
  summary: ["statistics", "summary"],
  daily: (from?: string, to?: string) => ["statistics", "daily", from, to],
  period: (p: string) => ["statistics", "period", p],
  stock: (sym: string) => ["analyses", "stock", sym],
  stockStats: (sym: string) => ["statistics", "stock", sym],
};

export function useTodayAnalyses() {
  return useQuery({ queryKey: QUERY_KEYS.today, queryFn: api.getToday });
}

export function useAnalysesByDate(date: string) {
  return useQuery({
    queryKey: ["analyses", "byDate", date],
    queryFn: () => api.getAnalysesByDate(date),
    enabled: !!date,
  });
}

export function usePendingAnalyses() {
  return useQuery({ queryKey: QUERY_KEYS.pending, queryFn: api.getPending });
}

export function useReviewAnalyses() {
  return useQuery({ queryKey: QUERY_KEYS.review, queryFn: api.getReview });
}

export function useErrorAnalyses() {
  return useQuery({ queryKey: QUERY_KEYS.errors, queryFn: api.getErrors });
}

export function useSummaryStats() {
  return useQuery({ queryKey: QUERY_KEYS.summary, queryFn: api.getSummary });
}

export function useDailyRecords(from?: string, to?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.daily(from, to),
    queryFn: () => api.getDailyRecords(from, to),
  });
}

export function usePeriodStats(period: string) {
  return useQuery({
    queryKey: QUERY_KEYS.period(period),
    queryFn: () => api.getPeriodStats(period),
  });
}

export function useStockHistory(symbol: string) {
  return useQuery({
    queryKey: QUERY_KEYS.stock(symbol),
    queryFn: () => api.getStockHistory(symbol),
    enabled: !!symbol,
  });
}

export function useStockStats(symbol: string) {
  return useQuery({
    queryKey: QUERY_KEYS.stockStats(symbol),
    queryFn: () => api.getStockStats(symbol),
    enabled: !!symbol,
  });
}

export function useCreateAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAnalysisInput) => api.createAnalysis(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analyses"] });
    },
  });
}

export function useFetchReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.fetchReviewData(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analyses"] });
      qc.invalidateQueries({ queryKey: ["statistics"] });
    },
  });
}

export function useRefreshLatest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.refreshLatestPrice(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analyses"] });
    },
  });
}

export function useRefreshAllLatest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.refreshAllLatest(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analyses"] });
    },
  });
}

export function useRetrySnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.retrySnapshot(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analyses"] });
    },
  });
}

export function useUpdateAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateAnalysis>[1] }) =>
      api.updateAnalysis(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analyses"] });
      qc.invalidateQueries({ queryKey: ["statistics"] });
    },
  });
}

export function useDeleteAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteAnalysis(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analyses"] });
      qc.invalidateQueries({ queryKey: ["statistics"] });
    },
  });
}

export function useUpdateStatuses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.updateStatuses(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analyses"] });
    },
  });
}
