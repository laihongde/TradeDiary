import { useState } from "react";
import { usePeriodStats, useSummaryStats } from "../hooks/useAnalyses";
import { ReturnBadge } from "./ui";

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: "green" | "red" | "blue";
}) {
  const colorCls =
    highlight === "green"
      ? "text-green-600"
      : highlight === "red"
        ? "text-red-600"
        : highlight === "blue"
          ? "text-blue-600"
          : "text-gray-800";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-1 text-sm text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${colorCls}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

const PERIODS = [
  { value: "this_week", label: "本週" },
  { value: "last_week", label: "上週" },
  { value: "this_month", label: "本月" },
  { value: "last_30d", label: "近 30 天" },
];

export function Dashboard() {
  const summary = useSummaryStats();
  const [period, setPeriod] = useState("this_month");
  const periodStats = usePeriodStats(period);

  const s = summary.data;
  const p = periodStats.data;

  return (
    <div className="space-y-6">
      {/* 總覽卡片 */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          整體表現（所有已完成一週檢視）
        </h3>
        {s ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="總分析筆數" value={s.total} />
            <StatCard
              label="一週勝率"
              value={s.win_rate != null ? `${s.win_rate.toFixed(1)}%` : "-"}
              sub={`${s.success} 成功 / ${s.failed} 失敗`}
              highlight={
                s.win_rate != null
                  ? s.win_rate >= 50
                    ? "green"
                    : "red"
                  : undefined
              }
            />
            <StatCard
              label="平均一週報酬"
              value={s.avg_return != null ? `${s.avg_return > 0 ? "+" : ""}${s.avg_return.toFixed(2)}%` : "-"}
              highlight={
                s.avg_return != null
                  ? s.avg_return > 0
                    ? "green"
                    : "red"
                  : undefined
              }
            />
            <StatCard
              label="最佳 / 最差"
              value={
                s.best_return != null
                  ? `+${s.best_return.toFixed(2)}%`
                  : "-"
              }
              sub={
                s.worst_return != null
                  ? `最差 ${s.worst_return.toFixed(2)}%`
                  : undefined
              }
              highlight="blue"
            />
          </div>
        ) : (
          <div className="text-gray-400">載入中...</div>
        )}
      </div>

      {/* 依時間區間 */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            依時間區間
          </h3>
          <div className="flex gap-1">
            {PERIODS.map((pr) => (
              <button
                key={pr.value}
                onClick={() => setPeriod(pr.value)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  period === pr.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {pr.label}
              </button>
            ))}
          </div>
        </div>

        {p ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="分析筆數"
              value={p.total_analyses}
              sub={`已完成檢視 ${p.completed_reviews} 筆`}
            />
            <StatCard
              label="勝率"
              value={p.win_rate != null ? `${p.win_rate.toFixed(1)}%` : "-"}
              highlight={
                p.win_rate != null
                  ? p.win_rate >= 50
                    ? "green"
                    : "red"
                  : undefined
              }
            />
            <StatCard
              label="平均報酬"
              value={
                p.avg_return != null
                  ? `${p.avg_return > 0 ? "+" : ""}${p.avg_return.toFixed(2)}%`
                  : "-"
              }
              highlight={
                p.avg_return != null
                  ? p.avg_return > 0
                    ? "green"
                    : "red"
                  : undefined
              }
            />
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-1 text-sm text-gray-500">最佳 / 最差</div>
              {p.best_stock ? (
                <div>
                  <div className="text-sm">
                    <span className="font-semibold text-green-600">
                      {p.best_stock}
                    </span>{" "}
                    <ReturnBadge value={p.best_return} />
                  </div>
                  {p.worst_stock && (
                    <div className="mt-1 text-sm">
                      <span className="font-semibold text-red-600">
                        {p.worst_stock}
                      </span>{" "}
                      <ReturnBadge value={p.worst_return} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-400">-</div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-gray-400">載入中...</div>
        )}
      </div>
    </div>
  );
}
