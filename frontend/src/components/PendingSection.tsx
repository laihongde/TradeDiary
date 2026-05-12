import { format, parseISO } from "date-fns";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
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

// suppress unused import warning – toIsoDate used indirectly via calcReviewDate
void toIsoDate;

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
        <Table>
          <thead>
            <tr>
              <Th>股票</Th>
              <Th>分析日</Th>
              <Th>方向</Th>
              <Th>分析價</Th>
              <Th>最新價</Th>
              <Th>浮動報酬</Th>
              <Th>距結算日</Th>
              <Th>追蹤週期</Th>
              <Th>狀態</Th>
              <Th>備註</Th>
              <Th>操作</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <PendingRow key={a.id} analysis={a} />
            ))}
          </tbody>
        </Table>
      )}
    </Section>
  );
}
