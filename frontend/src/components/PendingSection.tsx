import { format, parseISO } from "date-fns";
import { ChevronDown, ChevronUp, ChevronsUpDown, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  useDeleteAnalysis,
  useFetchReview,
  usePendingAnalyses,
  useRefreshAllLatest,
  useRefreshLatest,
  useUpdateStatuses,
} from "../hooks/useAnalyses";
import type { StockAnalysis } from "../types";
import { EditAnalysisModal } from "./EditAnalysisModal";
import {
  Btn,
  DirectionBadge,
  Empty,
  Loading,
  ReturnBadge,
  Section,
  StatusBadge,
  Table,
  Td,
  Th,
} from "./ui";
import {
  getReviewDate as calcReviewDate,
  parseIsoDate,
  toIsoDate,
} from "../services/tradingDays";

type SortKey = "date" | "return" | "price" | "latestPrice";
type SortDir = "asc" | "desc";

function daysUntilReview(analysisDate: string, n: number): number {
  const reviewDate = calcReviewDate(analysisDate, n);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reviewD = parseIsoDate(reviewDate);
  return Math.ceil((reviewD.getTime() - today.getTime()) / 86400000);
}

/** 結算日已過，或結算日當天已超過 18:00（台北時間）*/
function isPastCutoff(analysisDate: string, n: number): boolean {
  const reviewDate = calcReviewDate(analysisDate, n);
  const reviewD = parseIsoDate(reviewDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (reviewD < today) return true;
  if (reviewD.getTime() === today.getTime()) {
    const taipeiHour = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" })
    ).getHours();
    return taipeiHour >= 18;
  }
  return false;
}

function sortAnalyses(list: StockAnalysis[], key: SortKey, dir: SortDir): StockAnalysis[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    if (key === "date") {
      return mul * a.analysisDate.localeCompare(b.analysisDate);
    }
    if (key === "return") {
      const av = a.latestReturn != null ? Number(a.latestReturn) : -Infinity;
      const bv = b.latestReturn != null ? Number(b.latestReturn) : -Infinity;
      return mul * (av - bv);
    }
    if (key === "price") {
      const av = a.analysisPrice != null ? Number(a.analysisPrice) : -Infinity;
      const bv = b.analysisPrice != null ? Number(b.analysisPrice) : -Infinity;
      return mul * (av - bv);
    }
    if (key === "latestPrice") {
      const av = a.latestPrice != null ? Number(a.latestPrice) : -Infinity;
      const bv = b.latestPrice != null ? Number(b.latestPrice) : -Infinity;
      return mul * (av - bv);
    }
    return 0;
  });
}

// suppress unused import warning – toIsoDate used indirectly via calcReviewDate
void toIsoDate;

