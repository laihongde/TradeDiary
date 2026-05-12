import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { exportAllAsBlob, importAll, type ImportResult, type MergeStrategy } from "../db/backup";
import { clearAllData } from "../db/schema";
import { Btn, Section } from "./ui";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function BackupPage() {
  const qc = useQueryClient();
  const [strategy, setStrategy] = useState<MergeStrategy>("skipDuplicates");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  async function handleExport() {
    const blob = await exportAllAsBlob();
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    downloadBlob(blob, `stock-analysis-backup-${stamp}.json`);
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const result = await importAll(text, strategy);
      setImportResult(result);
      qc.invalidateQueries();
    } finally {
      setImporting(false);
    }
  }

  async function handleClear() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    if (!window.confirm("再次確認：將永久刪除本機所有分析紀錄與設定，建議先匯出備份。")) {
      setConfirmClear(false);
      return;
    }
    await clearAllData();
    setConfirmClear(false);
    qc.invalidateQueries();
    alert("本機資料已清除");
  }

  return (
    <div className="space-y-6">
      <Section title="匯出備份">
        <p className="mb-3 text-sm text-gray-600">
          將所有分析紀錄與來源資訊匯出為 JSON 檔案，可儲存到雲端硬碟或其他裝置。建議定期匯出。
        </p>
        <Btn variant="primary" onClick={handleExport}>
          匯出 JSON
        </Btn>
      </Section>

      <Section title="匯入備份">
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <label className="font-medium text-gray-700">重複資料策略：</label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={strategy === "skipDuplicates"}
                onChange={() => setStrategy("skipDuplicates")}
              />
              略過重複（建議）
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={strategy === "overwrite"}
                onChange={() => setStrategy("overwrite")}
              />
              覆寫
            </label>
          </div>
          <input
            type="file"
            accept=".json,application/json"
            disabled={importing}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = "";
            }}
            className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
          {importing && <p className="text-sm text-gray-500">匯入中…</p>}
          {importResult && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <div>新增：{importResult.inserted}</div>
              <div>略過重複：{importResult.skipped}</div>
              <div>覆寫：{importResult.overwritten}</div>
              {importResult.errors.length > 0 && (
                <div className="mt-1 text-red-600">錯誤：{importResult.errors.join("; ")}</div>
              )}
            </div>
          )}
        </div>
      </Section>

      <Section title="清除本機資料">
        <p className="mb-3 text-sm text-gray-600">
          將永久刪除本機所有分析紀錄、provider 健康紀錄與設定。<strong>此動作無法復原</strong>，請先匯出備份。
        </p>
        <Btn variant="danger" onClick={handleClear}>
          {confirmClear ? "請再點一次以確認" : "清除本機資料"}
        </Btn>
        {confirmClear && (
          <Btn className="ml-2" onClick={() => setConfirmClear(false)}>
            取消
          </Btn>
        )}
      </Section>
    </div>
  );
}
