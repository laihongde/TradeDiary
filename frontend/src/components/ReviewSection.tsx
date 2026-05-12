import { format, parseISO } from "date-fns";
import { Pencil, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useDeleteAnalysis, useFetchReview, useRefreshLatest, useReviewAnalyses } from "../hooks/useAnalyses";
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

function daysSince(analysisDate: string): number {
  const d = new Date(analysisDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / 86400000);
}

function ReviewRow({ analysis }: { analysis: StockAnalysis }) {
  const refreshLatest = useRefreshLatest();
  const fetchReview = useFetchReview();
  const deleteAnalysis = useDeleteAnalysis();
  const [editing, setEditing] = useState(false);

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
  return (
    <Table>
      <thead>
        <tr>
          <Th>股票</Th>
          <Th>分析日</Th>
          <Th>結算日</Th>
          <Th>方向</Th>
          <Th>分析價</Th>
          <Th>結算價</Th>
          <Th>結算報酬</Th>
          <Th>結果</Th>
          <Th>最新價</Th>
          <Th>後續報酬</Th>
          <Th>天數</Th>
          <Th>經過交易日</Th>
          <Th>狀態</Th>
          <Th>備註</Th>
          <Th>操作</Th>
        </tr>
      </thead>
      <tbody>
        {analyses.map((a) => (
          <ReviewRow key={a.id} analysis={a} />
        ))}
      </tbody>
    </Table>
  );
}

export function ReviewSection() {
  const { data, isLoading } = useReviewAnalyses();

  const reviewed = data?.filter((a) => a.status === "REVIEWED") ?? [];
  const tracking = data?.filter((a) => a.status === "TRACKING") ?? [];

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-4">
      <Section title={`結算檢視區 (${reviewed.length})`}>
        {!reviewed.length ? (
          <Empty message="尚無完成結算檢視的分析" />
        ) : (
          <ReviewTable analyses={reviewed} />
        )}
      </Section>
      {tracking.length > 0 && (
        <Section title={`後續追蹤區 (${tracking.length})`}>
          <ReviewTable analyses={tracking} />
        </Section>
      )}
    </div>
  );
}
