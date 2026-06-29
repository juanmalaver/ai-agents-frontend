import type { KpiCardProps, MetricStatus } from "@/src/types/dashboard";
import {
  formatCurrency,
  formatNumber,
  formatPercentage,
} from "@/src/utils/dashboardFormatters";

const statusStyles: Record<MetricStatus, string> = {
  alert: "bg-amber-100 text-amber-800 ring-amber-200",
  critical: "bg-rose-100 text-rose-800 ring-rose-200",
  "on-track": "bg-teal-100 text-teal-800 ring-teal-200",
  unavailable: "bg-slate-100 text-slate-600 ring-slate-200",
};

const statusLabels: Record<MetricStatus, string> = {
  alert: "Watch",
  critical: "Review",
  "on-track": "Good",
  unavailable: "Unavailable",
};

const kpiInfo: Record<string, string> = {
  cpl: "Meaning: cost per lead. Formula: MTD Spend / MTD Leads.",
  cpsl: "Meaning: cost per signed lead. Formula: MTD Spend / MTD SL.",
  "intake-conversion":
    "Meaning: lead-to-signed-lead conversion rate. Formula: MTD SL / MTD Leads.",
  "monthly-budget-eom":
    "Meaning: full-month budget progress. Formula: MTD Spend / Monthly Budget.",
  "monthly-budget-mtd":
    "Meaning: month-to-date budget progress. Formula: MTD Spend / MTD Budget Goal.",
  "mtd-sl-goal-completion":
    "Meaning: signed-lead progress against the month-to-date target. Formula: MTD SL / MTD SL Goal.",
};

const kpiDisplay: Record<string, { context?: string; title: string }> = {
  cpl: { title: "CPL" },
  cpsl: { title: "CPSL" },
  "intake-conversion": { context: "Conversion", title: "Intake" },
  "monthly-budget-eom": { context: "EOM progress", title: "Monthly Budget" },
  "monthly-budget-mtd": { context: "MTD progress", title: "Monthly Budget" },
  "mtd-sl-goal-completion": { context: "Completion", title: "SL Goal" },
};

export function KpiCard({ item }: KpiCardProps) {
  const display = kpiDisplay[item.id] ?? { title: item.label };
  const info = kpiInfo[item.id];

  return (
    <article className="flex min-h-[10rem] flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex min-h-10 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[0.82rem] font-semibold leading-5 text-slate-700">
              {display.title}
            </p>
            {info ? <HeaderInfoIcon info={info} /> : null}
          </div>
          {display.context ? (
            <p className="text-xs font-medium leading-4 text-slate-500">
              {display.context}
            </p>
          ) : null}
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-md px-2 py-1 text-[0.72rem] font-semibold leading-none ring-1 ${statusStyles[item.status]}`}
        >
          {statusLabels[item.status]}
        </span>
      </div>
      <p className="mt-3 text-[1.6rem] font-semibold leading-none tracking-normal text-slate-950">
        {formatKpiValue(item)}
      </p>
      <HelperDetails helperText={item.helperText} />
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

function HelperDetails({ helperText }: { helperText?: string }) {
  if (!helperText) {
    return <div aria-hidden="true" className="mt-auto min-h-[2.4rem] pt-3" />;
  }

  const details = helperText.split(" · ");

  return (
    <div className="mt-auto flex min-h-[2.4rem] flex-wrap content-end gap-1.5 pt-3">
      {details.map((detail) => (
        <span
          className="inline-flex whitespace-nowrap rounded-md bg-slate-50 px-2 py-1 text-[0.72rem] font-semibold leading-none text-slate-600 ring-1 ring-inset ring-slate-200/80"
          key={detail}
        >
          {detail}
        </span>
      ))}
    </div>
  );
}

function HeaderInfoIcon({ info }: { info: string }) {
  return (
    <button
      aria-label={info}
      className="group/info relative inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-50 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="h-3 w-3"
        fill="none"
        viewBox="0 0 16 16"
      >
        <circle
          cx="8"
          cy="8"
          r="6.25"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M8 7.25v4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
        <circle cx="8" cy="4.75" fill="currentColor" r="0.75" />
      </svg>
      <span
        className="pointer-events-none absolute left-0 top-full z-30 mt-1.5 hidden w-64 rounded-md bg-slate-950 px-2.5 py-2 text-left text-[0.68rem] font-medium normal-case leading-snug tracking-normal text-white shadow-lg group-hover/info:block group-focus/info:block"
        role="tooltip"
      >
        {info}
      </span>
    </button>
  );
}
