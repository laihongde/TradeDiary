import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useUpdateAnalysis } from "../hooks/useAnalyses";
import type { Direction, StockAnalysis } from "../types";

interface Props {
  analysis: StockAnalysis;
  onClose: () => void;
}

function parsePriceNotes(raw: string): { entry: string[]; entryQty: string[]; exit: string[]; exitQty: string[]; rest: string } {
  const lines = raw.split("\n");
  const firstLine = lines[0] ?? "";
  let entry: string[] = [""];
  let entryQty: string[] = [""];
  let exit: string[] = [""];
  let exitQty: string[] = [""];
  let rest = raw;
  if (firstLine.includes("進場:") || firstLine.includes("出場:")) {
    const parts = firstLine.split("　"); // full-width space
    for (const part of parts) {
      if (part.startsWith("進場:")) {
        const legs = part.replace("進場:", "").trim().split(" / ").map((s) => s.trim()).filter(Boolean);
        const parsed = legs.map((s) => { const [p, q] = s.split("×"); return { price: p?.trim() ?? "", qty: q?.trim() ?? "" }; });
        entry = parsed.length ? parsed.map((x) => x.price) : [""];
        entryQty = parsed.length ? parsed.map((x) => x.qty) : [""];
      } else if (part.startsWith("出場:")) {
        const legs = part.replace("出場:", "").trim().split(" / ").map((s) => s.trim()).filter(Boolean);
        const parsed = legs.map((s) => { const [p, q] = s.split("×"); return { price: p?.trim() ?? "", qty: q?.trim() ?? "" }; });
        exit = parsed.length ? parsed.map((x) => x.price) : [""];
        exitQty = parsed.length ? parsed.map((x) => x.qty) : [""];
      }
    }
    rest = lines.slice(1).join("\n");
  }
  return { entry, entryQty, exit, exitQty, rest };
}

export function EditAnalysisModal({ analysis, onClose }: Props) {
  const update = useUpdateAnalysis();

  const parsed = parsePriceNotes(analysis.notes ?? "");
  const [direction, setDirection] = useState<Direction>(analysis.direction);
  const [plainNotes, setPlainNotes] = useState(parsed.rest);
  const [tags, setTags] = useState(analysis.tags.join(", "));
  const [entryPrices, setEntryPrices] = useState<string[]>(parsed.entry);
  const [entryQtys, setEntryQtys] = useState<string[]>(parsed.entryQty);
  const [exitPrices, setExitPrices] = useState<string[]>(parsed.exit);
  const [exitQtys, setExitQtys] = useState<string[]>(parsed.exitQty);
  const [reviewPrice, setReviewPrice] = useState(analysis.reviewPrice?.toString() ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    setError("");
    const fmtLeg = (price: string, qty: string) => {
      const p = price.trim(); const q = qty.trim();
      if (!p) return null;
      return q ? `${p}\u00d7${q}` : p;
    };
    const validEntry = entryPrices.map((p, i) => fmtLeg(p, entryQtys[i] ?? "")).filter(Boolean) as string[];
    const validExit = exitPrices.map((p, i) => fmtLeg(p, exitQtys[i] ?? "")).filter(Boolean) as string[];
    const priceLine = [
      validEntry.length ? `進場: ${validEntry.join(" / ")}` : "",
      validExit.length ? `出場: ${validExit.join(" / ")}` : "",
    ].filter(Boolean).join("　");
    const finalNotes = [priceLine, plainNotes.trim()].filter(Boolean).join("\n") || undefined;

    const payload: Parameters<typeof update.mutateAsync>[0]["data"] = {
      notes: finalNotes,
      tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-t-xl bg-white p-4 shadow-xl sm:rounded-xl sm:p-6 max-h-[90vh] overflow-y-auto">
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
              value={plainNotes}
              onChange={(e) => setPlainNotes(e.target.value)}
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

          {/* 進場價 */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="font-medium text-gray-600">進場價</label>
              <button
                type="button"
                onClick={() => { setEntryPrices((p) => [...p, ""]); setEntryQtys((q) => [...q, ""]); }}
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
                    className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-400">×</span>
                  <input
                    type="number"
                    placeholder="股數"
                    value={entryQtys[idx] ?? ""}
                    onChange={(e) =>
                      setEntryQtys((q) => q.map((v, i) => (i === idx ? e.target.value : v)))
                    }
                    min="0"
                    step="1"
                    className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-400">零股</span>
                  {entryPrices.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setEntryPrices((p) => p.filter((_, i) => i !== idx));
                        setEntryQtys((q) => q.filter((_, i) => i !== idx));
                      }}
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
              <label className="font-medium text-gray-600">出場價</label>
              <button
                type="button"
                onClick={() => { setExitPrices((p) => [...p, ""]); setExitQtys((q) => [...q, ""]); }}
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
                    className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-400">×</span>
                  <input
                    type="number"
                    placeholder="股數"
                    value={exitQtys[idx] ?? ""}
                    onChange={(e) =>
                      setExitQtys((q) => q.map((v, i) => (i === idx ? e.target.value : v)))
                    }
                    min="0"
                    step="1"
                    className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-400">零股</span>
                  {exitPrices.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setExitPrices((p) => p.filter((_, i) => i !== idx));
                        setExitQtys((q) => q.filter((_, i) => i !== idx));
                      }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
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
    </div>,
    document.body
  );
}
