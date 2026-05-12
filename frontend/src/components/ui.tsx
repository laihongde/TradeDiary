import type { ReactNode } from "react";
import type { AnalysisStatus, Direction } from "../types";

// ── 報酬率顯示 ────────────────────────────────────────────────────────────────

export function ReturnBadge({
  value,
  suffix = "%",
}: {
  value?: number | null;
  suffix?: string;
}) {
  if (value == null) return <span className="text-gray-400">-</span>;
  const positive = value > 0;
  const zero = value === 0;
  return (
    <span
      className={
        zero
          ? "text-gray-500"
          : positive
            ? "font-semibold text-green-600"
            : "font-semibold text-red-600"
      }
    >
      {positive ? "+" : ""}
      {value.toFixed(2)}
      {suffix}
    </span>
  );
}

// ── 成功/失敗標籤 ─────────────────────────────────────────────────────────────

export function SuccessBadge({ value }: { value?: boolean | null }) {
  if (value == null) return <span className="text-gray-400">-</span>;
  return value ? (
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
      成功
    </span>
  ) : (
    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
      失敗
    </span>
  );
}

// ── 狀態標籤 ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<AnalysisStatus, { label: string; cls: string }> = {
  PENDING: { label: "待追蹤", cls: "bg-blue-100 text-blue-700" },
  READY_TO_REVIEW: { label: "待檢視", cls: "bg-amber-100 text-amber-700" },
  REVIEWED: { label: "已檢視", cls: "bg-green-100 text-green-700" },
  TRACKING: { label: "追蹤中", cls: "bg-purple-100 text-purple-700" },
  DATA_ERROR: { label: "資料錯誤", cls: "bg-red-100 text-red-700" },
};

export function StatusBadge({ status }: { status: AnalysisStatus }) {
  const s = STATUS_LABELS[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ── 方向標籤 ──────────────────────────────────────────────────────────────────

export function DirectionBadge({ direction }: { direction: Direction }) {
  return direction === "BULLISH" ? (
    <span className="text-green-600 font-medium">▲ 看多</span>
  ) : (
    <span className="text-red-600 font-medium">▼ 看空</span>
  );
}

// ── 通用 Loading ──────────────────────────────────────────────────────────────

export function Loading() {
  return (
    <div className="flex items-center justify-center py-12 text-gray-400">
      <svg className="mr-2 h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      載入中...
    </div>
  );
}

// ── 空狀態 ────────────────────────────────────────────────────────────────────

export function Empty({ message = "尚無資料" }: { message?: string }) {
  return (
    <div className="py-12 text-center text-gray-400">{message}</div>
  );
}

// ── Section 卡片容器 ──────────────────────────────────────────────────────────

export function Section({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── 按鈕 ──────────────────────────────────────────────────────────────────────

type BtnVariant = "primary" | "secondary" | "danger" | "ghost";

const BTN_CLS: Record<BtnVariant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-gray-600 hover:bg-gray-100",
};

export function Btn({
  children,
  onClick,
  variant = "secondary",
  disabled,
  size = "sm",
  className = "",
  title,
  type,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  size?: "xs" | "sm" | "md";
  className?: string;
  title?: string;
  type?: "button" | "submit" | "reset";
}) {
  const sz = size === "xs" ? "px-2 py-0.5 text-xs" : size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-base";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-lg font-medium transition-colors disabled:opacity-50 ${sz} ${BTN_CLS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

// ── 表格基礎 ──────────────────────────────────────────────────────────────────

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children }: { children: ReactNode }) {
  return (
    <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={`whitespace-nowrap px-3 py-2 ${className}`}>{children}</td>
  );
}
