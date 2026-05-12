import { format, parseISO } from "date-fns";
import { ChevronDown, ChevronUp, ChevronsUpDown, Pencil, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useDeleteAnalysis, useFetchReview, useRefreshLatest, useReviewAnalyses } from "../hooks/useAnalyses";
import { getReviewDate as calcReviewDate, parseIsoDate } from "../services/tradingDays";
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
  SuccessBadge,
  Table,
  Td,
  Th,
} from "./ui";

type SortKey = "date" | "return" | "price" | "latestPrice";
type SortDir = "asc" | "desc";

function sortAnalyses(list: StockAnalysis[], key: SortKey, dir: SortDir): StockAnalysis[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    if (key === "date") return mul * a.analysisDate.localeCompare(b.analysisDate);
    if (key === "return") {
      const av = a.weekReturn != null ? Number(a.weekReturn) : -Infinity;
      const bv = b.weekReturn != null ? Number(b.weekReturn) : -Infinity;
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

function daysSince(analysisDate: string): number {
  const d = new Date(analysisDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / 86400000);
}

function ReviewCard({ analysis }: { analysis: StockAnalysis }) {
  const refreshLatest = useRefreshLatest();
  const fetchReview = useFetchReview();
  const deleteAnalysis = useDeleteAnalysis();
  const [editing, setEditing] = useState(false);
  const n = analysis.trackingTradingDays ?? 5;
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
        {/* 股票名稱 + 方向 + 結果 + 狀態 */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-gray-900">{analysis.symbol}</span>
            {analysis.stockName && (
              <span className="ml-1.5 text-xs text-gray-500">{analysis.stockName}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            <DirectionBadge direction={analysis.direction} />
            <SuccessBadge value={analysis.isSuccess} />
            <StatusBadge status={analysis.status} />
          </div>
        </div>
        {/* 日期 + 追蹤 */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
          <span>分析日 {format(parseISO(analysis.analysisDate), "MM/dd")}</span>
          {analysis.reviewActualDate && (
            <span>結算日 {format(parseISO(analysis.reviewActualDate), "MM/dd")}</span>
          )}
          <span>追蹤 {analysis.trackingTradingDays ?? 5} 日</span>
        </div>
        {/* 週期價格 */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="text-gray-500">
            分析價 <span className="font-medium text-gray-800">{analysis.analysisPrice != null ? Number(analysis.analysisPrice).toFixed(2) : "-"}</span>
          </span>
          <span className="text-gray-500">
            結算價 <span className="font-medium text-gray-800">{analysis.reviewPrice != null ? Number(analysis.reviewPrice).toFixed(2) : "-"}</span>
          </span>
          <span className="text-gray-500">
            週期 <ReturnBadge value={analysis.weekReturn != null ? Number(analysis.weekReturn) : null} />
          </span>
        </div>
        {/* 後續數據 */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="text-gray-500">
            最新 <span className="font-medium text-gray-800">{analysis.latestPrice != null ? Number(analysis.latestPrice).toFixed(2) : "-"}</span>
          </span>
          <span className="text-gray-500">
            後續 <ReturnBadge value={analysis.latestReturn != null ? Number(analysis.latestReturn) : null} />
          </span>
          <span className="text-gray-500">
            {daysSince(analysis.analysisDate)} 天
            {analysis.elapsedTradingDays != null ? ` / ${analysis.elapsedTradingDays} 交易日` : ""}
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
          {analysis.status === "REVIEWED" && (
            <Btn
              size="xs"
              variant="ghost"
              title="重取結算價（修正假日偏差）"
              disabled={fetchReview.isPending}
              onClick={() => fetchReview.mutate(analysis.id)}
            >
              <RotateCcw size={12} />
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

function ReviewRow({ analysis }: { analysis: StockAnalysis }) {
  const refreshLatest = useRefreshLatest();
  const fetchReview = useFetchReview();
  const deleteAnalysis = useDeleteAnalysis();
  const [editing, setEditing] = useState(false);
  const n = analysis.trackingTradingDays ?? 5;
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
          {analysis.reviewActualDate
            ? format(parseISO(analysis.reviewActualDate), "MM/dd")
            : "-"}
        </Td>
        <Td>
          <DirectionBadge direction={analysis.direction} />
        </Td>
        <Td className="text-right">
          {analysis.analysisPrice != null ? Number(analysis.analysisPrice).toFixed(2) : "-"}
        </Td>
        <Td className="text-right">
          {analysis.reviewPrice != null ? Number(analysis.reviewPrice).toFixed(2) : "-"}
        </Td>
        <Td className="text-right">
          <ReturnBadge value={analysis.weekReturn != null ? Number(analysis.weekReturn) : null} />
        </Td>
        <Td>
          <SuccessBadge value={analysis.isSuccess} />
        </Td>
        <Td className="text-xs text-gray-500">
          {analysis.trackingTradingDays ?? 5} 日
        </Td>
        <Td className="text-right">
          {analysis.latestPrice != null ? Number(analysis.latestPrice).toFixed(2) : "-"}
        </Td>
        <Td className="text-right">
          <ReturnBadge value={analysis.latestReturn != null ? Number(analysis.latestReturn) : null} />
        </Td>
        <Td>{daysSince(analysis.analysisDate)} 天</Td>
        <Td>
          {analysis.elapsedTradingDays != null
            ? `${analysis.elapsedTradingDays} 日`
            : "-"}
        </Td>
        <Td>
          <StatusBadge status={analysis.status} />
        </Td>
        <Td className="max-w-[140px] truncate text-gray-500">{analysis.notes ?? "-"}</Td>
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
            {analysis.status === "REVIEWED" && (
              <Btn
                size="xs"
                variant="ghost"
                title="重取結算價（修正假日偏差）"
                disabled={fetchReview.isPending}
                onClick={() => fetchReview.mutate(analysis.id)}
              >
                <RotateCcw size={12} />
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

function ReviewTable({ analyses }: { analyses: StockAnalysis[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = useMemo(
    () => sortAnalyses(analyses, sortKey, sortDir),
    [analyses, sortKey, sortDir]
  );

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronsUpDown size={12} className="ml-0.5 inline opacity-40" />;
    return sortDir === "asc"
      ? <ChevronUp size={12} className="ml-0.5 inline text-blue-500" />
      : <ChevronDown size={12} className="ml-0.5 inline text-blue-500" />;
  }

  return (
    <>
      {/* 手機排序列 */}
      <div className="mb-2 flex items-center gap-2 sm:hidden">
        <span className="text-xs text-gray-500 dark:text-gray-400">排序：</span>
        {([["日期", "date"], ["報酬", "return"], ["分析價", "price"], ["最新價", "latestPrice"]] as [string, SortKey][]).map(([label, k]) => {
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
          <ReviewCard key={a.id} analysis={a} />
        ))}
      </div>
      {/* 桌面表格 */}
      <div className="hidden sm:block">
        <Table>
          <thead>
            <tr>
              <Th>股票</Th>
              <Th className="cursor-pointer select-none hover:text-blue-600" onClick={() => handleSort("date")}>分析日<SortIcon k="date" /></Th>
              <Th>結算日</Th>
              <Th>方向</Th>
              <Th className="cursor-pointer select-none text-right hover:text-blue-600" onClick={() => handleSort("price")}>分析價<SortIcon k="price" /></Th>
              <Th>結算價</Th>
              <Th className="cursor-pointer select-none text-right hover:text-blue-600" onClick={() => handleSort("return")}>週期報酬<SortIcon k="return" /></Th>
              <Th>結果</Th>
              <Th>追蹤週期</Th>
              <Th className="cursor-pointer select-none text-right hover:text-blue-600" onClick={() => handleSort("latestPrice")}>最新價<SortIcon k="latestPrice" /></Th>
              <Th>後續報酬</Th>
              <Th>天數</Th>
              <Th>經過交易日</Th>
              <Th>狀態</Th>
              <Th>備註</Th>
              <Th>操作</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => (
              <ReviewRow key={a.id} analysis={a} />
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
}

export function ReviewSection() {
  const { data, isLoading } = useReviewAnalyses();

  const readyToReview = data?.filter((a) => a.status === "READY_TO_REVIEW") ?? [];
  const tracking = data?.filter((a) => a.status === "REVIEWED" || a.status === "TRACKING") ?? [];

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-4">
      <Section title={`結算檢視區 (${readyToReview.length})`}>
        {!readyToReview.length ? (
          <Empty message="目前沒有待結算的分析" />
        ) : (
          <ReviewTable analyses={readyToReview} />
        )}
      </Section>
      <Section title={`後續追蹤區 (${tracking.length})`}>
        {!tracking.length ? (
          <Empty message="尚無已結算或追蹤中的分析" />
        ) : (
          <ReviewTable analyses={tracking} />
        )}
      </Section>
    </div>
  );
}
