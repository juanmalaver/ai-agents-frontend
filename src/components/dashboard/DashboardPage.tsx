"use client";

import { useMemo } from "react";
import { useDashboardQueryParams } from "@/src/hooks/useDashboardQueryParams";
import { useDashboardSection } from "@/src/hooks/useDashboardSection";
import type {
  AggregatedKpis,
  CampaignStateRow,
  DashboardDateRange,
  DashboardPageProps,
  KpiCardData,
  MetricStatus,
  MonthlyCampaignPerformance,
} from "@/src/types/dashboard";
import {
  formatCurrency,
  formatDashboardTimestamp,
  formatNumber,
  safeDivide,
} from "@/src/utils/dashboardFormatters";
import {
  appendDashboardQueryParams,
  resolveDashboardSectionApiUrl,
} from "@/src/utils/runtimeApiUrls";
import { BrandFilter } from "./BrandFilter";
import { CampaignPerformanceChart } from "./CampaignPerformanceChart";
import { CampaignStateTable } from "./CampaignStateTable";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardTabs } from "./DashboardTabs";
import { DateRangeFilter } from "./DateRangeFilter";
import { KpiCardsGrid } from "./KpiCardsGrid";
import { LoadingSpinner } from "./LoadingSpinner";

const dashboardCopy = {
  overview: {
    subtitle: "Campaign pacing and cost efficiency by state.",
    title: "Meta",
  },
  combined: {
    subtitle: "Meta and TikTok campaign pacing and cost efficiency by state.",
    title: "Ad Performance",
  },
  tiktok: {
    subtitle: "TikTok campaign pacing and cost efficiency by state.",
    title: "TikTok",
  },
} as const;

const TIKTOK_MAX_DATE_RANGE_DAYS = 30;

