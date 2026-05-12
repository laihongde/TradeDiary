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
  const [entryPrices, setEntryPrices] = useState<string[]>([""]);  
  const [exitPrices, setExitPrices] = useState<string[]>([""]);
  const [trackingDays, setTrackingDays] = useState<number>(5);
  const [customDays, setCustomDays] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [error, setError] = useState("");

  const dateAnalyses = useAnalysesByDate(analysisDate);
  const create = useCreateAnalysis();

  const dateCount = dateAnalyses.data?.length ?? 0;
  const dateSymbols = dateAnalyses.data?.map((a) => a.symbol) ?? [];

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
      const finalDays = useCustom
        ? Math.max(1, parseInt(customDays, 10) || 5)
        : trackingDays;
      const validEntry = entryPrices.filter((p) => p.trim() !== "");
      const validExit = exitPrices.filter((p) => p.trim() !== "");
      const priceLine = [
        validEntry.length ? `進場: ${validEntry.join(" / ")}` : "",
        validExit.length ? `出場: ${validExit.join(" / ")}` : "",
      ].filter(Boolean).join("　");
      const finalNotes = [priceLine, notes.trim()].filter(Boolean).join("\n") || undefined;
      await create.mutateAsync({
        symbol: sym,
        analysis_date: analysisDate,
        direction,
        notes: finalNotes,
        tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        tracking_trading_days: finalDays,
      });
      setSymbol("");
      setNotes("");
      setTags("");
      setEntryPrices([""]);
      setExitPrices([""]);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err instanceof Error ? err.message : undefined);
      setError(msg ?? "新增失敗，請稍後再試");
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 dark:border-gray-700 dark:bg-gray-800">
      {/* 標題列 */}
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">新增分析</h2>
        {dateCount > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            今日已新增 <strong>{dateCount}</strong> 支
          </span>
        )}
      </div>

      {/* 日期選擇 */}
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium text-gray-600 whitespace-nowrap dark:text-gray-300">分析日期</label>
          <input
            type="date"
            value={analysisDate}
            max={toLocalDateStr(new Date())}
            onChange={(e) => setAnalysisDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:[color-scheme:dark]"
          />
          {isPreMarket && (
            <span className="rounded-full bg-amber-50 dark:bg-amber-400/20 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-400/40">
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
              className="rounded-full bg-blue-50 dark:bg-blue-400/20 px-3 py-1 text-sm font-medium text-blue-700 dark:text-blue-300 border border-transparent dark:border-blue-400/30"
            >
              {sym}
            </span>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 pb-20 sm:pb-0">
          {/* 股票代號 + 方向 */}
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="股票代號 (例：2330 或 AAPL)"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm uppercase placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
              maxLength={20}
              required
            />
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as Direction)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
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
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
          />

          {/* 追蹤週期 */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-gray-500 whitespace-nowrap dark:text-gray-400">追蹤週期</span>
              {[1, 3, 5, 10, 20].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => { setTrackingDays(d); setUseCustom(false); }}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
                    !useCustom && trackingDays === d
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                  }`}
                >
                  {d} 日
                </button>
              ))}
              <button
                type="button"
                onClick={() => setUseCustom(true)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
                  useCustom
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                }`}
              >
                自訂
              </button>
              {useCustom && (
                <input
                  type="number"
                  min="1"
                  max="999"
                  placeholder="天數"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  className="w-16 rounded-lg border border-gray-300 px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              )}
            </div>
          </div>

          {/* 進階欄位 */}
          <details className="group">
            <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              進階選項（標籤、進出場價）
            </summary>
            <div className="mt-3 space-y-3">
              {/* 標籤 */}
              <input
                type="text"
                placeholder="標籤 (逗號分隔)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
              />
              {/* 進場價 */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">進場價</span>
                  <button
                    type="button"
                    onClick={() => setEntryPrices((p) => [...p, ""])}
                    className="text-xs text-blue-500 hover:text-blue-700"
                  >
                    ＋ 多段進場
                  </button>
                </div>
                <div className="space-y-1.5">
                  {entryPrices.map((val, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="w-4 shrink-0 text-center text-xs text-gray-400">{idx + 1}</span>
                      <input
                        type="number"
                        placeholder="進場價"
                        value={val}
                        onChange={(e) =>
                          setEntryPrices((p) => p.map((v, i) => (i === idx ? e.target.value : v)))
                        }
                        min="0"
                        step="0.01"
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      />
                      {entryPrices.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setEntryPrices((p) => p.filter((_, i) => i !== idx))}
                          className="text-gray-400 hover:text-red-500"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {/* 出場價 */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">出場價</span>
                  <button
                    type="button"
                    onClick={() => setExitPrices((p) => [...p, ""])}
                    className="text-xs text-blue-500 hover:text-blue-700"
                  >
                    ＋ 多段出場
                  </button>
                </div>
                <div className="space-y-1.5">
                  {exitPrices.map((val, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="w-4 shrink-0 text-center text-xs text-gray-400">{idx + 1}</span>
                      <input
                        type="number"
                        placeholder="出場價"
                        value={val}
                        onChange={(e) =>
                          setExitPrices((p) => p.map((v, i) => (i === idx ? e.target.value : v)))
                        }
                        min="0"
                        step="0.01"
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      />
                      {exitPrices.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setExitPrices((p) => p.filter((_, i) => i !== idx))}
                          className="text-gray-400 hover:text-red-500"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </details>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* 手機：固定在螢幕底部；桌機：inline */}
          <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none dark:border-gray-700 dark:bg-gray-900/95">
            <Btn
              variant="primary"
              size="md"
              disabled={create.isPending || !symbol.trim()}
              className="w-full"
            >
              {create.isPending ? "新增中..." : "+ 新增分析"}
            </Btn>
          </div>
        </form>
    </div>
  );
}
