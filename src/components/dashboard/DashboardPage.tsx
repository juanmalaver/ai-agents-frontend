"use client";

import { useMemo } from "react";
import { useDashboardQueryParams } from "@/src/hooks/useDashboardQueryParams";
import { useDashboardSection } from "@/src/hooks/useDashboardSection";
import type {
  AggregatedKpis,
  CampaignStateRow,
  DashboardPageProps,
  KpiCardData,
  MetricStatus,
  MonthlyCampaignPerformance,
} from "@/src/types/dashboard";
import {
  formatCurrency,
  formatDashboardTimestamp,
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

const dashboardSubtitle = "Campaign pacing and cost efficiency by state.";

export function DashboardPage({ activeTab, apiUrl }: DashboardPageProps) {
  const {
    dashboardQuery,
    dateRange,
    selectedBrand,
    setDateRange,
    setSelectedBrand,
  } = useDashboardQueryParams();
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
    () => (kpisSection.data ? buildKpiCards(kpisSection.data) : []),
    [kpisSection.data],
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

  return (
    <main className="min-h-screen bg-[#f7f8fb] px-4 py-6 text-slate-950 md:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-5">
        <DashboardHeader
          lastUpdated={lastUpdated}
          subtitle={dashboardSubtitle}
          title="Ad Performance"
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
              onDateRangeChange={setDateRange}
            />
          </div>
        </section>
        <SectionStatus
          error={kpisSection.data ? kpisSection.error : null}
          isRefreshing={kpisSection.isRefreshing}
          onRetry={kpisSection.retry}
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
        <SectionStatus
          error={
            stateCampaignsSection.data ? stateCampaignsSection.error : null
          }
          isRefreshing={stateCampaignsSection.isRefreshing}
          onRetry={stateCampaignsSection.retry}
        />
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
        <SectionStatus
          error={
            monthlyPerformanceSection.data
              ? monthlyPerformanceSection.error
              : null
          }
          isRefreshing={monthlyPerformanceSection.isRefreshing}
          onRetry={monthlyPerformanceSection.retry}
        />
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

function buildKpiCards(kpis: AggregatedKpis): KpiCardData[] {
  return [
    {
      format: "currency",
      id: "cpsl",
      label: "CPSL",
      status: getCostStatus(kpis.cpsl),
      value: kpis.cpsl,
    },
    {
      format: "currency",
      id: "cpl",
      label: "CPL",
      status: getCostStatus(kpis.finalCpl),
      value: kpis.finalCpl,
    },
    {
      format: "currency",
      helperText: formatMonthlySpendHelper(kpis.mtdSpent),
      id: "monthly-budget",
      label: "Monthly Budget",
      status: getCompletionStatus(kpis.budgetSpentCompletionPct),
      value: kpis.budget,
    },
    {
      format: "percentage",
      id: "budget-spent-completion",
      label: "% Budget Spent Completion",
      status: getCompletionStatus(kpis.budgetSpentCompletionPct),
      value: kpis.budgetSpentCompletionPct,
    },
    {
      format: "percentage",
      id: "sl-goal-completion",
      label: "% SL Goal Completion",
      status: getCompletionStatus(kpis.slGoalCompletionPct),
      value: kpis.slGoalCompletionPct,
    },
    {
      format: "percentage",
      id: "lead-goal-completion",
      label: "% Leads Goal Completion",
      status: getCompletionStatus(kpis.leadGoalCompletionPct),
      value: kpis.leadGoalCompletionPct,
    },
    {
      format: "percentage",
      id: "mtd-spent-pct",
      label: "MTD % Spent",
      status: getCompletionStatus(kpis.mtdSpentPct),
      value: kpis.mtdSpentPct,
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

function formatMonthlySpendHelper(mtdSpent: number | null): string | undefined {
  if (mtdSpent == null) {
    return undefined;
  }

  return `${formatCurrency(mtdSpent)} spent this month`;
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
  error,
  isRefreshing,
  onRetry,
}: {
  error: string | null;
  isRefreshing: boolean;
  onRetry: () => void;
}) {
  if (!error && !isRefreshing) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
      <p
        className={`flex items-center gap-2 ${
          error ? "font-medium text-rose-700" : "font-medium text-slate-600"
        }`}
      >
        {!error ? <LoadingSpinner label="Refreshing dashboard data" /> : null}
        <span>{error ?? "Showing cached data while fresh data loads."}</span>
      </p>
      {error ? (
        <button
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          onClick={onRetry}
          type="button"
        >
          Retry
        </button>
      ) : null}
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
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