export function DashboardPage({ activeTab, apiUrl }: DashboardPageProps) {
  const maxRangeDays =
    activeTab === "combined" || activeTab === "tiktok"
      ? TIKTOK_MAX_DATE_RANGE_DAYS
      : undefined;
  const {
    dashboardQuery,
    dateRange,
    selectedBrand,
    setDateRange,
    setSelectedBrand,
  } = useDashboardQueryParams({ maxRangeDays });
  const kpisUrl = useMemo(
    () =>
      appendDashboardQueryParams(
        resolveDashboardSectionApiUrl("kpis", apiUrl),
        dashboardQuery,
      ),
    [apiUrl, dashboardQuery],
  );
  const monthlyPerformanceUrl = useMemo(
    () =>
      appendDashboardQueryParams(
        resolveDashboardSectionApiUrl("monthly-performance", apiUrl),
        dashboardQuery,
      ),
    [apiUrl, dashboardQuery],
  );
  const stateCampaignsUrl = useMemo(
    () =>
      appendDashboardQueryParams(
        resolveDashboardSectionApiUrl("state-campaigns", apiUrl),
        dashboardQuery,
      ),
    [apiUrl, dashboardQuery],
  );
  const kpisSection = useDashboardSection<AggregatedKpis>({
    errorMessage: "Unable to load KPI cards.",
    normalize: normalizeAggregatedKpis,
    url: kpisUrl,
  });
  const monthlyPerformanceSection = useDashboardSection<
    MonthlyCampaignPerformance[]
  >({
    errorMessage: "Unable to load monthly performance.",
    normalize: normalizeMonthlyPerformanceRows,
    url: monthlyPerformanceUrl,
  });
  const stateCampaignsSection = useDashboardSection<CampaignStateRow[]>({
    errorMessage: "Unable to load state campaign performance.",
    normalize: normalizeStateCampaignRows,
    url: stateCampaignsUrl,
  });

  const kpiCards = useMemo(
    () =>
      kpisSection.data
        ? buildKpiCards(
            kpisSection.data,
            dateRange,
            stateCampaignsSection.data ?? [],
          )
        : [],
    [dateRange, kpisSection.data, stateCampaignsSection.data],
  );
  const lastUpdated = useMemo(
    () =>
      formatLatestGeneratedAt([
        kpisSection.generatedAt,
        monthlyPerformanceSection.generatedAt,
        stateCampaignsSection.generatedAt,
      ]),
    [
      kpisSection.generatedAt,
      monthlyPerformanceSection.generatedAt,
      stateCampaignsSection.generatedAt,
    ],
  );
  const copy =
    activeTab === "combined"
      ? dashboardCopy.combined
      : activeTab === "tiktok"
        ? dashboardCopy.tiktok
        : dashboardCopy.overview;
  const dashboardStatusErrors = [
    kpisSection.data ? kpisSection.error : null,
    stateCampaignsSection.data ? stateCampaignsSection.error : null,
    monthlyPerformanceSection.data ? monthlyPerformanceSection.error : null,
  ].filter((error): error is string => Boolean(error));
  const retryDashboardSections = () => {
    if (kpisSection.data && kpisSection.error) {
      kpisSection.retry();
    }

    if (stateCampaignsSection.data && stateCampaignsSection.error) {
      stateCampaignsSection.retry();
    }

    if (monthlyPerformanceSection.data && monthlyPerformanceSection.error) {
      monthlyPerformanceSection.retry();
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f8fb] px-4 py-6 text-slate-950 md:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-5">
        <DashboardHeader
          lastUpdated={lastUpdated}
          subtitle={copy.subtitle}
          title={copy.title}
        />
        {activeTab ? (
          <DashboardTabs activeTab={activeTab} query={dashboardQuery} />
        ) : null}
        <section
          aria-label="Dashboard filters"
          className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
        >
          <div className="grid gap-3 xl:grid-cols-[minmax(14rem,0.75fr)_minmax(0,1.65fr)] xl:items-start">
            <BrandFilter
              apiUrl={apiUrl}
              dateRange={dateRange}
              onBrandChange={setSelectedBrand}
              selectedBrand={selectedBrand}
            />
            <DateRangeFilter
              dateRange={dateRange}
              maxRangeDays={maxRangeDays}
              onDateRangeChange={setDateRange}
            />
          </div>
        </section>
        <SectionStatus
          errors={dashboardStatusErrors}
          onRetry={retryDashboardSections}
        />
        {kpisSection.data ? (
          <KpiCardsGrid items={kpiCards} />
        ) : kpisSection.isLoading ? (
          <KpiSkeletonGrid />
        ) : (
          <SectionError
            message={kpisSection.error ?? "Unable to load KPI cards."}
            onRetry={kpisSection.retry}
          />
        )}
        {stateCampaignsSection.data ? (
          <CampaignStateTable
            apiUrl={apiUrl}
            query={dashboardQuery}
            rows={stateCampaignsSection.data}
          />
        ) : stateCampaignsSection.isLoading ? (
          <TableSkeleton />
        ) : (
          <SectionError
            message={
              stateCampaignsSection.error ??
              "Unable to load state campaign performance."
            }
            onRetry={stateCampaignsSection.retry}
          />
        )}
        {monthlyPerformanceSection.error &&
        !monthlyPerformanceSection.data &&
        !monthlyPerformanceSection.isLoading ? (
          <SectionError
            message={monthlyPerformanceSection.error}
            onRetry={monthlyPerformanceSection.retry}
          />
        ) : (
          <CampaignPerformanceChart
            data={monthlyPerformanceSection.data ?? []}
            isLoading={
              monthlyPerformanceSection.isLoading &&
              !monthlyPerformanceSection.data
            }
          />
        )}
      </div>
    </main>
  );
}

function normalizeAggregatedKpis(kpis: AggregatedKpis): AggregatedKpis {
  return {
    budget: numberOrNull(kpis.budget),
    budgetSpentCompletionPct: numberOrNull(kpis.budgetSpentCompletionPct),
    cpsl: numberOrNull(kpis.cpsl),
    cpql: numberOrNull(kpis.cpql),
    finalCpl: numberOrNull(kpis.finalCpl),
    leadGoalCompletionPct: numberOrNull(kpis.leadGoalCompletionPct),
    mtdSpent: numberOrNull(kpis.mtdSpent),
    mtdSpentPct: numberOrNull(kpis.mtdSpentPct),
    slGoalCompletionPct: numberOrNull(kpis.slGoalCompletionPct),
  };
}

