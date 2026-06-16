"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { dashboardMock } from "@/src/mocks/dashboardMock";
import type {
  AggregatedKpis,
  CampaignDashboardApiResponse,
  CampaignStateRow,
  DashboardPageProps,
  KpiCardData,
  MetricStatus,
  MonthlyCampaignPerformance,
} from "@/src/types/dashboard";
import { safeDivide } from "@/src/utils/dashboardFormatters";
import { BrandFilter } from "./BrandFilter";
import { CampaignPerformanceChart } from "./CampaignPerformanceChart";
import { CampaignStateTable } from "./CampaignStateTable";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardTabs } from "./DashboardTabs";
import { KpiCardsGrid } from "./KpiCardsGrid";

const brandOptions = ["All Brands"];
const dashboardSubtitle = "Campaign pacing and cost efficiency by state.";

export function DashboardPage({ activeTab, apiUrl }: DashboardPageProps) {
  const [data, setData] = useState<CampaignDashboardApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setSelectedBrand] = useState(brandOptions[0]);

  const loadDashboard = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setError(null);

      try {
        const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true";
        let response: CampaignDashboardApiResponse;

        if (useMock) {
          response = dashboardMock;
        } else {
          if (!apiUrl) {
            throw new Error(
              "Dashboard API URL is not configured. Set NEXT_PUBLIC_USE_MOCK=true to use mock data.",
            );
          }

          const apiResponse = await fetch(apiUrl, {
            credentials: "include",
            signal,
          });

          if (!apiResponse.ok) {
            throw new Error("Unable to load dashboard data.");
          }

          response = (await apiResponse.json()) as CampaignDashboardApiResponse;
        }

        if (!signal?.aborted) {
          setData(normalizeDashboardData(response));
        }
      } catch (caughtError) {
        if (!signal?.aborted) {
          setData(null);
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load dashboard data.",
          );
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [apiUrl],
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadDashboard(controller.signal);

    return () => controller.abort();
  }, [loadDashboard]);

  const kpiCards = useMemo(
    () => (data ? buildKpiCards(data.aggregatedKpis) : []),
    [data],
  );

  const handleBrandChange = useCallback((brand: string) => {
    setSelectedBrand(brand);
  }, []);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f7f8fb] px-4 py-6 text-slate-950 md:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <DashboardHeader
            subtitle={dashboardSubtitle}
            title="Marketing Campaign Performance"
          />
          {activeTab ? <DashboardTabs activeTab={activeTab} /> : null}
          <BrandFilter
            onBrandChange={handleBrandChange}
            options={brandOptions}
          />
          <KpiSkeletonGrid />
          <CampaignPerformanceChart data={[]} isLoading />
          <TableSkeleton />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#f7f8fb] px-4 py-6 text-slate-950 md:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <DashboardHeader
            subtitle={dashboardSubtitle}
            title="Marketing Campaign Performance"
          />
          {activeTab ? <DashboardTabs activeTab={activeTab} /> : null}
          <BrandFilter
            onBrandChange={handleBrandChange}
            options={brandOptions}
          />
          <section className="rounded-lg border border-rose-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-rose-800">
              Dashboard data could not be loaded
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{error}</p>
            <button
              className="mt-4 rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
              onClick={() => void loadDashboard()}
              type="button"
            >
              Retry
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb] px-4 py-6 text-slate-950 md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <DashboardHeader
          lastUpdated={data ? formatGeneratedAt(data.generatedAt) : undefined}
          subtitle={dashboardSubtitle}
          title="Marketing Campaign Performance"
        />
        {activeTab ? <DashboardTabs activeTab={activeTab} /> : null}
        <BrandFilter onBrandChange={handleBrandChange} options={brandOptions} />
        <KpiCardsGrid items={kpiCards} />
        <CampaignPerformanceChart data={data?.monthlyPerformance ?? []} />
        <CampaignStateTable rows={data?.stateCampaigns ?? []} />
      </div>
    </main>
  );
}

function normalizeDashboardData(
  response: CampaignDashboardApiResponse,
): CampaignDashboardApiResponse {
  return {
    ...response,
    aggregatedKpis: normalizeAggregatedKpis(response.aggregatedKpis),
    monthlyPerformance: response.monthlyPerformance.map(
      normalizeMonthlyPerformance,
    ),
    stateCampaigns: response.stateCampaigns.map(normalizeStateCampaignRow),
  };
}

function normalizeAggregatedKpis(kpis: AggregatedKpis): AggregatedKpis {
  return {
    budgetSpentCompletionPct: numberOrNull(kpis.budgetSpentCompletionPct),
    cpsl: numberOrNull(kpis.cpsl),
    cpql: numberOrNull(kpis.cpql),
    finalCpl: numberOrNull(kpis.finalCpl),
    leadGoalCompletionPct: numberOrNull(kpis.leadGoalCompletionPct),
    mtdSpentPct: numberOrNull(kpis.mtdSpentPct),
    slGoalCompletionPct: numberOrNull(kpis.slGoalCompletionPct),
  };
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
    slPctToTarget:
      numberOrNull(item.slPctToTarget) ?? safeDivide(sl, slGoal),
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

function buildKpiCards(kpis: AggregatedKpis): KpiCardData[] {
  return [
    {
      format: "currency",
      id: "final-cpl",
      label: "Final CPL",
      status: getCostStatus(kpis.finalCpl),
      value: kpis.finalCpl,
    },
    {
      format: "currency",
      id: "cpsl",
      label: "CPSL",
      status: getCostStatus(kpis.cpsl),
      value: kpis.cpsl,
    },
    {
      format: "currency",
      id: "cpql",
      label: "CPQL",
      status: getCostStatus(kpis.cpql),
      value: kpis.cpql,
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
      label: "% Q. Leads Goal Completion",
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

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatGeneratedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function KpiSkeletonGrid() {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          key={index}
        >
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-8 w-24 animate-pulse rounded bg-slate-200" />
        </div>
      ))}
    </section>
  );
}

function TableSkeleton() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="h-5 w-64 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 grid gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="h-10 animate-pulse rounded bg-slate-100" key={index} />
        ))}
      </div>
    </section>
  );
}
