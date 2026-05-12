import { useState } from "react";
import { AddAnalysisForm } from "./components/AddAnalysisForm";
import { BackupPage } from "./components/BackupPage";
import { DailyHistory } from "./components/DailyHistory";
import { Dashboard } from "./components/Dashboard";
import { DataSourceStatus } from "./components/DataSourceStatus";
import { ErrorList } from "./components/ErrorList";
import { LocalOnlyNotice } from "./components/LocalOnlyNotice";
import { PendingSection } from "./components/PendingSection";
import { ReviewSection } from "./components/ReviewSection";
import { StockHistory } from "./components/StockHistory";
import { useRefreshAllLatest, useUpdateStatuses } from "./hooks/useAnalyses";

type Tab =
  | "today"
  | "pending"
  | "review"
  | "dashboard"
  | "daily"
  | "stock"
  | "errors"
  | "backup"
  | "sources";

const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "今日新增" },
  { id: "pending", label: "待追蹤" },
  { id: "review", label: "一週檢視" },
  { id: "dashboard", label: "統計儀表板" },
  { id: "daily", label: "每日紀錄" },
  { id: "stock", label: "個股查詢" },
  { id: "errors", label: "資料錯誤" },
  { id: "backup", label: "備份匯出" },
  { id: "sources", label: "資料來源" },
];

function TopBar() {
  const refreshAll = useRefreshAllLatest();
  const updateStatuses = useUpdateStatuses();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => {
          updateStatuses.mutate();
          refreshAll.mutate();
        }}
        disabled={refreshAll.isPending || updateStatuses.isPending}
        className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50"
      >
        {refreshAll.isPending ? "更新中..." : "↻ 全部更新"}
      </button>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("today");

  return (
    <div className="min-h-screen bg-gray-50">
      <LocalOnlyNotice />

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center justify-between py-3">
            <h1 className="text-lg font-bold text-gray-900">
              股票分析練習紀錄
              <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 align-middle text-xs font-medium text-blue-600">
                Local-first
              </span>
            </h1>
            <TopBar />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        {tab === "today" && (
          <div className="space-y-6">
            <AddAnalysisForm />
          </div>
        )}
        {tab === "pending" && <PendingSection />}
        {tab === "review" && <ReviewSection />}
        {tab === "dashboard" && <Dashboard />}
        {tab === "daily" && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              每日分析紀錄
            </h2>
            <DailyHistory />
          </div>
        )}
        {tab === "stock" && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              個股歷史分析
            </h2>
            <StockHistory />
          </div>
        )}
        {tab === "errors" && <ErrorList />}
        {tab === "backup" && <BackupPage />}
        {tab === "sources" && <DataSourceStatus />}
      </main>
    </div>
  );
}
