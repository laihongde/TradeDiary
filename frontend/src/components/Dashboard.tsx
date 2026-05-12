import { useState } from "react";
import { usePeriodStats, useStatsByTrackingDays, useSummaryStats } from "../hooks/useAnalyses";
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
  const trackingDaysStats = useStatsByTrackingDays();

  const s = summary.data;
  const p = periodStats.data;

  return (
    <div className="space-y-6">
      {/* 總覽卡片 */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          整體表現（所有已完成週期檢視）
        </h3>
        {s ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="總分析筆數" value={s.total} />
            <StatCard
              label="週期勝率"
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
              label="平均週期報鈅"
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
        <div className="mb-3 flex flex-wrap items-center gap-2">
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

      {/* 依追蹤週期分組 */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          依追蹤週期分組表現
        </h3>
        {trackingDaysStats.data && trackingDaysStats.data.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="px-3 py-2 font-medium sm:px-4">追蹤週期</th>
                  <th className="px-3 py-2 font-medium text-right sm:px-4">筆數</th>
                  <th className="px-3 py-2 font-medium text-right sm:px-4">勝率</th>
                  <th className="px-3 py-2 font-medium text-right sm:px-4">平均報酬</th>
                  <th className="hidden px-3 py-2 font-medium text-right sm:table-cell sm:px-4">成功 / 失敗</th>
                </tr>
              </thead>
              <tbody>
                {trackingDaysStats.data.map((g) => (
                  <tr key={g.trackingTradingDays} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium sm:px-4">追蹤 {g.trackingTradingDays} 日</td>
                    <td className="px-3 py-2 text-right sm:px-4">{g.total}</td>
                    <td className={`px-3 py-2 text-right font-semibold sm:px-4 ${
                      g.win_rate == null ? "text-gray-400" : g.win_rate >= 50 ? "text-green-600" : "text-red-600"
                    }`}>
                      {g.win_rate != null ? `${g.win_rate.toFixed(1)}%` : "-"}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold sm:px-4 ${
                      g.avg_return == null ? "text-gray-400" : g.avg_return > 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {g.avg_return != null
                        ? `${g.avg_return > 0 ? "+" : ""}${g.avg_return.toFixed(2)}%`
                        : "-"}
                    </td>
                    <td className="hidden px-3 py-2 text-right text-gray-500 sm:table-cell sm:px-4">
                      <span className="text-green-600">{g.success}</span>
                      {" / "}
                      <span className="text-red-600">{g.failed}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : trackingDaysStats.isLoading ? (
          <div className="text-gray-400">載入中...</div>
        ) : (
          <div className="text-gray-400 text-sm">尚無已完成週期檢視的分析</div>
        )}
      </div>
    </div>
  );
}
