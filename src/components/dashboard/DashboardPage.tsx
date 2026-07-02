"use client";

import { useMemo, useState } from "react";
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
  formatPercentage,
  safeDivide,
} from "@/src/utils/dashboardFormatters";
import {
  appendDashboardQueryParams,
  resolveDashboardSectionApiUrl,
} from "@/src/utils/runtimeApiUrls";
import { getTodayDateRange } from "@/src/utils/dateRangeDefaults";
import { BrandFilter } from "./BrandFilter";
import { CampaignPerformanceChart } from "./CampaignPerformanceChart";
import { CampaignStateTable } from "./CampaignStateTable";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardShell } from "./DashboardShell";
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
const KPI_AUDIT_THRESHOLDS = {
  cpsl: {
    greenMaxExclusive: 1000,
    redMin: 1500,
    zeroSignedLeadRedSpendMin: 500,
    zeroSignedLeadYellowSpendMin: 250,
  },
  intake: {
    greenMin: 0.1,
    minimumLeads: 10,
    yellowMin: 0.05,
  },
  volume: {
    greenMax: 110,
    redMinExclusive: 300,
    zeroLeadRedSpendMin: 300,
    zeroLeadYellowSpendMin: 200,
  },
} as const;

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
  const todayDateRange = useMemo(() => getTodayDateRange(), []);
  const todayDashboardQuery = useMemo(
    () => ({
      brand: dashboardQuery.brand,
      from: todayDateRange.from,
      to: todayDateRange.to,
    }),
    [dashboardQuery.brand, todayDateRange.from, todayDateRange.to],
  );
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
  const todayStateCampaignsUrl = useMemo(
    () =>
      appendDashboardQueryParams(
        resolveDashboardSectionApiUrl("state-campaigns", apiUrl),
        todayDashboardQuery,
      ),
    [apiUrl, todayDashboardQuery],
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
  const todayStateCampaignsSection = useDashboardSection<CampaignStateRow[]>({
    errorMessage: "Unable to load today's KPI cards.",
    normalize: normalizeStateCampaignRows,
    url: todayStateCampaignsUrl,
  });
  const [selectedStateFilter, setSelectedStateFilter] = useState<string[]>([]);
  const todayStateRows = todayStateCampaignsSection.data ?? [];
  const stateRows = stateCampaignsSection.data ?? [];
  const availableStates = useMemo(
    () => new Set(stateRows.map((row) => row.state)),
    [stateRows],
  );
  const activeStateFilter = useMemo(
    () => selectedStateFilter.filter((state) => availableStates.has(state)),
    [availableStates, selectedStateFilter],
  );
  const filteredStateRows = useMemo(
    () => filterStateRowsBySelectedStates(stateRows, activeStateFilter),
    [activeStateFilter, stateRows],
  );
  const allStateKpiCards = useMemo(
    () =>
      kpisSection.data
        ? buildKpiCards(kpisSection.data, dateRange, stateRows)
        : [],
    [dateRange, kpisSection.data, stateRows],
  );
  const filteredStateKpiCards = useMemo(
    () =>
      activeStateFilter.length > 0
        ? buildKpiCards(
            buildAggregatedKpisFromStateRows(filteredStateRows),
            dateRange,
            filteredStateRows,
          )
        : [],
    [activeStateFilter.length, dateRange, filteredStateRows],
  );
  const todayKpiCards = useMemo(
    () => buildTodayKpiCards(todayStateRows, todayDateRange),
    [todayDateRange, todayStateRows],
  );
  const todayKpiContextLabel = `Today only: ${todayDateRange.to}`;
  const generalKpiRangeContextLabel = formatKpiDateRangeContext(dateRange);
  const allStateKpiContextLabels = [
    "All states total",
    generalKpiRangeContextLabel,
  ];
  const filteredKpiContextLabel = `Filtered states: ${formatNumber(
    activeStateFilter.length,
  )} ${activeStateFilter.length === 1 ? "state" : "states"}`;
  const filteredStateKpiContextLabels = [
    filteredKpiContextLabel,
    generalKpiRangeContextLabel,
  ];
  const lastUpdated = useMemo(
    () =>
      formatLatestGeneratedAt([
        kpisSection.generatedAt,
        monthlyPerformanceSection.generatedAt,
        stateCampaignsSection.generatedAt,
        todayStateCampaignsSection.generatedAt,
      ]),
    [
      kpisSection.generatedAt,
      monthlyPerformanceSection.generatedAt,
      stateCampaignsSection.generatedAt,
      todayStateCampaignsSection.generatedAt,
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
    todayStateCampaignsSection.data ? todayStateCampaignsSection.error : null,
    monthlyPerformanceSection.data ? monthlyPerformanceSection.error : null,
  ].filter((error): error is string => Boolean(error));
  const retryDashboardSections = () => {
    if (kpisSection.data && kpisSection.error) {
      kpisSection.retry();
    }

    if (stateCampaignsSection.data && stateCampaignsSection.error) {
      stateCampaignsSection.retry();
    }

    if (
      todayStateCampaignsSection.data &&
      todayStateCampaignsSection.error
    ) {
      todayStateCampaignsSection.retry();
    }

    if (monthlyPerformanceSection.data && monthlyPerformanceSection.error) {
      monthlyPerformanceSection.retry();
    }
  };

  return (
    <DashboardShell activeItem="dashboard">
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
        <div className="space-y-4">
          {todayStateCampaignsSection.data ? (
            <KpiCardsGrid
              ariaLabel="Today's state campaign KPIs"
              contextLabel={todayKpiContextLabel}
              items={todayKpiCards}
            />
          ) : todayStateCampaignsSection.isLoading ? (
            <KpiSkeletonGrid
              itemCount={5}
              label="Loading today's KPI cards..."
            />
          ) : (
            <SectionError
              message={
                todayStateCampaignsSection.error ??
                "Unable to load today's KPI cards."
              }
              onRetry={todayStateCampaignsSection.retry}
            />
          )}
          {kpisSection.data ? (
            <>
              <KpiCardsGrid
                ariaLabel="All state campaign KPIs"
                contextLabels={allStateKpiContextLabels}
                items={allStateKpiCards}
              />
              {activeStateFilter.length > 0 ? (
                <KpiCardsGrid
                  ariaLabel="Filtered state campaign KPIs"
                  contextLabels={filteredStateKpiContextLabels}
                  items={filteredStateKpiCards}
                />
              ) : null}
            </>
          ) : kpisSection.isLoading ? (
            <KpiSkeletonGrid />
          ) : (
            <SectionError
              message={kpisSection.error ?? "Unable to load KPI cards."}
              onRetry={kpisSection.retry}
            />
          )}
        </div>
        {stateCampaignsSection.data ? (
          <CampaignStateTable
            apiUrl={apiUrl}
            onSelectedStateFilterChange={setSelectedStateFilter}
            query={dashboardQuery}
            rows={stateCampaignsSection.data}
            selectedStateFilter={activeStateFilter}
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
    </DashboardShell>
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
    mixedStates: row.mixedStates?.map(normalizeMixedStateRow),
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

function normalizeMixedStateRow(
  row: NonNullable<CampaignStateRow["mixedStates"]>[number],
): NonNullable<CampaignStateRow["mixedStates"]>[number] {
  return {
    ...row,
    budget: numberOrNull(row.budget),
    conversionRate: numberOrNull(row.conversionRate),
    cpl: numberOrNull(row.cpl),
    cpsl: numberOrNull(row.cpsl),
    leads: numberOrNull(row.leads),
    leadsGoal: numberOrNull(row.leadsGoal),
    mtdSl: numberOrNull(row.mtdSl),
    mtdSpent: numberOrNull(row.mtdSpent),
    slGoal: numberOrNull(row.slGoal),
    spentPct: numberOrNull(row.spentPct),
  };
}

function filterStateRowsBySelectedStates(
  rows: CampaignStateRow[],
  selectedStates: string[],
): CampaignStateRow[] {
  if (selectedStates.length === 0) {
    return rows;
  }

  const selectedStateSet = new Set(selectedStates);

  return rows.filter((row) => selectedStateSet.has(row.state));
}

function buildAggregatedKpisFromStateRows(
  rows: CampaignStateRow[],
): AggregatedKpis {
  const budget = sumNullable(rows.map((row) => row.budget));
  const leads = sumNullable(rows.map((row) => row.leads));
  const leadsGoal = sumNullable(rows.map((row) => row.leadsGoal));
  const mtdSl = sumNullable(rows.map((row) => row.mtdSl));
  const mtdSpent = sumNullable(rows.map((row) => row.mtdSpent));
  const slGoal = sumNullable(rows.map((row) => row.slGoal));

  return {
    budget,
    budgetSpentCompletionPct: safeDivide(mtdSpent, budget),
    cpsl: safeDivide(mtdSpent, mtdSl),
    cpql: null,
    finalCpl: safeDivide(mtdSpent, leads),
    leadGoalCompletionPct: safeDivide(leads, leadsGoal),
    mtdSpent,
    mtdSpentPct: safeDivide(mtdSpent, budget),
    slGoalCompletionPct: safeDivide(mtdSl, slGoal),
  };
}

function buildKpiCards(
  kpis: AggregatedKpis,
  dateRange: DashboardDateRange,
  stateRows: CampaignStateRow[],
): KpiCardData[] {
  const monthPacing = buildMonthPacing(dateRange.to);
  const mtdBudgetGoal = calculateMtdGoal(kpis.budget, monthPacing);
  const mtdBudgetCompletionPct = safeDivide(kpis.mtdSpent, mtdBudgetGoal);
  const leadGoalContext = calculateMtdLeadGoalContext(stateRows, monthPacing);
  const slGoalCompletion = calculateMtdSlGoalCompletion(stateRows);
  const intakeConversion = calculateIntakeConversion(stateRows);
  const signedLeads = sumNullable(stateRows.map((row) => row.mtdSl));

  return [
    {
      format: "currency",
      helperText: formatCpslHelper({
        mtdSl: signedLeads,
        mtdSlGoal: slGoalCompletion.mtdSlGoal,
        spent: kpis.mtdSpent,
      }),
      id: "cpsl",
      label: "CPSL",
      status: getCpslStatus({
        cpsl: kpis.cpsl,
        signedLeads,
        spent: kpis.mtdSpent,
      }),
      value: kpis.cpsl,
    },
    {
      format: "currency",
      helperText: formatCplHelper({
        leads: leadGoalContext.leads,
        mtdLeadGoal: leadGoalContext.mtdLeadGoal,
        spent: kpis.mtdSpent,
      }),
      id: "cpl",
      label: "CPL",
      status: getCplStatus({
        cpl: kpis.finalCpl,
        leads: leadGoalContext.leads,
        spent: kpis.mtdSpent,
      }),
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
        monthPacing,
        spent: kpis.mtdSpent,
      }),
      id: "monthly-budget-mtd",
      label: "Monthly Budget MTD",
      status: getCompletionStatus(mtdBudgetCompletionPct),
      value: mtdBudgetCompletionPct,
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
      helperText: formatLeadGoalCompletionHelper(leadGoalContext),
      id: "mtd-lead-goal-completion",
      label: "% Lead Goal Completion",
      status: getCompletionStatus(leadGoalContext.completionPct),
      value: leadGoalContext.completionPct,
    },
    {
      format: "percentage",
      helperText: formatIntakeConversionHelper(intakeConversion),
      id: "intake-conversion",
      label: "Intake Conversion",
      status: getIntakeConversionStatus(intakeConversion),
      value: intakeConversion.conversionRate,
    },
  ];
}

function formatKpiDateRangeContext(dateRange: DashboardDateRange): string {
  if (!dateRange.from || !dateRange.to) {
    return "Selected range";
  }

  if (dateRange.from === dateRange.to) {
    return `Selected day: ${dateRange.to}`;
  }

  return `Selected range: ${dateRange.from} to ${dateRange.to}`;
}

interface TodayKpiTotals {
  budgetCompletionPct: number | null;
  conversionRate: number | null;
  dailyBudgetGoal: number | null;
  dailyLeadGoal: number | null;
  dailySlGoal: number | null;
  leads: number | null;
  signedLeads: number | null;
  spend: number | null;
}

function buildTodayKpiCards(
  rows: CampaignStateRow[],
  dateRange: DashboardDateRange,
): KpiCardData[] {
  const monthPacing = buildMonthPacing(dateRange.to);
  const totals = buildTodayKpiTotals(rows, monthPacing);
  const leadCompletionPct = safeDivide(totals.leads, totals.dailyLeadGoal);
  const slCompletionPct = safeDivide(totals.signedLeads, totals.dailySlGoal);

  return [
    {
      format: "number",
      helperText: formatDailyGoalHelper({
        actual: totals.leads,
        actualLabel: "Leads",
        goal: totals.dailyLeadGoal,
      }),
      id: "today-leads",
      label: "Leads",
      status: getCompletionStatus(leadCompletionPct),
      value: totals.leads,
    },
    {
      format: "number",
      helperText: formatDailyGoalHelper({
        actual: totals.signedLeads,
        actualLabel: "SL",
        goal: totals.dailySlGoal,
      }),
      id: "today-sl",
      label: "SL",
      status: getCompletionStatus(slCompletionPct),
      value: totals.signedLeads,
    },
    {
      format: "percentage",
      helperText: formatIntakeConversionHelper({
        conversionRate: totals.conversionRate,
        leads: totals.leads,
        mtdSl: totals.signedLeads,
      }),
      id: "today-conversion",
      label: "Conv",
      status: getIntakeConversionStatus({
        conversionRate: totals.conversionRate,
        leads: totals.leads,
        mtdSl: totals.signedLeads,
      }),
      value: totals.conversionRate,
    },
    {
      format: "currency",
      helperText: formatDailySpendHelper({
        budgetCompletionPct: totals.budgetCompletionPct,
        dailyBudgetGoal: totals.dailyBudgetGoal,
      }),
      id: "today-spend",
      label: "Spend",
      status: getCompletionStatus(totals.budgetCompletionPct),
      value: totals.spend,
    },
    {
      format: "percentage",
      helperText: formatBudgetProgressHelper({
        goal: totals.dailyBudgetGoal,
        spent: totals.spend,
      }),
      id: "today-budget",
      label: "Budget",
      status: getCompletionStatus(totals.budgetCompletionPct),
      value: totals.budgetCompletionPct,
    },
  ];
}

function buildTodayKpiTotals(
  rows: CampaignStateRow[],
  monthPacing: MonthPacing,
): TodayKpiTotals {
  const budget = sumNullable(rows.map((row) => row.budget));
  const dailyBudgetGoal = calculateDailyGoal(budget, monthPacing);
  const dailyLeadGoal = calculateDailyGoal(
    sumNullable(rows.map((row) => row.leadsGoal)),
    monthPacing,
  );
  const dailySlGoal = calculateDailyGoal(
    sumNullable(rows.map((row) => row.slGoal)),
    monthPacing,
  );
  const leads = sumNullable(rows.map((row) => row.leads));
  const signedLeads = sumNullable(rows.map((row) => row.mtdSl));
  const spend = sumNullable(rows.map((row) => row.mtdSpent));

  return {
    budgetCompletionPct: safeDivide(spend, dailyBudgetGoal),
    conversionRate: safeDivide(signedLeads, leads),
    dailyBudgetGoal,
    dailyLeadGoal,
    dailySlGoal,
    leads,
    signedLeads,
    spend,
  };
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

function getCpslStatus({
  cpsl,
  signedLeads,
  spent,
}: {
  cpsl: number | null;
  signedLeads: number | null;
  spent: number | null;
}): MetricStatus {
  const thresholds = KPI_AUDIT_THRESHOLDS.cpsl;

  if ((signedLeads ?? 0) <= 0) {
    if (spent == null) {
      return "unavailable";
    }

    if (spent >= thresholds.zeroSignedLeadRedSpendMin) {
      return "critical";
    }

    if (spent >= thresholds.zeroSignedLeadYellowSpendMin) {
      return "alert";
    }

    return "unavailable";
  }

  if (cpsl == null) {
    return "unavailable";
  }

  if (cpsl >= thresholds.redMin) {
    return "critical";
  }

  if (cpsl >= thresholds.greenMaxExclusive) {
    return "alert";
  }

  return "on-track";
}

function getCplStatus({
  cpl,
  leads,
  spent,
}: {
  cpl: number | null;
  leads: number | null;
  spent: number | null;
}): MetricStatus {
  const thresholds = KPI_AUDIT_THRESHOLDS.volume;

  if ((leads ?? 0) <= 0) {
    if (spent == null) {
      return "unavailable";
    }

    if (spent >= thresholds.zeroLeadRedSpendMin) {
      return "critical";
    }

    if (spent >= thresholds.zeroLeadYellowSpendMin) {
      return "alert";
    }

    return "unavailable";
  }

  if (cpl == null) {
    return "unavailable";
  }

  if (cpl > thresholds.redMinExclusive) {
    return "critical";
  }

  if (cpl > thresholds.greenMax) {
    return "alert";
  }

  return "on-track";
}

function getIntakeConversionStatus({
  conversionRate,
  leads,
}: IntakeConversion): MetricStatus {
  const thresholds = KPI_AUDIT_THRESHOLDS.intake;

  if (leads == null || leads < thresholds.minimumLeads) {
    return "unavailable";
  }

  if (conversionRate == null) {
    return "unavailable";
  }

  if (conversionRate >= thresholds.greenMin) {
    return "on-track";
  }

  if (conversionRate >= thresholds.yellowMin) {
    return "alert";
  }

  return "critical";
}

function formatBudgetProgressHelper({
  goal,
  monthPacing,
  spent,
}: {
  goal: number | null;
  monthPacing?: MonthPacing;
  spent: number | null;
}): string | undefined {
  if (goal == null && spent == null) {
    return undefined;
  }

  const parts = [
    `Goal ${formatCurrency(goal)}`,
    `Spent ${formatCurrency(spent)}`,
  ];

  if (monthPacing) {
    parts.push(`${monthPacing.daysElapsed}/${monthPacing.daysInMonth} days`);
  }

  return parts.join(" · ");
}

function formatCpslHelper({
  mtdSl,
  mtdSlGoal,
  spent,
}: {
  mtdSl: number | null;
  mtdSlGoal: number | null;
  spent: number | null;
}): string | undefined {
  if (mtdSl == null && mtdSlGoal == null && spent == null) {
    return undefined;
  }

  return [
    `MTD SL ${formatNumber(mtdSl)}`,
    `MTD Goal ${formatNumber(mtdSlGoal)}`,
    `Spend ${formatCurrency(spent)}`,
  ].join(" · ");
}

function formatCplHelper({
  leads,
  mtdLeadGoal,
  spent,
}: {
  leads: number | null;
  mtdLeadGoal: number | null;
  spent: number | null;
}): string | undefined {
  if (leads == null && mtdLeadGoal == null && spent == null) {
    return undefined;
  }

  return [
    `MTD Leads ${formatNumber(leads)}`,
    `MTD Goal ${formatNumber(mtdLeadGoal)}`,
    `Spend ${formatCurrency(spent)}`,
  ].join(" · ");
}

interface LeadGoalContext {
  completionPct: number | null;
  leads: number | null;
  mtdLeadGoal: number | null;
}

function calculateMtdLeadGoalContext(
  rows: CampaignStateRow[],
  monthPacing: MonthPacing,
): LeadGoalContext {
  let leads = 0;
  let leadGoal = 0;
  let hasLeads = false;
  let hasGoal = false;

  for (const row of rows) {
    if (typeof row.leads === "number" && Number.isFinite(row.leads)) {
      leads += row.leads;
      hasLeads = true;
    }

    if (typeof row.leadsGoal === "number" && Number.isFinite(row.leadsGoal)) {
      leadGoal += row.leadsGoal;
      hasGoal = true;
    }
  }

  const mtdLeadGoal = hasGoal ? calculateMtdGoal(leadGoal, monthPacing) : null;

  return {
    completionPct: safeDivide(hasLeads ? leads : null, mtdLeadGoal),
    leads: hasLeads ? leads : null,
    mtdLeadGoal,
  };
}

function formatLeadGoalCompletionHelper({
  leads,
  mtdLeadGoal,
}: LeadGoalContext): string | undefined {
  if (leads == null && mtdLeadGoal == null) {
    return undefined;
  }

  return [
    `MTD L ${formatNumber(leads)}`,
    `MTD Lead Goal ${formatNumber(mtdLeadGoal)}`,
  ].join(" · ");
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

  return [
    `MTD SL ${formatNumber(mtdSl)}`,
    `MTD SL Goal ${formatNumber(mtdSlGoal)}`,
  ].join(" · ");
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

  return [
    `MTD SL ${formatNumber(mtdSl)}`,
    `Leads ${formatNumber(leads)}`,
  ].join(" · ");
}

function formatDailyGoalHelper({
  actual,
  actualLabel,
  goal,
}: {
  actual: number | null;
  actualLabel: string;
  goal: number | null;
}): string | undefined {
  if (actual == null && goal == null) {
    return undefined;
  }

  return [
    `Today ${actualLabel} ${formatNumber(actual)}`,
    `Daily Goal ${formatNumber(goal)}`,
  ].join(" · ");
}

function formatDailySpendHelper({
  budgetCompletionPct,
  dailyBudgetGoal,
}: {
  budgetCompletionPct: number | null;
  dailyBudgetGoal: number | null;
}): string | undefined {
  if (budgetCompletionPct == null && dailyBudgetGoal == null) {
    return undefined;
  }

  return [
    `Daily Budget ${formatCurrency(dailyBudgetGoal)}`,
    `Budget ${formatPercentage(budgetCompletionPct)}`,
  ].join(" · ");
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

function calculateDailyGoal(
  monthlyGoal: number | null | undefined,
  monthPacing: MonthPacing,
): number | null {
  if (typeof monthlyGoal !== "number" || !Number.isFinite(monthlyGoal)) {
    return null;
  }

  return monthlyGoal / monthPacing.daysInMonth;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sumNullable(values: Array<number | null | undefined>): number | null {
  let total = 0;
  let hasValue = false;

  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      total += value;
      hasValue = true;
    }
  }

  return hasValue ? total : null;
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

function KpiSkeletonGrid({
  itemCount = 7,
  label = "Loading KPI cards...",
}: {
  itemCount?: number;
  label?: string;
} = {}) {
  const gridClassName =
    itemCount === 5
      ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      : itemCount === 7
        ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7"
      : "grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6";

  return (
    <section className="grid gap-3">
      <LoadingNotice label={label} />
      <div className={gridClassName}>
        {Array.from({ length: itemCount }).map((_, index) => (
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
