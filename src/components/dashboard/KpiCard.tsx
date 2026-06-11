import type { KpiCardProps, MetricStatus } from "@/src/types/dashboard";
import {
  formatCurrency,
  formatNumber,
  formatPercentage,
} from "@/src/utils/dashboardFormatters";

const statusStyles: Record<MetricStatus, string> = {
  alert: "bg-amber-100 text-amber-800 ring-amber-200",
  critical: "bg-rose-100 text-rose-800 ring-rose-200",
  "on-track": "bg-emerald-100 text-emerald-800 ring-emerald-200",
  unavailable: "bg-slate-100 text-slate-600 ring-slate-200",
};

const statusLabels: Record<MetricStatus, string> = {
  alert: "Alert",
  critical: "Critical",
  "on-track": "On track",
  unavailable: "Unavailable",
};

export function KpiCard({ item }: KpiCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-slate-600">{item.label}</p>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyles[item.status]}`}
        >
          {statusLabels[item.status]}
        </span>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-normal text-slate-950">
        {formatKpiValue(item)}
      </p>
      {item.helperText ? (
        <p className="mt-2 text-xs leading-5 text-slate-500">
          {item.helperText}
        </p>
      ) : null}
    </article>
  );
}

function formatKpiValue({ format, value }: KpiCardProps["item"]): string {
  if (format === "currency") {
    return formatCurrency(value);
  }

  if (format === "percentage") {
    return formatPercentage(value);
  }

  return formatNumber(value);
}
