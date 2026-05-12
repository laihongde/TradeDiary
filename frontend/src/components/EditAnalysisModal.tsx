import { useEffect, useState } from "react";
import { useUpdateAnalysis } from "../hooks/useAnalyses";
import type { Direction, StockAnalysis } from "../types";

interface Props {
  analysis: StockAnalysis;
  onClose: () => void;
}

export function EditAnalysisModal({ analysis, onClose }: Props) {
  const update = useUpdateAnalysis();

  const [direction, setDirection] = useState<Direction>(analysis.direction);
  const [notes, setNotes] = useState(analysis.notes ?? "");
  const [tags, setTags] = useState(analysis.tags.join(", "));
  const [targetPrice, setTargetPrice] = useState(analysis.targetPrice?.toString() ?? "");
  const [stopLoss, setStopLoss] = useState(analysis.stopLossPrice?.toString() ?? "");
  const [reviewPrice, setReviewPrice] = useState(analysis.reviewPrice?.toString() ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    setError("");
    const payload: Parameters<typeof update.mutateAsync>[0]["data"] = {
      notes: notes.trim() || undefined,
      tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      target_price: targetPrice ? parseFloat(targetPrice) : undefined,
      stop_loss_price: stopLoss ? parseFloat(stopLoss) : undefined,
    };

    // 只有原本沒有 review_price 才允許補入（不可覆蓋）
    if (reviewPrice && !analysis.reviewPrice) {
      payload.review_price = parseFloat(reviewPrice);
    }

    // 若方向改變
    if (direction !== analysis.direction) {
      payload.status = undefined; // 讓後端不改 status
    }

    try {
      await update.mutateAsync({ id: analysis.id, data: { ...payload, direction } });
      onClose();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (e instanceof Error ? e.message : undefined);
      setError(msg ?? "儲存失敗");
    }
  }

  const hasReview = !!analysis.reviewPrice;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">
            編輯分析紀錄 &mdash; {analysis.symbol}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <label className="mb-1 block font-medium text-gray-600">分析方向</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as Direction)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="BULLISH">▲ 看多</option>
              <option value="BEARISH">▼ 看空</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-medium text-gray-600">備註</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-gray-600">標籤 (逗號分隔)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-gray-600">目標價</label>
              <input
                type="number"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                step="0.01"
                min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-600">停損價</label>
              <input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                step="0.01"
                min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {!hasReview && (
            <div>
              <label className="mb-1 block font-medium text-gray-600">
                手動補入一週後價格
                <span className="ml-1 text-xs text-gray-400">(尚未有資料才可填)</span>
              </label>
              <input
                type="number"
                value={reviewPrice}
                onChange={(e) => setReviewPrice(e.target.value)}
                step="0.01"
                min="0"
                placeholder="可選"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* 唯讀資訊 */}
          <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
            <div>分析日期：{analysis.analysisDate.split("T")[0]}</div>
            {analysis.analysisPrice != null && (
              <div>分析當天收盤：{Number(analysis.analysisPrice).toFixed(2)}</div>
            )}
            {hasReview && (
              <div className="text-amber-600">一週後價格已記錄，不可修改</div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={update.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {update.isPending ? "儲存中..." : "儲存"}
          </button>
        </div>
      </div>
    </div>
  );
}
