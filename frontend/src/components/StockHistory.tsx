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
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-1 text-sm text-gray-500">{card.label}</div>
                <div className="text-2xl font-bold text-gray-800">
                  {card.value}
                </div>
                {"sub" in card && card.sub && (
                  <div className="mt-1 text-xs text-gray-400">{card.sub}</div>
                )}
              </div>
            ))}
          </div>

          {/* 歷史紀錄表 */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-4 sm:py-3">
                    分析日期
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-4 sm:py-3">
                    方向
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-4 sm:py-3">
                    分析價
                  </th>
                  <th className="hidden px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell sm:px-4 sm:py-3">
                    結算價
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-4 sm:py-3">
                    週期報酬
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-4 sm:py-3">
                    結果
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.analyses.map((a) => (
                  <tr
                    key={a.id}
                    className="border-t border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-3 py-2 sm:px-4">{a.analysisDate}</td>
                    <td className="px-3 py-2 sm:px-4">
                      {a.direction === "BULLISH" ? (
                        <span className="text-green-600">▲ 看多</span>
                      ) : (
                        <span className="text-red-600">▼ 看空</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right sm:px-4">
                      {a.analysisPrice?.toFixed(2) ?? "-"}
                    </td>
                    <td className="hidden px-3 py-2 text-right sm:table-cell sm:px-4">
                      {a.reviewPrice?.toFixed(2) ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-right sm:px-4">
                      <ReturnBadge value={a.weekReturn} />
                    </td>
                    <td className="px-3 py-2 text-center sm:px-4">
                      {a.weekReturn != null ? (
                        <SuccessBadge value={a.isSuccess} />
                      ) : (
                        <span className="text-xs text-gray-400">
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
