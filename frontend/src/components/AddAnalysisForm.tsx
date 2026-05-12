import { useState } from "react";
import { useAnalysesByDate, useCreateAnalysis } from "../hooks/useAnalyses";
import type { Direction } from "../types";
import { Btn } from "./ui";

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultDate(): string {
  const now = new Date();
  // 9 點前視為前一天晚上的分析
  const d = now.getHours() < 9 ? new Date(now.getTime() - 86400000) : now;
  return toLocalDateStr(d);
}

export function AddAnalysisForm() {
  const [analysisDate, setAnalysisDate] = useState(defaultDate);
  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState<Direction>("BULLISH");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [error, setError] = useState("");

  const dateAnalyses = useAnalysesByDate(analysisDate);
  const create = useCreateAnalysis();

  const dateCount = dateAnalyses.data?.length ?? 0;
  const dateSymbols = dateAnalyses.data?.map((a) => a.symbol) ?? [];
  const isFull = dateCount >= 3;

  const isPreMarket = new Date().getHours() < 9;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;

    if (dateSymbols.includes(sym)) {
      setError(`${analysisDate} 已新增過 ${sym}`);
      return;
    }

    setError("");
    try {
      await create.mutateAsync({
        symbol: sym,
        analysis_date: analysisDate,
        direction,
        notes: notes.trim() || undefined,
        tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        target_price: targetPrice ? parseFloat(targetPrice) : undefined,
        stop_loss_price: stopLoss ? parseFloat(stopLoss) : undefined,
      });
      setSymbol("");
      setNotes("");
      setTags("");
      setTargetPrice("");
      setStopLoss("");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err instanceof Error ? err.message : undefined);
      setError(msg ?? "新增失敗，請稍後再試");
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {/* 標題列 */}
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">新增分析</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-3 w-3 rounded-full ${i < dateCount ? "bg-blue-500" : "bg-gray-200"}`}
              />
            ))}
          </div>
          <span className="text-sm text-gray-500">
            已新增 <strong>{dateCount}</strong> / 3 支
          </span>
        </div>
      </div>

      {/* 日期選擇 */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600 whitespace-nowrap">分析日期</label>
          <input
            type="date"
            value={analysisDate}
            max={toLocalDateStr(new Date())}
            onChange={(e) => setAnalysisDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {isPreMarket && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 border border-amber-200">
              開盤前 · 自動設為昨日
            </span>
          )}
        </div>
      </div>

      {/* 已新增的股票 */}
      {dateSymbols.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {dateSymbols.map((sym) => (
            <span
              key={sym}
              className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700"
            >
              {sym}
            </span>
          ))}
        </div>
      )}

      {isFull ? (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 text-center">
          ✓ {analysisDate} 已完成 3 支分析，切換日期可繼續新增
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* 股票代號 + 方向 */}
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="股票代號 (例：2330 或 AAPL)"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm uppercase placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={20}
              required
            />
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as Direction)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="BULLISH">▲ 看多</option>
              <option value="BEARISH">▼ 看空</option>
            </select>
          </div>

          {/* 備註 */}
          <input
            type="text"
            placeholder="備註 (可選)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* 進階欄位 */}
          <details className="group">
            <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
              進階選項（標籤、目標價、停損價）
            </summary>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="標籤 (逗號分隔)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="目標價"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                min="0"
                step="0.01"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="停損價"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                min="0"
                step="0.01"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </details>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Btn
            variant="primary"
            size="md"
            disabled={create.isPending || !symbol.trim()}
            className="w-full"
          >
            {create.isPending ? "新增中..." : "+ 新增分析"}
          </Btn>
        </form>
      )}
    </div>
  );
}
