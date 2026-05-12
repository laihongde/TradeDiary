import { useQuery } from "@tanstack/react-query";
import { listProviderHealth } from "../db/settings";
import { fetchLatest } from "../providers/dispatcher";
import type { ProviderHealthEntry, ProviderId } from "../types";
import { Btn, Section, Table, Td, Th } from "./ui";

const PROVIDER_LABEL: Record<ProviderId, string> = {
  finmind: "FinMind（主）",
  twse: "TWSE OpenAPI（上市備援）",
  tpex: "TPEx OpenAPI（上櫃備援）",
  manual: "手動輸入",
  mock: "Mock（開發測試）",
};

function formatTime(iso?: string): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("zh-TW", { hour12: false });
}

export function DataSourceStatus() {
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["providerHealth"],
    queryFn: () => listProviderHealth(),
  });

  async function runTest() {
    // 用 2330 跑一次 fetchLatest，會觸發整條 chain 並更新 providerHealth
    await fetchLatest("2330").catch(() => {});
    refetch();
  }

  return (
    <Section
      title="資料來源狀態"
      actions={
        <Btn onClick={runTest} disabled={isFetching}>
          測試連線（使用 2330）
        </Btn>
      }
    >
      <p className="mb-3 text-sm text-gray-600">
        系統依照
        <strong> FinMind → TWSE → TPEx → 手動 </strong>
        的順序嘗試取得價格。第一個成功的 provider 將被使用，其餘將被略過。
      </p>
      <Table>
        <thead>
          <tr>
            <Th>Provider</Th>
            <Th>最近成功</Th>
            <Th>最近失敗</Th>
            <Th>失敗原因</Th>
            <Th>成功 / 失敗次數</Th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((entry: ProviderHealthEntry) => (
            <tr key={entry.providerId} className="border-t border-gray-100">
              <Td className="font-medium">{PROVIDER_LABEL[entry.providerId]}</Td>
              <Td>{formatTime(entry.lastSuccessAt)}</Td>
              <Td>{formatTime(entry.lastFailureAt)}</Td>
              <Td className="max-w-[260px] truncate text-gray-500">
                {entry.lastFailureReason ?? "-"}
              </Td>
              <Td>
                <span className="text-green-600">{entry.successCount}</span>
                {" / "}
                <span className="text-red-600">{entry.failureCount}</span>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Section>
  );
}
