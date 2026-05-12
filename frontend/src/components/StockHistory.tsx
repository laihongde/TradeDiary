import { useState } from "react";
import { useStockStats } from "../hooks/useAnalyses";
import { Empty, Loading, ReturnBadge, SuccessBadge } from "./ui";
import { CandlestickChart } from "./CandlestickChart";

export function StockHistory() {
  const [input, setInput] = useState("");
  const [queried, setQueried] = useState("");
  const { data, isLoading } = useStockStats(queried);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQueried(input.trim().toUpperCase());
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          placeholder="輸入股票代號 (如：2330)"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm uppercase placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          查詢
        </button>
      </form>

      {!queried ? null : isLoading ? (
        <Loading />
      ) : !data ? (
        <Empty message={`找不到 ${queried} 的分析紀錄`} />
      ) : (
        <div className="space-y-4">
          {/* K 線圖 */}
          <CandlestickChart symbol={queried} analyses={data.analyses} days={30} />

          {/* 個股統計 */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              {
                label: "分析次數",
                value: data.total_analyses,
              },
              {
                label: "勝率",
                value:
                  data.win_rate != null
                    ? `${data.win_rate.toFixed(1)}%`
                    : "-",
              },
              {
                label: "平均報酬",
                value:
                  data.avg_return != null
                    ? `${data.avg_return > 0 ? "+" : ""}${data.avg_return.toFixed(2)}%`
                    : "-",
              },
              {
                label: "最佳 / 最差",
                value:
                  data.best_return != null
                    ? `+${data.best_return.toFixed(2)}%`
                    : "-",
                sub:
                  data.worst_return != null
                    ? `最差 ${data.worst_return.toFixed(2)}%`
                    : undefined,
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="mb-1 text-sm text-gray-500 dark:text-gray-400">{card.label}</div>
                <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  {card.value}
                </div>
                {"sub" in card && card.sub && (
                  <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">{card.sub}</div>
                )}
              </div>
            ))}
          </div>

          {/* 歷史紀錄表 */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:px-4 sm:py-3">
                    分析日期
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:px-4 sm:py-3">
                    方向
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:px-4 sm:py-3">
                    分析價
                  </th>
                  <th className="hidden whitespace-nowrap px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:table-cell sm:px-4 sm:py-3">
                    結算價
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:px-4 sm:py-3">
                    週期報酬
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:px-4 sm:py-3">
                    結果
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.analyses.map((a) => (
                  <tr
                    key={a.id}
                    className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-gray-700 dark:text-gray-300 sm:px-4">{a.analysisDate}</td>
                    <td className="whitespace-nowrap px-3 py-2 sm:px-4">
                      {a.direction === "BULLISH" ? (
                        <span className="text-green-600 dark:text-green-400">▲ 看多</span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">▼ 看空</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-gray-700 dark:text-gray-300 sm:px-4">
                      {a.analysisPrice?.toFixed(2) ?? "-"}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2 text-right text-gray-700 dark:text-gray-300 sm:table-cell sm:px-4">
                      {a.reviewPrice?.toFixed(2) ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right sm:px-4">
                      <ReturnBadge value={a.weekReturn} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-center sm:px-4">
                      {a.weekReturn != null ? (
                        <SuccessBadge value={a.isSuccess} />
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {a.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