function normalizeMonthlyPerformanceRows(
  rows: MonthlyCampaignPerformance[],
): MonthlyCampaignPerformance[] {
  return rows.map(normalizeMonthlyPerformance);
}

function normalizeMonthlyPerformance(
  item: MonthlyCampaignPerformance,
): MonthlyCampaignPerformance {
  const sl = numberOrNull(item.sl) ?? 0;
  const slGoal = numberOrNull(item.slGoal);

  return {
    month: item.month,
    sl,
    slGoal,
    slPctToTarget: numberOrNull(item.slPctToTarget) ?? safeDivide(sl, slGoal),
  };
}

function normalizeStateCampaignRow(row: CampaignStateRow): CampaignStateRow {
  const budget = numberOrNull(row.budget);
  const slGoal = numberOrNull(row.slGoal);
  const leadsGoal = numberOrNull(row.leadsGoal);
  const mtdSpent = numberOrNull(row.mtdSpent);
  const mtdSl = numberOrNull(row.mtdSl);
  const leads = numberOrNull(row.leads);

  return {
    ...row,
    budget,
    cpl: numberOrNull(row.cpl) ?? safeDivide(mtdSpent, leads),
    cpsl: numberOrNull(row.cpsl) ?? safeDivide(mtdSpent, mtdSl),
    conversionRate:
      numberOrNull(row.conversionRate) ?? safeDivide(mtdSl, leads),
    goalPct: numberOrNull(row.goalPct) ?? safeDivide(mtdSl, slGoal),
    leads,
    leadsGoal,
    mtdSl,
    mtdSpent,
    slGoal,
    spentPct: numberOrNull(row.spentPct) ?? safeDivide(mtdSpent, budget),
  };
}

function normalizeStateCampaignRows(
  rows: CampaignStateRow[],
): CampaignStateRow[] {
  return rows.map(normalizeStateCampaignRow);
}

function buildKpiCards(
  kpis: AggregatedKpis,
  dateRange: DashboardDateRange,
  stateRows: CampaignStateRow[],
): KpiCardData[] {
  const monthPacing = buildMonthPacing(dateRange.to);
  const mtdBudgetGoal = calculateMtdGoal(kpis.budget, monthPacing);
  const mtdBudgetCompletionPct = safeDivide(kpis.mtdSpent, mtdBudgetGoal);
  const slGoalCompletion = calculateMtdSlGoalCompletion(stateRows);
  const intakeConversion = calculateIntakeConversion(stateRows);

  return [
    {
      format: "currency",
      helperText: formatCostEfficiencyHelper({
        denominator: intakeConversion.mtdSl,
        denominatorLabel: "SL",
        spent: kpis.mtdSpent,
      }),
      id: "cpsl",
      label: "CPSL",
      status: getCostStatus(kpis.cpsl),
      value: kpis.cpsl,
    },
    {
      format: "currency",
      helperText: formatCostEfficiencyHelper({
        denominator: intakeConversion.leads,
        denominatorLabel: "Leads",
        spent: kpis.mtdSpent,
      }),
      id: "cpl",
      label: "CPL",
      status: getCostStatus(kpis.finalCpl),
      value: kpis.finalCpl,
    },
    {
      format: "percentage",
      helperText: formatBudgetProgressHelper({
        goal: kpis.budget,
        spent: kpis.mtdSpent,
      }),
      id: "monthly-budget-eom",
      label: "Monthly Budget EOM",
      status: getCompletionStatus(kpis.budgetSpentCompletionPct),
      value: kpis.budgetSpentCompletionPct,
    },
    {
      format: "percentage",
      helperText: formatBudgetProgressHelper({
        goal: mtdBudgetGoal,
        spent: kpis.mtdSpent,
      }),
      id: "monthly-budget-mtd",
      label: "Monthly Budget MTD",
      status: getCompletionStatus(mtdBudgetCompletionPct),
      value: mtdBudgetCompletionPct,
    },
    {
      format: "currency",
      helperText: formatMtdBudgetGoalHelper({
        monthlyBudget: kpis.budget,
        monthPacing,
        spent: kpis.mtdSpent,
      }),
      id: "mtd-budget-goal",
      label: "MTD Budget Goal",
      status: getCompletionStatus(mtdBudgetCompletionPct),
      value: mtdBudgetGoal,
    },
    {
      format: "percentage",
      helperText: formatSlGoalCompletionHelper(slGoalCompletion),
      id: "mtd-sl-goal-completion",
      label: "% SL Goal Completion",
      status: getCompletionStatus(slGoalCompletion.completionPct),
      value: slGoalCompletion.completionPct,
    },
    {
      format: "percentage",
      helperText: formatIntakeConversionHelper(intakeConversion),
      id: "intake-conversion",
      label: "Intake Conversion",
      status: getCompletionStatus(intakeConversion.conversionRate),
      value: intakeConversion.conversionRate,
    },
  ];
}