function PendingCard({ analysis }: { analysis: StockAnalysis }) {
  const fetchReview = useFetchReview();
  const refreshLatest = useRefreshLatest();
  const deleteAnalysis = useDeleteAnalysis();
  const [editing, setEditing] = useState(false);
  const n = analysis.trackingTradingDays ?? 5;
  const remaining = daysUntilReview(analysis.analysisDate, n);
  const canReview = isPastCutoff(analysis.analysisDate, n);

  function handleDelete() {
    if (window.confirm(`確定要刪除 ${analysis.symbol} (${analysis.analysisDate.split("T")[0]}) 的分析紀錄嗎？`)) {
      deleteAnalysis.mutate(analysis.id);
    }
  }

  return (
    <>
      {editing && <EditAnalysisModal analysis={analysis} onClose={() => setEditing(false)} />}
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
        {/* 股票名稱 + 方向 + 狀態 */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-gray-900">{analysis.symbol}</span>
            {analysis.stockName && (
              <span className="ml-1.5 text-xs text-gray-500">{analysis.stockName}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <DirectionBadge direction={analysis.direction} />
            <StatusBadge status={analysis.status} />
          </div>
        </div>
        {/* 日期 + 追蹤 + 距結算 */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
          <span>分析日 {format(parseISO(analysis.analysisDate), "MM/dd")}</span>
          <span>追蹤 {n} 日</span>
          <span>
            {remaining > 0 ? (
              <span className="text-blue-600">{remaining} 天後結算</span>
            ) : canReview ? (
              <span className="font-medium text-amber-600">可結算</span>
            ) : (
              <span>今日 18:00 後</span>
            )}
          </span>
        </div>
        {/* 價格 */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="text-gray-500">
            分析價 <span className="font-medium text-gray-800">{analysis.analysisPrice != null ? Number(analysis.analysisPrice).toFixed(2) : "-"}</span>
          </span>
          <span className="text-gray-500">
            最新 <span className="font-medium text-gray-800">{analysis.latestPrice != null ? Number(analysis.latestPrice).toFixed(2) : "-"}</span>
          </span>
          <span className="text-gray-500">
            浮動 <ReturnBadge value={analysis.latestReturn != null ? Number(analysis.latestReturn) : null} />
          </span>
        </div>
        {/* 備註 */}
        {analysis.notes && (
          <div className="truncate text-xs text-gray-400">備註: {analysis.notes}</div>
        )}
        {/* 操作按鈕 */}
        <div className="flex items-center gap-1.5 pt-1">
          {analysis.status === "READY_TO_REVIEW" && (
            <Btn
              size="xs"
              variant="primary"
              disabled={fetchReview.isPending || !canReview}
              title={!canReview ? "請結算日 18:00 後再取" : undefined}
              onClick={() => fetchReview.mutate(analysis.id)}
            >
              取結算價
            </Btn>
          )}
          <Btn size="xs" variant="ghost" onClick={() => refreshLatest.mutate(analysis.id)} disabled={refreshLatest.isPending}>
            <RefreshCw size={12} />
          </Btn>
          <Btn size="xs" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil size={12} />
          </Btn>
          <Btn size="xs" variant="ghost" onClick={handleDelete} disabled={deleteAnalysis.isPending}
            className="text-red-500 hover:bg-red-50">
            <Trash2 size={12} />
          </Btn>
        </div>
      </div>
    </>
  );
}

function PendingRow({ analysis }: { analysis: StockAnalysis }) {
  const fetchReview = useFetchReview();
  const refreshLatest = useRefreshLatest();
  const deleteAnalysis = useDeleteAnalysis();
  const [editing, setEditing] = useState(false);
  const n = analysis.trackingTradingDays ?? 5;
  const remaining = daysUntilReview(analysis.analysisDate, n);
  const canReview = isPastCutoff(analysis.analysisDate, n);

  function handleDelete() {
    if (window.confirm(`確定要刪除 ${analysis.symbol} (${analysis.analysisDate.split("T")[0]}) 的分析紀錄嗎？`)) {
      deleteAnalysis.mutate(analysis.id);
    }
  }

  return (
    <>
      {editing && <EditAnalysisModal analysis={analysis} onClose={() => setEditing(false)} />}
      <tr className="border-t border-gray-100 hover:bg-gray-50">
        <Td>
          <div className="font-semibold">{analysis.symbol}</div>
          {analysis.stockName && (
            <div className="text-xs text-gray-500">{analysis.stockName}</div>
          )}
        </Td>
        <Td>{format(parseISO(analysis.analysisDate), "MM/dd")}</Td>
        <Td>
          <DirectionBadge direction={analysis.direction} />
        </Td>
        <Td className="text-right">
          {analysis.analysisPrice != null ? Number(analysis.analysisPrice).toFixed(2) : "-"}
        </Td>
        <Td className="text-right">
          {analysis.latestPrice != null ? Number(analysis.latestPrice).toFixed(2) : "-"}
        </Td>
        <Td className="text-right">
          <ReturnBadge value={analysis.latestReturn != null ? Number(analysis.latestReturn) : null} />
        </Td>
        <Td>
          {remaining > 0 ? (
            <span className="text-blue-600">{remaining} 天後</span>
          ) : canReview ? (
            <span className="font-medium text-amber-600">可檢視</span>
          ) : (
            <span className="text-gray-400">今日 18:00 後</span>
          )}
        </Td>
        <Td>
          <span className="text-xs text-gray-500">追蹤 {n} 日</span>
        </Td>
        <Td>
          <StatusBadge status={analysis.status} />
        </Td>
        <Td className="max-w-[160px] truncate text-gray-500">{analysis.notes ?? "-"}</Td>
        <Td>
          <div className="flex items-center gap-1">
            {analysis.status === "READY_TO_REVIEW" && (
              <Btn
                size="xs"
                variant="primary"
                disabled={fetchReview.isPending || !canReview}
                title={!canReview ? "請結算日 18:00 後再取" : undefined}
                onClick={() => fetchReview.mutate(analysis.id)}
              >
                取結算價
              </Btn>
            )}
            <Btn size="xs" variant="ghost" onClick={() => refreshLatest.mutate(analysis.id)} disabled={refreshLatest.isPending}>
              <RefreshCw size={12} />
            </Btn>
            <Btn size="xs" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil size={12} />
            </Btn>
            <Btn size="xs" variant="ghost" onClick={handleDelete} disabled={deleteAnalysis.isPending}
              className="text-red-500 hover:bg-red-50">
              <Trash2 size={12} />
            </Btn>
          </div>
        </Td>
      </tr>
    </>
  );
}

export function PendingSection() {
  const { data, isLoading } = usePendingAnalyses();
  const updateStatuses = useUpdateStatuses();
  const refreshAll = useRefreshAllLatest();

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "desc");
    }
  }

  const sorted = useMemo(
    () => sortAnalyses(data ?? [], sortKey, sortDir),
    [data, sortKey, sortDir]
  );

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronsUpDown size={12} className="ml-0.5 inline opacity-40" />;
    return sortDir === "asc"
      ? <ChevronUp size={12} className="ml-0.5 inline text-blue-500" />
      : <ChevronDown size={12} className="ml-0.5 inline text-blue-500" />;
  }

  return (
    <Section
      title={`待追蹤區 ${data ? `(${data.length})` : ""}`}
      actions={
        <div className="flex gap-1">
          <Btn size="xs" onClick={() => refreshAll.mutate()} disabled={refreshAll.isPending}>
            {refreshAll.isPending ? "刷新中…" : "全部刷新最新價"}
          </Btn>
          <Btn size="xs" onClick={() => updateStatuses.mutate()} disabled={updateStatuses.isPending}>
            更新狀態
          </Btn>
        </div>
      }
    >
      {isLoading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty message="目前沒有待追蹤的分析" />
      ) : (
        <>
          {/* 手機排序列 */}
          <div className="mb-2 flex items-center gap-2 sm:hidden">
            <span className="text-xs text-gray-500 dark:text-gray-400">排序：</span>
          {(["日期", "報酬", "分析價", "最新價"] as const).map((label) => {
            const keyMap: Record<string, SortKey> = { "日期": "date", "報酬": "return", "分析價": "price", "最新價": "latestPrice" };
            const k = keyMap[label];
              const active = sortKey === k;
              return (
                <button
                  key={k}
                  onClick={() => handleSort(k)}
                  className={`flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-blue-500 bg-blue-500 text-white"
                      : "border-gray-300 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {label}
                  {active && (sortDir === "asc"
                    ? <ChevronUp size={11} className="ml-0.5" />
                    : <ChevronDown size={11} className="ml-0.5" />)}
                </button>
              );
            })}
          </div>
          {/* 手機卡片 */}
          <div className="space-y-2 sm:hidden">
            {sorted.map((a) => (
              <PendingCard key={a.id} analysis={a} />
            ))}
          </div>
          {/* 桌面表格 */}
          <div className="hidden sm:block">
            <Table>
              <thead>
                <tr>
                  <Th>股票</Th>
                  <Th
                    className="cursor-pointer select-none hover:text-blue-600"
                    onClick={() => handleSort("date")}
                  >
                    分析日<SortIcon k="date" />
                  </Th>
                  <Th>方向</Th>
                  <Th
                    className="cursor-pointer select-none text-right hover:text-blue-600"
                    onClick={() => handleSort("price")}
                  >
                    分析價<SortIcon k="price" />
                  </Th>
                  <Th
                    className="cursor-pointer select-none text-right hover:text-blue-600"
                    onClick={() => handleSort("latestPrice")}
                  >
                    最新價<SortIcon k="latestPrice" />
                  </Th>
                  <Th
                    className="cursor-pointer select-none text-right hover:text-blue-600"
                    onClick={() => handleSort("return")}
                  >
                    浮動報酬<SortIcon k="return" />
                  </Th>
                  <Th>距結算日</Th>
                  <Th>追蹤週期</Th>
                  <Th>狀態</Th>
                  <Th>備註</Th>
                  <Th>操作</Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => (
                  <PendingRow key={a.id} analysis={a} />
                ))}
              </tbody>
            </Table>
          </div>
        </>
      )}
    </Section>
  );
}
