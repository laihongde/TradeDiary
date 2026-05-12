import { format, parseISO } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useDeleteAnalysis, useErrorAnalyses, useRetrySnapshot } from "../hooks/useAnalyses";
import type { ManualField } from "../api/client";
import type { StockAnalysis } from "../types";
import { EditAnalysisModal } from "./EditAnalysisModal";
import { ManualPriceModal } from "./ManualPriceModal";
import { Btn, Empty, Loading, Section, Table, Td, Th } from "./ui";

function pickMissingField(a: StockAnalysis): ManualField {
  if (a.analysisPrice == null) return "analysisPrice";
  if (a.reviewPrice == null) return "reviewPrice";
  return "latestPrice";
}

function ErrorRow({ analysis }: { analysis: StockAnalysis }) {
  const retry = useRetrySnapshot();
  const deleteAnalysis = useDeleteAnalysis();
  const [editing, setEditing] = useState(false);
  const [manualField, setManualField] = useState<ManualField | null>(null);

  function handleDelete() {
    if (window.confirm(`確定要刪除 ${analysis.symbol} (${analysis.analysisDate.split("T")[0]}) 的分析紀錄嗎？`)) {
      deleteAnalysis.mutate(analysis.id);
    }
  }

  return (
    <>
      {editing && <EditAnalysisModal analysis={analysis} onClose={() => setEditing(false)} />}
      {manualField && (
        <ManualPriceModal
          analysis={analysis}
          field={manualField}
          attemptsNote={analysis.dataSourceNote}
          onClose={() => setManualField(null)}
        />
      )}
      <tr className="border-t border-gray-100 hover:bg-gray-50">
        <Td>
          <div className="font-semibold">{analysis.symbol}</div>
        </Td>
        <Td>{format(parseISO(analysis.analysisDate), "yyyy/MM/dd")}</Td>
        <Td className="max-w-[300px] text-sm text-red-600">
          {analysis.dataSourceNote ?? "未知錯誤"}
        </Td>
        <Td>
          <div className="flex items-center gap-1">
            <Btn size="xs" variant="primary" disabled={retry.isPending} onClick={() => retry.mutate(analysis.id)}>
              重新抓取
            </Btn>
            <Btn size="xs" onClick={() => setManualField(pickMissingField(analysis))}>
              手動補價
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

export function ErrorList() {
  const { data, isLoading } = useErrorAnalyses();

  return (
    <Section title={`資料錯誤清單 ${data ? `(${data.length})` : ""}`}>
      {isLoading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty message="目前沒有資料錯誤的紀錄" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>股票</Th>
              <Th>分析日</Th>
              <Th>錯誤說明</Th>
              <Th>操作</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <ErrorRow key={a.id} analysis={a} />
            ))}
          </tbody>
        </Table>
      )}
    </Section>
  );
}