function getCompletionStatus(value: number | null): MetricStatus {
  if (value == null) {
    return "unavailable";
  }

  if (value < 0.75) {
    return "critical";
  }

  if (value < 0.9) {
    return "alert";
  }

  return "on-track";
}

function getCostStatus(value: number | null): MetricStatus {
  if (value == null) {
    return "unavailable";
  }

  if (value > 250) {
    return "critical";
  }

  if (value > 150) {
    return "alert";
  }

  return "on-track";
}

function formatBudgetProgressHelper({
  goal,
  spent,
}: {
  goal: number | null;
  spent: number | null;
}): string | undefined {
  if (goal == null && spent == null) {
    return undefined;
  }

  return `Goal ${formatCurrency(goal)} · Spent ${formatCurrency(spent)}`;
}

function formatMtdBudgetGoalHelper({
  monthlyBudget,
  monthPacing,
  spent,
}: {
  monthlyBudget: number | null;
  monthPacing: MonthPacing;
  spent: number | null;
}): string | undefined {
  if (monthlyBudget == null && spent == null) {
    return undefined;
  }

  return `Spent ${formatCurrency(spent)} · EOM ${formatCurrency(
    monthlyBudget,
  )} · ${monthPacing.daysElapsed}/${monthPacing.daysInMonth} days`;
}

function formatCostEfficiencyHelper({
  denominator,
  denominatorLabel,
  spent,
}: {
  denominator: number | null;
  denominatorLabel: string;
  spent: number | null;
}): string | undefined {
  if (spent == null && denominator == null) {
    return undefined;
  }

  return `Spend ${formatCurrency(spent)} · ${denominatorLabel} ${formatNumber(
    denominator,
  )}`;
}

interface SlGoalCompletion {
  completionPct: number | null;
  mtdSl: number | null;
  mtdSlGoal: number | null;
}

function calculateMtdSlGoalCompletion(
  rows: CampaignStateRow[],
): SlGoalCompletion {
  let mtdSl = 0;
  let mtdSlGoal = 0;
  let hasGoal = false;

  for (const row of rows) {
    if (typeof row.mtdSl === "number" && Number.isFinite(row.mtdSl)) {
      mtdSl += row.mtdSl;
    }

    const rowMtdSlGoal = row.slGoal;

    if (rowMtdSlGoal === null) {
      continue;
    }

    hasGoal = true;
    mtdSlGoal += rowMtdSlGoal;
  }

  if (!hasGoal) {
    return {
      completionPct: null,
      mtdSl: null,
      mtdSlGoal: null,
    };
  }

  return {
    completionPct: safeDivide(mtdSl, mtdSlGoal),
    mtdSl,
    mtdSlGoal,
  };
}

function formatSlGoalCompletionHelper({
  mtdSl,
  mtdSlGoal,
}: SlGoalCompletion): string | undefined {
  if (mtdSl == null && mtdSlGoal == null) {
    return undefined;
  }

  return `MTD SL ${formatNumber(mtdSl)} · Goal ${formatNumber(mtdSlGoal)}`;
}

