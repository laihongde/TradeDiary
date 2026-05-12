import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import * as api from "../api/client";
import type { StockAnalysis } from "../types";
import { Btn } from "./ui";

interface Props {
  analysis: StockAnalysis;
  field: api.ManualField;
  attemptsNote?: string;
  onClose: () => void;
}

const FIELD_LABEL: Record<api.ManualField, string> = {
  analysisPrice: "分析當日收盤價",
  reviewPrice: "結算（第 5 個交易日）收盤價",
  latestPrice: "最新收盤價",
};

export function ManualPriceModal({ analysis, field, attemptsNote, onClose }: Props) {
  const qc = useQueryClient();
  const defaultDate =
    field === "reviewPrice"
      ? analysis.reviewDate ?? new Date().toISOString().slice(0, 10)
      : field === "analysisPrice"
        ? analysis.analysisDate
        : new Date().toISOString().slice(0, 10);

  const [price, setPrice] = useState("");
  const [actualDate, setActualDate] = useState(defaultDate);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    setError("");
    const p = parseFloat(price);
    if (!Number.isFinite(p) || p <= 0) {
      setError("請輸入大於 0 的價格");
      return;
    }
    setSaving(true);
    try {
      await api.recordManualPrice({
        analysisId: analysis.id,
        field,
        price: p,
        actualDate,
        note: note.trim() || undefined,
      });
      qc.invalidateQueries({ queryKey: ["analyses"] });
      qc.invalidateQueries({ queryKey: ["statistics"] });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">
            手動補價 — {analysis.symbol}
          </h3>
          <button
            onClick={onClose}
            className="text-xl leading-none text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          系統已嘗試多個資料來源但仍無法取得價格，你可以稍後重試，或手動補價。
        </p>

        {attemptsNote && (
          <div className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <div className="mb-1 font-medium text-gray-700">資料來源嘗試紀錄</div>
            <div>{attemptsNote}</div>
          </div>
        )}

        <div className="space-y-3 text-sm">
          <div>
            <label className="mb-1 block font-medium text-gray-600">欄位</label>
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-gray-800">
              {FIELD_LABEL[field]}
            </div>
          </div>

          <div>
            <label className="mb-1 block font-medium text-gray-600">價格</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-gray-600">實際日期</label>
            <input
              type="date"
              value={actualDate}
              onChange={(e) => setActualDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              若該日期為非交易日，請填寫實際使用的收盤交易日。
            </p>
          </div>

          <div>
            <label className="mb-1 block font-medium text-gray-600">備註（選填）</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例：從券商 App 抄錄"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Btn onClick={onClose}>取消</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "儲存中..." : "儲存"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
