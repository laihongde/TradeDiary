import { useCallback, useEffect, useState } from "react";
import { AddAnalysisForm } from "./components/AddAnalysisForm";
import { BackupPage } from "./components/BackupPage";
import { DailyHistory } from "./components/DailyHistory";
import { Dashboard } from "./components/Dashboard";
import { DataSourceStatus } from "./components/DataSourceStatus";
import { ErrorList } from "./components/ErrorList";
import { LocalOnlyNotice } from "./components/LocalOnlyNotice";
import { PendingSection } from "./components/PendingSection";
import { ReviewSection } from "./components/ReviewSection";
import { SplashScreen } from "./components/SplashScreen";
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

function TopBar({ dark, onToggleDark }: { dark: boolean; onToggleDark: () => void }) {
  const refreshAll = useRefreshAllLatest();
  const updateStatuses = useUpdateStatuses();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggleDark}
        className="theme-toggle"
        title={dark ? "切換亮色模式" : "切換暗色模式"}
      >
        {dark ? "☀ Light" : "🌙 Dark"}
      </button>
      <button
        onClick={() => {
          updateStatuses.mutate();
          refreshAll.mutate();
        }}
        disabled={refreshAll.isPending || updateStatuses.isPending}
        className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50 btn-ripple"
      >
        {refreshAll.isPending ? "更新中..." : "↻ 全部更新"}
      </button>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("today");
  const [tabKey, setTabKey] = useState(0);
  const [showSplash, setShowSplash] = useState(true);
  const [dark, setDark] = useState(true);

  // 預設 dark mode，套用到 <html>
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const handleTabChange = useCallback((t: Tab) => {
    setTab(t);
    setTabKey((k) => k + 1);
  }, []);

  return (
    <>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
    <div className="min-h-screen bg-gray-50">
      <LocalOnlyNotice />

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm header-tech">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center justify-between py-2 sm:py-3">
            <h1 className="text-base font-bold text-gray-900 sm:text-lg">
              股票分析練習紀錄
              <span className="ml-1.5 hidden rounded-full bg-blue-50 px-2 py-0.5 align-middle text-xs font-medium text-blue-600 sm:inline">
                Local-first
              </span>
            </h1>
            <TopBar dark={dark} onToggleDark={() => setDark((d) => !d)} />
          </div>

          {/* Tabs */}
          <div className="-mx-4 flex overflow-x-auto px-4 pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={`tab-indicator-animate shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:py-2.5 sm:text-sm ${
                  tab === t.id
                    ? "active border-blue-600 text-blue-600"
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
      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 scan-line">
        <div key={tabKey} className="tab-content-enter">
        {tab === "today" && (
          <div className="space-y-6">
            <AddAnalysisForm />
          </div>
        )}
        {tab === "pending" && <PendingSection />}
        {tab === "review" && <ReviewSection />}
        {tab === "dashboard" && <Dashboard />}
        {tab === "daily" && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 card-glow">
            <h2 className="mb-4 text-base font-semibold text-gray-800 sm:text-lg">
              每日分析紀錄
            </h2>
            <DailyHistory />
          </div>
        )}
        {tab === "stock" && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 card-glow">
            <h2 className="mb-4 text-base font-semibold text-gray-800 sm:text-lg">
              個股歷史分析
            </h2>
            <StockHistory />
          </div>
        )}
        {tab === "errors" && <ErrorList />}
        {tab === "backup" && <BackupPage />}
        {tab === "sources" && <DataSourceStatus />}
        </div>
      </main>
    </div>
    </>
  );
}