interface IntakeConversion {
  conversionRate: number | null;
  leads: number | null;
  mtdSl: number | null;
}

function calculateIntakeConversion(rows: CampaignStateRow[]): IntakeConversion {
  let leads = 0;
  let mtdSl = 0;
  let hasLeads = false;

  for (const row of rows) {
    if (typeof row.leads === "number" && Number.isFinite(row.leads)) {
      leads += row.leads;
      hasLeads = true;
    }

    if (typeof row.mtdSl === "number" && Number.isFinite(row.mtdSl)) {
      mtdSl += row.mtdSl;
    }
  }

  if (!hasLeads) {
    return {
      conversionRate: null,
      leads: null,
      mtdSl: null,
    };
  }

  return {
    conversionRate: safeDivide(mtdSl, leads),
    leads,
    mtdSl,
  };
}

function formatIntakeConversionHelper({
  leads,
  mtdSl,
}: IntakeConversion): string | undefined {
  if (leads == null && mtdSl == null) {
    return undefined;
  }

  return `MTD SL ${formatNumber(mtdSl)} · Leads ${formatNumber(leads)}`;
}

interface MonthPacing {
  daysElapsed: number;
  daysInMonth: number;
}

function buildMonthPacing(toDate: string | null | undefined): MonthPacing {
  const date = parseDashboardDate(toDate) ?? new Date();
  const daysInMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();
  const daysElapsed = Math.max(1, Math.min(date.getDate(), daysInMonth));

  return { daysElapsed, daysInMonth };
}

function parseDashboardDate(value: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");

  if (!match) {
    return null;
  }

  const [, rawYear, rawMonth, rawDay] = match;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function calculateMtdGoal(
  monthlyGoal: number | null | undefined,
  monthPacing: MonthPacing,
): number | null {
  if (typeof monthlyGoal !== "number" || !Number.isFinite(monthlyGoal)) {
    return null;
  }

  return (monthlyGoal / monthPacing.daysInMonth) * monthPacing.daysElapsed;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatLatestGeneratedAt(
  values: Array<string | null>,
): string | undefined {
  const latest = values.reduce<Date | null>((currentLatest, value) => {
    if (!value) {
      return currentLatest;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return currentLatest;
    }

    if (!currentLatest || date.getTime() > currentLatest.getTime()) {
      return date;
    }

    return currentLatest;
  }, null);

  return latest ? formatDashboardTimestamp(latest.toISOString()) : undefined;
}

function SectionStatus({
  errors,
  onRetry,
}: {
  errors: string[];
  onRetry: () => void;
}) {
  if (errors.length === 0) {
    return null;
  }

  const message =
    errors.length === 1
      ? errors[0]
      : `${errors.length} dashboard sections could not refresh. Showing cached data.`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
      <p className="flex items-center gap-2 font-medium text-rose-700">
        <span>{message}</span>
      </p>
      <button
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        onClick={onRetry}
        type="button"
      >
        Retry
      </button>
    </div>
  );
}

function SectionError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-lg border border-rose-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-rose-800">
        Dashboard section could not be loaded
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
      <button
        className="mt-4 rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
        onClick={onRetry}
        type="button"
      >
        Retry
      </button>
    </section>
  );
}

function KpiSkeletonGrid() {
  return (
    <section className="grid gap-3">
      <LoadingNotice label="Loading KPI cards..." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            className="min-h-[9.25rem] rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            key={index}
          >
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
            <div className="mt-4 h-8 w-24 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </section>
  );
}

function TableSkeleton() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <LoadingNotice label="Loading state performance..." />
      <div className="h-5 w-64 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 grid gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            className="h-10 animate-pulse rounded bg-slate-100"
            key={index}
          />
        ))}
      </div>
    </section>
  );
}

function LoadingNotice({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm">
      <LoadingSpinner label={label} />
      <span>{label}</span>
    </div>
  );
}
