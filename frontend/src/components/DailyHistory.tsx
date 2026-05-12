import { useState } from "react";
import { useDailyRecords } from "../hooks/useAnalyses";
import { Empty, Loading, ReturnBadge } from "./ui";

export function DailyHistory() {
  const [days, setDays] = useState(30);
  const today = new Date().toISOString().split("T")[0];
  const fromDate = new Date(Date.now() - days * 86400000)
    .toISOString()
    .split("T")[0];

  const { data, isLoading } = useDailyRecords(fromDate, today);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">顯示最近</span>
        {[7, 14, 30, 60, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
              days === d
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {d} 天
          </button>
        ))}
      </div>

      {isLoading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty message="此區間無分析紀錄" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-4 sm:py-3">
                  日期
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-4 sm:py-3">
                  股票
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-4 sm:py-3">
                  筆數
                </th>
                <th className="hidden px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell sm:px-4 sm:py-3">
                  已完成檢視
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-4 sm:py-3">
                  勝率
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-4 sm:py-3">
                  平均報酬
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((rec) => (
                <tr
                  key={rec.date}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2 font-medium text-gray-700 sm:px-4">
                    {rec.date}
                  </td>
                  <td className="px-3 py-2 sm:px-4">
                    <div className="flex flex-wrap gap-1">
                      {rec.symbols.map((sym) => (
                        <span
                          key={sym}
                          className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                        >
                          {sym}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right sm:px-4">{rec.count}</td>
                  <td className="hidden px-3 py-2 text-right sm:table-cell sm:px-4">
                    {rec.completed_reviews}
                  </td>
                  <td className="px-3 py-2 text-right sm:px-4">
                    {rec.win_rate != null ? (
                      <span
                        className={
                          rec.win_rate >= 50
                            ? "font-semibold text-green-600"
                            : "font-semibold text-red-600"
                        }
                      >
                        {rec.win_rate.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right sm:px-4">
                    <ReturnBadge value={rec.avg_return} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
