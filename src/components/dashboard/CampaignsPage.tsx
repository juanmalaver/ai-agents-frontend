"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDashboardQueryParams } from "@/src/hooks/useDashboardQueryParams";
import { useDashboardSection } from "@/src/hooks/useDashboardSection";
import type {
  CampaignInsight,
  CampaignLeadTrendRow,
  CampaignResultRow,
  CampaignScorecard,
  CampaignsLowerDetailSection,
  CampaignsResultsSection,
  CampaignsSummarySection,
  CampaignSpendRow,
  CampaignStateCompletionRow,
  CampaignStateSnapshotRow,
  CampaignStatusDistributionRow,
} from "@/src/types/campaigns";
import type { A1AgentLatestResponse } from "@/src/types/dashboard";
import {
  formatCurrency,
  formatDashboardTimestamp,
  formatNumber,
  formatPercentage,
} from "@/src/utils/dashboardFormatters";
import {
  appendDashboardQueryParams,
  resolveAgentEndpointUrl,
  resolveCampaignsDashboardSectionApiUrl,
} from "@/src/utils/runtimeApiUrls";
import { getYesterdayDateRange } from "@/src/utils/dateRangeDefaults";
import { AgentBriefPanel } from "./AgentBriefPanel";
import { BrandFilter } from "./BrandFilter";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardShell } from "./DashboardShell";
import { DashboardTabs } from "./DashboardTabs";
import { LoadingSpinner } from "./LoadingSpinner";

const scorecardClasses: Record<CampaignScorecard["status"], string> = {
  critical: "border-rose-200 bg-rose-50 text-rose-950",
  healthy: "border-teal-200 bg-teal-50 text-teal-950",
  watch: "border-amber-200 bg-amber-50 text-amber-950",
};

const PANEL_ROW_LIMIT = 8;
const AGENT_RUN_POLL_INTERVAL_MS = 5000;
const AGENT_RUN_TIMEOUT_MS = 180000;
const A1_BRIEF_BRANDS = [
  {
    accountId: null,
    id: "american-compensation-4",
    name: "American Compensation 4.0",
  },
  {
    accountId: null,
    id: "la-ayuda-latina-3",
    name: "La Ayuda Latina 3.0",
  },
  {
    accountId: null,
    id: "los-abogados-latinos-1",
    name: "Los Abogados Latinos 1.0",
  },
];

type CampaignDetailModalView = "campaigns" | "states" | null;

type StateCompletionChartRow = CampaignStateCompletionRow & {
  completionPct: number;
};

interface CampaignsPageProps {
  agentLatestUrl?: string;
  agentRerunUrl?: string;
  apiUrl?: string;
}

interface PendingAgentRun {
  brand: string | null;
  queuedAt: number;
  timeoutAt: number;
}

export function CampaignsPage({
  agentLatestUrl,
  agentRerunUrl,
  apiUrl,
}: CampaignsPageProps) {
  const [chartsReady, setChartsReady] = useState(false);
  const [detailModal, setDetailModal] = useState<CampaignDetailModalView>(null);
  const [agentRun, setAgentRun] = useState<A1AgentLatestResponse | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [isRerunning, setIsRerunning] = useState(false);
  const [briefBrand, setBriefBrand] = useState<string | null>(null);
  const [pendingAgentRun, setPendingAgentRun] =
    useState<PendingAgentRun | null>(null);
  const [rerunStatus, setRerunStatus] = useState<string | null>(null);
  const { selectedBrand, setSelectedBrand } = useDashboardQueryParams();
  const dailyBriefDateRange = useMemo(() => getYesterdayDateRange(), []);
  const dashboardQuery = useMemo(
    () => ({
      brand: selectedBrand,
      from: dailyBriefDateRange.from,
      to: dailyBriefDateRange.to,
    }),
    [dailyBriefDateRange.from, dailyBriefDateRange.to, selectedBrand],
  );
  const brandLabel = selectedBrand ?? "All brands";

  const resolvedAgentLatestUrl = useMemo(
    () =>
      resolveAgentEndpointUrl({
        action: "latest",
        dashboardApiUrl: apiUrl,
        explicitAgentUrl: agentLatestUrl,
      }),
    [agentLatestUrl, apiUrl],
  );
  const resolvedAgentRerunUrl = useMemo(
    () =>
      resolveAgentEndpointUrl({
        action: "rerun",
        dashboardApiUrl: apiUrl,
        explicitAgentUrl: agentRerunUrl,
      }),
    [agentRerunUrl, apiUrl],
  );
  const agentLatestScopedUrl = useMemo(
    () =>
      appendDashboardQueryParams(resolvedAgentLatestUrl, {
        brand: briefBrand,
        from: dailyBriefDateRange.from,
        to: dailyBriefDateRange.to,
      }),
    [
      briefBrand,
      dailyBriefDateRange.from,
      dailyBriefDateRange.to,
      resolvedAgentLatestUrl,
    ],
  );
  const summaryUrl = useMemo(
    () =>
      appendDashboardQueryParams(
        resolveCampaignsDashboardSectionApiUrl({
          dashboardApiUrl: process.env.NEXT_PUBLIC_DASHBOARD_API_URL,
          explicitCampaignsApiUrl: apiUrl,
          section: "summary",
        }),
        dashboardQuery,
      ),
    [apiUrl, dashboardQuery],
  );
  const stateCompletionUrl = useMemo(
    () =>
      appendDashboardQueryParams(
        resolveCampaignsDashboardSectionApiUrl({
          dashboardApiUrl: process.env.NEXT_PUBLIC_DASHBOARD_API_URL,
          explicitCampaignsApiUrl: apiUrl,
          section: "state-completion",
        }),
        dashboardQuery,
      ),
    [apiUrl, dashboardQuery],
  );
  const leadBehaviorUrl = useMemo(
    () =>
      appendDashboardQueryParams(
        resolveCampaignsDashboardSectionApiUrl({
          dashboardApiUrl: process.env.NEXT_PUBLIC_DASHBOARD_API_URL,
          explicitCampaignsApiUrl: apiUrl,
          section: "lead-behavior",
        }),
        dashboardQuery,
      ),
    [apiUrl, dashboardQuery],
  );
  const resultsUrl = useMemo(
    () =>
      appendDashboardQueryParams(
        resolveCampaignsDashboardSectionApiUrl({
          dashboardApiUrl: process.env.NEXT_PUBLIC_DASHBOARD_API_URL,
          explicitCampaignsApiUrl: apiUrl,
          section: "results",
        }),
        dashboardQuery,
      ),
    [apiUrl, dashboardQuery],
  );
  const lowerDetailUrl = useMemo(
    () =>
      appendDashboardQueryParams(
        resolveCampaignsDashboardSectionApiUrl({
          dashboardApiUrl: process.env.NEXT_PUBLIC_DASHBOARD_API_URL,
          explicitCampaignsApiUrl: apiUrl,
          section: "lower-detail",
        }),
        dashboardQuery,
      ),
    [apiUrl, dashboardQuery],
  );
  const summarySection = useDashboardSection<CampaignsSummarySection>({
    errorMessage: "Unable to load campaign summary.",
    url: summaryUrl,
  });
  const stateCompletionSection = useDashboardSection<
    CampaignStateCompletionRow[]
  >({
    errorMessage: "Unable to load state completion.",
    url: stateCompletionUrl,
  });
  const leadBehaviorSection = useDashboardSection<CampaignLeadTrendRow[]>({
    errorMessage: "Unable to load lead behaviour trends.",
    url: leadBehaviorUrl,
  });
  const resultsSection = useDashboardSection<CampaignsResultsSection>({
    errorMessage: "Unable to load campaign results.",
    url: resultsUrl,
  });
  const lowerDetailSection = useDashboardSection<CampaignsLowerDetailSection>({
    errorMessage: "Unable to load lower campaign detail.",
    url: lowerDetailUrl,
  });

  const loadAgentLatest = useCallback(
    async (signal?: AbortSignal) => {
      if (!agentLatestScopedUrl) {
        setAgentRun(null);
        setAgentError("A1 campaign brief URL is not configured.");
        return null;
      }

      setIsAgentLoading(true);
      setAgentError(null);

      try {
        const response = await fetch(agentLatestScopedUrl, {
          credentials: "include",
          signal,
        });

        if (!response.ok) {
          throw new Error("Unable to load A1 campaign brief.");
        }

        const latestRun = (await response.json()) as A1AgentLatestResponse;

        if (!signal?.aborted) {
          setAgentRun(latestRun);
        }

        return latestRun;
      } catch (caughtError) {
        if (!signal?.aborted) {
          setAgentError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load A1 campaign brief.",
          );
        }

        return null;
      } finally {
        if (!signal?.aborted) {
          setIsAgentLoading(false);
        }
      }
    },
    [agentLatestScopedUrl],
  );

  const queueAgentRun = useCallback(
    async ({
      brand = briefBrand,
      from = dailyBriefDateRange.from,
      queuedMessage = "Brief request sent. AI is preparing the update.",
      to = dailyBriefDateRange.to,
    }: {
      brand?: string | null;
      from?: string | null;
      queuedMessage?: string;
      to?: string | null;
    } = {}) => {
      if (!resolvedAgentRerunUrl) {
        setRerunStatus("Brief generation is not configured yet.");
        return;
      }

      const queuedAt = Date.now();
      setIsRerunning(true);
      setRerunStatus(null);

      try {
        const response = await fetch(resolvedAgentRerunUrl, {
          body: JSON.stringify({
            brand,
            from,
            reason: "manual_dashboard_rerun",
            requested_by: "dashboard",
            to,
          }),
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        if (!response.ok) {
          throw new Error("Unable to start the A1 campaign brief.");
        }

        setPendingAgentRun({
          brand,
          queuedAt,
          timeoutAt: queuedAt + AGENT_RUN_TIMEOUT_MS,
        });
        setRerunStatus(queuedMessage);
      } catch (caughtError) {
        setPendingAgentRun(null);
        setRerunStatus(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to start the A1 campaign brief.",
        );
      } finally {
        setIsRerunning(false);
      }
    },
    [
      briefBrand,
      dailyBriefDateRange.from,
      dailyBriefDateRange.to,
      resolvedAgentRerunUrl,
    ],
  );
  const handleRunAgain = useCallback(() => {
    void queueAgentRun();
  }, [queueAgentRun]);
  const handleBriefBrandChange = useCallback((brand: string | null) => {
    setBriefBrand(brand);
    setPendingAgentRun(null);
    setRerunStatus(null);
  }, []);

  const stateChartData = (stateCompletionSection.data ?? []).map((row) => ({
    ...row,
    completionPct: row.slGoal && row.slGoal > 0 ? row.sl / row.slGoal : 0,
  }));
  const visibleStateChartData = stateChartData.filter(hasStateCompletionData);
  const cplLimit =
    resultsSection.data?.cplLimit ??
    lowerDetailSection.data?.cplLimit ??
    summarySection.data?.alert.cplLimit ??
    250;
  const lastUpdated = formatLatestGeneratedAt([
    summarySection.generatedAt,
    stateCompletionSection.generatedAt,
    leadBehaviorSection.generatedAt,
    resultsSection.generatedAt,
    lowerDetailSection.generatedAt,
  ]);

  useEffect(() => {
    setChartsReady(true);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void loadAgentLatest(controller.signal);

    const interval = window.setInterval(() => {
      void loadAgentLatest();
    }, 30000);

    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [loadAgentLatest]);

  useEffect(() => {
    if (!pendingAgentRun) {
      return;
    }

    const activePendingRun = pendingAgentRun;
    let cancelled = false;
    let timeoutId: number | undefined;

    async function pollForAgentOutput() {
      const latestRun = await loadAgentLatest();

      if (cancelled) {
        return;
      }

      if (
        latestRun &&
        latestRunMatchesPendingRun(latestRun, activePendingRun)
      ) {
        setPendingAgentRun(null);
        setRerunStatus("Brief updated.");
        return;
      }

      if (Date.now() >= activePendingRun.timeoutAt) {
        setPendingAgentRun(null);
        setRerunStatus(
          "The brief is taking longer than usual. Refresh in a moment to check again.",
        );
        return;
      }

      timeoutId = window.setTimeout(
        pollForAgentOutput,
        AGENT_RUN_POLL_INTERVAL_MS,
      );
    }

    timeoutId = window.setTimeout(
      pollForAgentOutput,
      AGENT_RUN_POLL_INTERVAL_MS,
    );

    return () => {
      cancelled = true;

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [loadAgentLatest, pendingAgentRun]);

  useEffect(() => {
    if (!detailModal) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDetailModal(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [detailModal]);

  return (
    <>
      <DashboardShell activeItem="dashboard">
          <DashboardHeader
            lastUpdated={lastUpdated}
            subtitle="AI brief, campaign-level pacing, CPL risk, and lead behavior."
            title="AI Recommendations"
          />
          <DashboardTabs activeTab="campaigns" query={dashboardQuery} />
          <AgentBriefPanel
            brandError={null}
            brandOptions={A1_BRIEF_BRANDS}
            error={agentError}
            isBrandLoading={false}
            isAwaitingRun={Boolean(pendingAgentRun)}
            isLoading={isAgentLoading}
            isRerunning={isRerunning}
            latestRun={agentRun}
            onBrandChange={handleBriefBrandChange}
            onRefresh={() => void loadAgentLatest()}
            onRunAgain={resolvedAgentRerunUrl ? handleRunAgain : undefined}
            rerunStatus={rerunStatus}
            selectedBrand={briefBrand}
          />
          <section
            aria-label="Dashboard filters"
            className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
          >
            <div className="grid gap-3 xl:grid-cols-[minmax(14rem,0.75fr)_minmax(0,1.65fr)] xl:items-start">
              <BrandFilter
                apiUrl={apiUrl}
                dateRange={dailyBriefDateRange}
                onBrandChange={setSelectedBrand}
                selectedBrand={selectedBrand}
              />
              <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-sm font-semibold text-slate-700">
                  Daily brief date
                </p>
                <p className="mt-1 text-sm font-medium text-slate-950">
                  {dailyBriefDateRange.to}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Yesterday's completed data
                </p>
              </div>
            </div>
          </section>
          <CampaignSectionStatus
            error={summarySection.data ? summarySection.error : null}
            isRefreshing={summarySection.isRefreshing}
            onRetry={summarySection.retry}
          />
          {summarySection.data ? (
            <CampaignAlert
              campaignNames={summarySection.data.alert.campaignNames}
              cplLimit={cplLimit}
              message={summarySection.data.alert.message}
            />
          ) : summarySection.isLoading ? (
            <CampaignPanelSkeleton className="h-20" />
          ) : (
            <CampaignSectionError
              message={
                summarySection.error ?? "Unable to load campaign summary."
              }
              onRetry={summarySection.retry}
              title="Campaign summary could not be loaded"
            />
          )}
          {summarySection.data ? (
            <section className="grid gap-3 md:grid-cols-3">
              {summarySection.data.scorecards.map((scorecard) => (
                <CampaignScorecardItem
                  key={scorecard.id}
                  scorecard={scorecard}
                />
              ))}
            </section>
          ) : summarySection.isLoading ? (
            <CampaignScorecardSkeletonGrid />
          ) : null}
          <section className="grid gap-5">
            <CampaignSectionStatus
              error={
                stateCompletionSection.data
                  ? stateCompletionSection.error
                  : null
              }
              isRefreshing={stateCompletionSection.isRefreshing}
              onRetry={stateCompletionSection.retry}
            />
            {stateCompletionSection.data ? (
              <StateCompletionPanel
                chartsReady={chartsReady}
                onViewMore={() => setDetailModal("states")}
                rows={visibleStateChartData}
                totalRows={stateChartData.length}
              />
            ) : stateCompletionSection.isLoading ? (
              <CampaignPanelSkeleton className="h-96" />
            ) : (
              <CampaignSectionError
                message={
                  stateCompletionSection.error ??
                  "Unable to load state completion."
                }
                onRetry={stateCompletionSection.retry}
                title="State completion could not be loaded"
              />
            )}
            <CampaignSectionStatus
              error={
                leadBehaviorSection.data ? leadBehaviorSection.error : null
              }
              isRefreshing={leadBehaviorSection.isRefreshing}
              onRetry={leadBehaviorSection.retry}
            />
            {leadBehaviorSection.data ? (
              <LeadBehaviorPanel
                chartsReady={chartsReady}
                onViewMore={() => setDetailModal("campaigns")}
                rows={leadBehaviorSection.data}
              />
            ) : leadBehaviorSection.isLoading ? (
              <CampaignPanelSkeleton className="h-96" />
            ) : (
              <CampaignSectionError
                message={
                  leadBehaviorSection.error ??
                  "Unable to load lead behaviour trends."
                }
                onRetry={leadBehaviorSection.retry}
                title="Lead behaviour could not be loaded"
              />
            )}
          </section>
          {summarySection.data ? (
            <section className="grid gap-3 md:grid-cols-2">
              <InsightCard
                insight={summarySection.data.topPerformer}
                tone="positive"
              />
              <InsightCard
                insight={summarySection.data.lowestPerformer}
                tone="warning"
              />
            </section>
          ) : summarySection.isLoading ? (
            <CampaignInsightSkeletonGrid />
          ) : null}
          <CampaignSectionStatus
            error={resultsSection.data ? resultsSection.error : null}
            isRefreshing={resultsSection.isRefreshing}
            onRetry={resultsSection.retry}
          />
          {resultsSection.data ? (
            <CampaignResultsTable
              cplLimit={resultsSection.data.cplLimit}
              rows={resultsSection.data.campaignRows}
            />
          ) : resultsSection.isLoading ? (
            <CampaignPanelSkeleton className="h-80" />
          ) : (
            <CampaignSectionError
              message={
                resultsSection.error ?? "Unable to load campaign results."
              }
              onRetry={resultsSection.retry}
              title="Campaign results could not be loaded"
            />
          )}
          <CampaignSectionStatus
            error={lowerDetailSection.data ? lowerDetailSection.error : null}
            isRefreshing={lowerDetailSection.isRefreshing}
            onRetry={lowerDetailSection.retry}
          />
          {lowerDetailSection.data ? (
            <CampaignLowerDetailSection
              brandLabel={brandLabel}
              chartsReady={chartsReady}
              cplLimit={lowerDetailSection.data.cplLimit}
              snapshotRows={lowerDetailSection.data.lowerSnapshotRows}
              spendRows={lowerDetailSection.data.spendRows}
              statusDistributionRows={
                lowerDetailSection.data.statusDistributionRows
              }
            />
          ) : lowerDetailSection.isLoading ? (
            <CampaignLowerDetailSkeleton />
          ) : (
            <CampaignSectionError
              message={
                lowerDetailSection.error ??
                "Unable to load lower campaign detail."
              }
              onRetry={lowerDetailSection.retry}
              title="Lower detail could not be loaded"
            />
          )}
      </DashboardShell>
      <CampaignDetailModal
        chartsReady={chartsReady}
        leadRows={leadBehaviorSection.data ?? []}
        onClose={() => setDetailModal(null)}
        stateRows={visibleStateChartData}
        view={detailModal}
      />
    </>
  );
}

function CampaignPanelSkeleton({ className = "h-80" }: { className?: string }) {
  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}
    >
      <div className="flex h-full min-h-12 items-center justify-center rounded-md bg-slate-50">
        <LoadingNotice label="Loading campaign data..." />
      </div>
    </section>
  );
}

function CampaignScorecardSkeletonGrid() {
  return (
    <section className="grid gap-3 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <CampaignPanelSkeleton className="h-36" key={index} />
      ))}
    </section>
  );
}

function CampaignInsightSkeletonGrid() {
  return (
    <section className="grid gap-3 md:grid-cols-2">
      {Array.from({ length: 2 }).map((_, index) => (
        <CampaignPanelSkeleton className="h-36" key={index} />
      ))}
    </section>
  );
}

function CampaignLowerDetailSkeleton() {
  return (
    <section className="grid gap-5">
      <CampaignPanelSkeleton className="h-80" />
      <CampaignPanelSkeleton className="h-28" />
      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
        <CampaignPanelSkeleton className="h-96" />
        <CampaignPanelSkeleton className="h-96" />
      </section>
    </section>
  );
}

function CampaignSectionStatus({
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
        {!error ? <LoadingSpinner label="Refreshing campaign data" /> : null}
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

function LoadingNotice({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
      <LoadingSpinner label={label} />
      <span>{label}</span>
    </div>
  );
}

function CampaignSectionError({
  message,
  onRetry,
  title,
}: {
  message: string;
  onRetry: () => void;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-rose-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-rose-800">{title}</h2>
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

function CampaignAlert({
  campaignNames,
  cplLimit,
  message,
}: {
  campaignNames: string[];
  cplLimit: number;
  message: string;
}) {
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-amber-950">
          {message} CPL limit: {formatCurrency(cplLimit)}.
        </p>
        <p className="mt-1 text-sm text-amber-800">
          {campaignNames.join(", ")}
        </p>
      </div>
    </section>
  );
}

function CampaignScorecardItem({
  scorecard,
}: {
  scorecard: CampaignScorecard;
}) {
  return (
    <article
      className={`rounded-lg border p-4 shadow-sm ${scorecardClasses[scorecard.status]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal opacity-75">
            {scorecard.label}
          </p>
          <p className="mt-2 text-3xl font-bold">
            {scorecard.id === "cpl"
              ? formatCurrency(scorecard.primaryValue)
              : formatNumber(scorecard.primaryValue)}
          </p>
        </div>
        <span className="rounded-md border border-white/70 bg-white/70 px-2 py-1 text-xs font-semibold">
          {scorecard.primaryLabel}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {scorecard.secondaryItems.map((item) => (
          <div
            className="rounded-md border border-white/70 bg-white/60 px-3 py-2"
            key={item.label}
          >
            <dt className="text-xs font-medium opacity-70">{item.label}</dt>
            <dd className="mt-1 font-semibold">{item.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function StateCompletionPanel({
  chartsReady,
  onViewMore,
  rows,
  totalRows,
}: {
  chartsReady: boolean;
  onViewMore: () => void;
  rows: StateCompletionChartRow[];
  totalRows: number;
}) {
  const chartRows = rows.filter(hasVisibleStateCompletionBar);
  const visibleRows = chartRows.slice(0, PANEL_ROW_LIMIT);
  const chartDomainMax = getRateDomainMax(
    visibleRows.map((row) => row.completionPct),
    1.25,
  );
  const hiddenEmptyRows = Math.max(totalRows - rows.length, 0);
  const hiddenZeroRows = Math.max(rows.length - chartRows.length, 0);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            SL completion by accident state
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Actual signed leads against accident-state goals.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StateCompletionLegend />
          <ViewMoreButton
            onClick={onViewMore}
            visible={rows.length > visibleRows.length}
          />
        </div>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(18rem,0.62fr)_minmax(0,1.38fr)]">
        <CompactStateSummary rows={visibleRows} totalCount={rows.length} />
        <div className="h-96 min-w-0 overflow-hidden">
          {visibleRows.length === 0 ? (
            <EmptyChartState
              message={
                rows.length > 0
                  ? "No states have positive signed-lead completion yet."
                  : "No states have signed leads or goals yet."
              }
            />
          ) : chartsReady ? (
            <ResponsiveContainer height="100%" width="100%">
              <BarChart
                data={visibleRows}
                layout="vertical"
                margin={{ bottom: 12, left: 8, right: 28, top: 12 }}
              >
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis
                  domain={[0, chartDomainMax]}
                  tickFormatter={formatPercentage}
                  type="number"
                />
                <YAxis
                  dataKey="state"
                  tickFormatter={(value) => truncateLabel(String(value), 16)}
                  tick={{ fontSize: 12 }}
                  type="category"
                  width={112}
                />
                <Tooltip
                  labelFormatter={(label) => String(label)}
                  formatter={(value) => [
                    formatPercentage(
                      typeof value === "number" ? value : Number(value),
                    ),
                    "SL completion",
                  ]}
                />
                <ReferenceLine
                  ifOverflow="extendDomain"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  x={1}
                />
                <Bar
                  dataKey="completionPct"
                  name="SL completion"
                  radius={[0, 4, 4, 0]}
                >
                  {visibleRows.map((row) => (
                    <Cell
                      fill={getStateCompletionColor(row.completionPct)}
                      key={row.state}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartPlaceholder />
          )}
        </div>
      </div>
      {chartRows.length > visibleRows.length ? (
        <p className="mt-3 text-xs font-medium text-slate-500">
          Top {visibleRows.length} of {chartRows.length} states with positive
          completion shown here. Use View more for the complete active-state
          list.
        </p>
      ) : null}
      {hiddenZeroRows > 0 ? (
        <p className="mt-2 text-xs font-medium text-slate-500">
          {hiddenZeroRows} zero-completion states are hidden from this mini
          chart and available in View more.
        </p>
      ) : null}
      {hiddenEmptyRows > 0 ? (
        <p className="mt-2 text-xs font-medium text-slate-500">
          {hiddenEmptyRows} states with no signed leads or goals are hidden from
          this chart.
        </p>
      ) : null}
    </section>
  );
}

function StateCompletionLegend() {
  const items = [
    { className: "bg-teal-500", label: "At or above goal" },
    { className: "bg-amber-400", label: "Near goal" },
    { className: "bg-rose-600", label: "Below goal" },
  ];

  return (
    <div
      aria-label="State completion chart legend"
      className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600"
    >
      {items.map((item) => (
        <span className="inline-flex items-center gap-1.5" key={item.label}>
          <span
            aria-hidden="true"
            className={`size-2.5 rounded-sm ${item.className}`}
          />
          {item.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="h-3.5 w-2 border-l-2 border-sky-500"
        />
        Goal line
      </span>
    </div>
  );
}

function LeadBehaviorPanel({
  chartsReady,
  onViewMore,
  rows,
}: {
  chartsReady: boolean;
  onViewMore: () => void;
  rows: CampaignLeadTrendRow[];
}) {
  const visibleRows = rows.slice(0, PANEL_ROW_LIMIT);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Lead behaviour trends by campaign
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            SL, drops, leads, drop rate, conversion, and no-accident rate.
          </p>
        </div>
        <ViewMoreButton
          onClick={onViewMore}
          visible={rows.length > PANEL_ROW_LIMIT}
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(22rem,0.72fr)_minmax(0,1.28fr)]">
        <CompactCampaignSummary rows={visibleRows} totalCount={rows.length} />
        <div className="h-96 min-w-0 overflow-hidden">
          {chartsReady ? (
            <ResponsiveContainer height="100%" width="100%">
              <ComposedChart
                data={visibleRows}
                layout="vertical"
                margin={{ bottom: 12, left: 8, right: 24, top: 12 }}
              >
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                  type="number"
                  xAxisId="count"
                />
                <XAxis domain={[0, 1]} hide type="number" xAxisId="rate" />
                <YAxis
                  dataKey="campaign"
                  tickFormatter={(value) => truncateLabel(String(value), 24)}
                  tick={{ fontSize: 12 }}
                  type="category"
                  width={168}
                />
                <Tooltip
                  labelFormatter={(label) => String(label)}
                  formatter={(value, name) => {
                    const label = String(name);
                    const numericValue =
                      typeof value === "number" ? value : Number(value);

                    if (label.includes("rate")) {
                      return [formatPercentage(numericValue), label];
                    }

                    return [formatNumber(numericValue), label];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="leads"
                  fill="#7dd3fc"
                  name="Leads"
                  radius={[0, 4, 4, 0]}
                  xAxisId="count"
                />
                <Bar
                  dataKey="sl"
                  fill="#14b8a6"
                  name="SL"
                  radius={[0, 4, 4, 0]}
                  xAxisId="count"
                />
                <Bar
                  dataKey="drops"
                  fill="#f59e0b"
                  name="Drops"
                  radius={[0, 4, 4, 0]}
                  xAxisId="count"
                />
                <Line
                  dataKey="conversionRate"
                  dot={{ fill: "#0ea5e9", r: 3 }}
                  name="Conversion rate"
                  stroke="#0ea5e9"
                  strokeWidth={3}
                  type="monotone"
                  xAxisId="rate"
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <ChartPlaceholder />
          )}
        </div>
      </div>
      {rows.length > visibleRows.length ? (
        <p className="mt-3 text-xs font-medium text-slate-500">
          Top {visibleRows.length} of {rows.length} campaigns shown here. Full
          campaign detail appears in the table below.
        </p>
      ) : null}
    </section>
  );
}

function ChartPlaceholder() {
  return (
    <div className="h-full w-full animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-4 text-center text-sm font-medium text-slate-500">
      {message}
    </div>
  );
}

function ViewMoreButton({
  onClick,
  visible,
}: {
  onClick: () => void;
  visible: boolean;
}) {
  if (!visible) {
    return null;
  }

  return (
    <button
      className="w-fit rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
      onClick={onClick}
      type="button"
    >
      View more
    </button>
  );
}

function CampaignDetailModal({
  chartsReady,
  leadRows,
  onClose,
  stateRows,
  view,
}: {
  chartsReady: boolean;
  leadRows: CampaignLeadTrendRow[];
  onClose: () => void;
  stateRows: StateCompletionChartRow[];
  view: CampaignDetailModalView;
}) {
  if (!view) {
    return null;
  }

  const isStateView = view === "states";

  return (
    <div
      aria-labelledby="campaign-detail-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 text-slate-950 sm:p-6"
      role="dialog"
    >
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div>
            <h2
              className="text-base font-semibold text-slate-950"
              id="campaign-detail-modal-title"
            >
              {isStateView
                ? "SL completion by accident state"
                : "Lead behaviour trends by campaign"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {isStateView
                ? "Full accident-state table with signed leads, goals, and completion."
                : "Full campaign table with leads, signed leads, drops, and drop rate."}
            </p>
          </div>
          <button
            className="w-fit rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-5">
          {isStateView ? (
            <div className="grid gap-5">
              <DetailedStateCompletionChart
                chartsReady={chartsReady}
                rows={stateRows}
              />
              <DetailedStateCompletionTable rows={stateRows} />
            </div>
          ) : (
            <DetailedLeadBehaviorTable rows={leadRows} />
          )}
        </div>
      </div>
    </div>
  );
}

function DetailedStateCompletionTable({
  rows,
}: {
  rows: StateCompletionChartRow[];
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-slate-200 md:block">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[46%]" />
            <col className="w-[16%]" />
            <col className="w-[18%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead className="bg-sky-50 text-xs uppercase tracking-normal text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold" scope="col">
                State
              </th>
              <th className="px-4 py-3 text-right font-semibold" scope="col">
                SL
              </th>
              <th className="px-4 py-3 text-right font-semibold" scope="col">
                Goal
              </th>
              <th className="px-4 py-3 text-right font-semibold" scope="col">
                Completion
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((row) => (
              <tr className="bg-white" key={row.state}>
                <td className="px-4 py-3 font-medium text-slate-950">
                  {row.state}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {formatNumber(row.sl)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {formatNumber(row.slGoal)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-950">
                  {formatPercentage(row.completionPct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <article
            className="rounded-lg border border-slate-200 bg-white p-3"
            key={row.state}
          >
            <h3 className="text-sm font-semibold text-slate-950">
              {row.state}
            </h3>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <MetricItem label="SL" value={formatNumber(row.sl)} />
              <MetricItem label="Goal" value={formatNumber(row.slGoal)} />
              <MetricItem
                label="Completion"
                value={formatPercentage(row.completionPct)}
              />
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}

function DetailedStateCompletionChart({
  chartsReady,
  rows,
}: {
  chartsReady: boolean;
  rows: StateCompletionChartRow[];
}) {
  const chartDomainMax = getRateDomainMax(
    rows.map((row) => row.completionPct),
    1.25,
  );
  const chartHeight = Math.max(320, rows.length * 42 + 72);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">
            Complete active-state chart
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            States with no signed leads or goals are omitted.
          </p>
        </div>
        <StateCompletionLegend />
      </div>

      <div className="mt-4 min-w-0 overflow-x-auto">
        <div className="min-w-[720px]" style={{ height: chartHeight }}>
          {rows.length === 0 ? (
            <EmptyChartState message="No states have signed leads or goals yet." />
          ) : chartsReady ? (
            <ResponsiveContainer height="100%" width="100%">
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ bottom: 12, left: 8, right: 28, top: 12 }}
              >
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis
                  domain={[0, chartDomainMax]}
                  tickFormatter={formatPercentage}
                  type="number"
                />
                <YAxis
                  dataKey="state"
                  tickFormatter={(value) => truncateLabel(String(value), 22)}
                  tick={{ fontSize: 12 }}
                  type="category"
                  width={140}
                />
                <Tooltip
                  labelFormatter={(label) => String(label)}
                  formatter={(value) => [
                    formatPercentage(
                      typeof value === "number" ? value : Number(value),
                    ),
                    "SL completion",
                  ]}
                />
                <ReferenceLine
                  ifOverflow="extendDomain"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  x={1}
                />
                <Bar
                  dataKey="completionPct"
                  name="SL completion"
                  radius={[0, 4, 4, 0]}
                >
                  {rows.map((row) => (
                    <Cell
                      fill={getStateCompletionColor(row.completionPct)}
                      key={row.state}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartPlaceholder />
          )}
        </div>
      </div>
    </section>
  );
}

function DetailedLeadBehaviorTable({ rows }: { rows: CampaignLeadTrendRow[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-slate-200 lg:block">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[42%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead className="bg-sky-50 text-xs uppercase tracking-normal text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold" scope="col">
                Campaign
              </th>
              <th className="px-4 py-3 text-right font-semibold" scope="col">
                Leads
              </th>
              <th className="px-4 py-3 text-right font-semibold" scope="col">
                SL
              </th>
              <th className="px-4 py-3 text-right font-semibold" scope="col">
                Drops
              </th>
              <th className="px-4 py-3 text-right font-semibold" scope="col">
                Drop rate
              </th>
              <th className="px-4 py-3 text-right font-semibold" scope="col">
                Conv.
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((row) => (
              <tr className="bg-white" key={row.campaign}>
                <td className="px-4 py-3">
                  <div
                    className="truncate font-medium text-slate-950"
                    title={row.campaign}
                  >
                    {row.campaign}
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {formatNumber(row.leads)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {formatNumber(row.sl)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {formatNumber(row.drops)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                  {formatPercentage(row.dropRate)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-950">
                  {formatPercentage(row.conversionRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 lg:hidden">
        {rows.map((row) => (
          <article
            className="rounded-lg border border-slate-200 bg-white p-3"
            key={row.campaign}
          >
            <h3 className="truncate text-sm font-semibold text-slate-950">
              {row.campaign}
            </h3>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <MetricItem label="Leads" value={formatNumber(row.leads)} />
              <MetricItem label="SL" value={formatNumber(row.sl)} />
              <MetricItem label="Drops" value={formatNumber(row.drops)} />
              <MetricItem
                label="Drop rate"
                value={formatPercentage(row.dropRate)}
              />
              <MetricItem
                label="Conversion"
                value={formatPercentage(row.conversionRate)}
              />
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}

function CompactStateSummary({
  rows,
  totalCount,
}: {
  rows: StateCompletionChartRow[];
  totalCount: number;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 text-xs">
      <div className="grid grid-cols-[minmax(0,1fr)_3rem_3.4rem_3.8rem] gap-2 bg-sky-50 px-3 py-2 font-semibold text-slate-600">
        <span>State</span>
        <span className="text-right">SL</span>
        <span className="text-right">Goal</span>
        <span className="text-right">%</span>
      </div>
      <div className="divide-y divide-slate-200 bg-white">
        {rows.length > 0 ? (
          rows.map((row) => (
            <div
              className="grid grid-cols-[minmax(0,1fr)_3rem_3.4rem_3.8rem] gap-2 px-3 py-2 text-slate-700"
              key={row.state}
            >
              <span
                className="min-w-0 truncate font-medium text-slate-950"
                title={row.state}
              >
                {row.state}
              </span>
              <span className="text-right tabular-nums">
                {formatNumber(row.sl)}
              </span>
              <span className="text-right tabular-nums">
                {formatNumber(row.slGoal)}
              </span>
              <span className="text-right tabular-nums">
                {formatPercentage(row.completionPct)}
              </span>
            </div>
          ))
        ) : (
          <div className="px-3 py-4 text-center text-slate-500">
            No active states yet.
          </div>
        )}
      </div>
      {totalCount > rows.length ? (
        <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-slate-500">
          {rows.length} of {totalCount} states
        </div>
      ) : null}
    </div>
  );
}

function CompactCampaignSummary({
  rows,
  totalCount,
}: {
  rows: CampaignLeadTrendRow[];
  totalCount: number;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 text-xs">
      <div className="grid grid-cols-[minmax(0,1fr)_3.2rem_2.6rem_3.2rem_3.8rem] gap-2 bg-sky-50 px-3 py-2 font-semibold text-slate-600">
        <span>Campaign</span>
        <span className="text-right">Leads</span>
        <span className="text-right">SL</span>
        <span className="text-right">Drops</span>
        <span className="text-right">Drop %</span>
      </div>
      <div className="divide-y divide-slate-200 bg-white">
        {rows.map((row) => (
          <div
            className="grid grid-cols-[minmax(0,1fr)_3.2rem_2.6rem_3.2rem_3.8rem] gap-2 px-3 py-2 text-slate-700"
            key={row.campaign}
          >
            <span
              className="min-w-0 truncate font-medium text-slate-950"
              title={row.campaign}
            >
              {row.campaign}
            </span>
            <span className="text-right tabular-nums">
              {formatNumber(row.leads)}
            </span>
            <span className="text-right tabular-nums">
              {formatNumber(row.sl)}
            </span>
            <span className="text-right tabular-nums">
              {formatNumber(row.drops)}
            </span>
            <span className="text-right tabular-nums">
              {formatPercentage(row.dropRate)}
            </span>
          </div>
        ))}
      </div>
      {totalCount > rows.length ? (
        <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-slate-500">
          {rows.length} of {totalCount} campaigns
        </div>
      ) : null}
    </div>
  );
}

function InsightCard({
  insight,
  tone,
}: {
  insight: CampaignInsight;
  tone: "positive" | "warning";
}) {
  const toneClass =
    tone === "positive"
      ? "border-teal-200 bg-teal-50 text-teal-950"
      : "border-amber-200 bg-amber-50 text-amber-950";

  return (
    <article className={`rounded-lg border p-4 shadow-sm ${toneClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal opacity-70">
            {tone === "positive" ? "Top performer" : "Lowest performer"}
          </p>
          <h3 className="mt-1 text-base font-semibold">{insight.campaign}</h3>
          <p className="mt-2 text-sm leading-6 opacity-80">
            {insight.description}
          </p>
        </div>
        <div className="w-fit rounded-md border border-white/70 bg-white/70 px-3 py-2">
          <p className="text-xs font-medium opacity-70">
            {insight.metricLabel}
          </p>
          <p className="mt-1 text-lg font-bold">{insight.metricValue}</p>
        </div>
      </div>
    </article>
  );
}

function CampaignResultsTable({
  cplLimit,
  rows,
}: {
  cplLimit: number;
  rows: CampaignResultRow[];
}) {
  const hasRows = rows.length > 0;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-slate-950">
          Results table by campaign
        </h2>
        <button
          className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          disabled={!hasRows}
          onClick={() => exportCampaignResultsCsv(rows)}
          type="button"
        >
          Export CSV
        </button>
      </div>
      <div className="hidden xl:block">
        <table className="w-full table-fixed border-collapse text-left text-xs">
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[9%]" />
            <col className="w-[8%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[5%]" />
            <col className="w-[6.5%]" />
            <col className="w-[7.5%]" />
            <col className="w-[5%]" />
            <col className="w-[5.5%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead className="bg-sky-50 uppercase tracking-normal text-slate-600">
            <tr>
              <th className="px-3 py-3 font-semibold" scope="col">
                Campaign
              </th>
              <th className="px-3 py-3 font-semibold" scope="col">
                Active marketing states
              </th>
              <th className="px-3 py-3 font-semibold" scope="col">
                Spend
              </th>
              <th className="px-3 py-3 font-semibold" scope="col">
                CPL
              </th>
              <th className="px-3 py-3 font-semibold" scope="col">
                CPSL
              </th>
              <th className="px-3 py-3 font-semibold" scope="col">
                SL
              </th>
              <th className="px-3 py-3 font-semibold" scope="col">
                SL Goal
              </th>
              <th className="px-3 py-3 font-semibold" scope="col">
                Leads Goal
              </th>
              <th className="px-3 py-3 font-semibold" scope="col">
                Leads
              </th>
              <th className="px-3 py-3 font-semibold" scope="col">
                Drops
              </th>
              <th className="px-3 py-3 font-semibold" scope="col">
                Drop rate
              </th>
              <th className="px-3 py-3 font-semibold" scope="col">
                Conversion
              </th>
              <th className="px-3 py-3 font-semibold" scope="col">
                Active Leads
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((row) => (
              <tr
                className={
                  row.cpl != null && row.cpl > cplLimit
                    ? "bg-rose-50"
                    : "bg-white"
                }
                key={row.campaign}
              >
                <td className="px-3 py-3">
                  <div
                    className="truncate font-semibold text-slate-950"
                    title={row.campaign}
                  >
                    {row.campaign}
                  </div>
                  <div
                    className="mt-1 truncate text-slate-500"
                    title={row.status}
                  >
                    {row.status}
                  </div>
                </td>
                <td
                  className="truncate px-3 py-3 text-slate-700"
                  title={row.activeMarketingStates}
                >
                  {row.activeMarketingStates}
                </td>
                <td className="px-3 py-3 font-semibold text-slate-950">
                  {formatCurrency(row.spend)}
                </td>
                <td className="px-3 py-3 font-semibold text-slate-950">
                  {formatCurrency(row.cpl)}
                </td>
                <td className="px-3 py-3 font-semibold text-slate-950">
                  {formatCurrency(row.cpsl)}
                </td>
                <td className="px-3 py-3 text-slate-700">
                  {formatNumber(row.sl)}
                </td>
                <td className="px-3 py-3 text-slate-700">
                  {formatNumber(row.slGoal)}
                </td>
                <td className="px-3 py-3 text-slate-700">
                  {formatNumber(row.leadsGoal)}
                </td>
                <td className="px-3 py-3 text-slate-700">
                  {formatNumber(row.leads)}
                </td>
                <td className="px-3 py-3 text-slate-700">
                  {formatNumber(row.drops)}
                </td>
                <td className="px-3 py-3 text-slate-700">
                  {formatPercentage(row.dropRate)}
                </td>
                <td className="px-3 py-3 text-slate-700">
                  {formatPercentage(row.conversionRate)}
                </td>
                <td className="px-3 py-3 text-slate-700">
                  {formatNumber(row.mql)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 p-3 xl:hidden">
        {rows.map((row) => (
          <CampaignResultCard
            cplLimit={cplLimit}
            key={row.campaign}
            row={row}
          />
        ))}
      </div>
    </section>
  );
}

function exportCampaignResultsCsv(rows: CampaignResultRow[]): void {
  const csv = toCsv([
    [
      "Campaign",
      "Status",
      "Active marketing states",
      "Spend (USD)",
      "CPL (USD)",
      "CPSL (USD)",
      "SL",
      "SL Goal",
      "Leads Goal",
      "Leads",
      "Drops",
      "Drop rate (%)",
      "Conversion (%)",
      "Active Leads",
    ],
    ...rows.map((row) => [
      row.campaign,
      row.status,
      row.activeMarketingStates,
      row.spend,
      row.cpl,
      row.cpsl,
      row.sl,
      row.slGoal,
      row.leadsGoal,
      row.leads,
      row.drops,
      toCsvPercentage(row.dropRate),
      toCsvPercentage(row.conversionRate),
      row.mql,
    ]),
  ]);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `campaign-results-${formatCsvDateStamp(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Array<Array<number | string | null>>): string {
  return rows.map((row) => row.map(formatCsvCell).join(",")).join("\r\n");
}

function formatCsvCell(value: number | string | null): string {
  if (value == null) {
    return "";
  }

  const text = String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function toCsvPercentage(value: number | null): number | null {
  return value == null ? null : value * 100;
}

function formatCsvDateStamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function CampaignResultCard({
  cplLimit,
  row,
}: {
  cplLimit: number;
  row: CampaignResultRow;
}) {
  return (
    <article
      className={`rounded-lg border p-3 ${
        row.cpl != null && row.cpl > cplLimit
          ? "border-rose-200 bg-rose-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-950">
            {row.campaign}
          </h3>
          <p className="mt-1 truncate text-xs text-slate-500">{row.status}</p>
        </div>
        <p className="text-xs font-medium text-slate-500">
          {row.activeMarketingStates}
        </p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <MetricItem label="Spend" value={formatCurrency(row.spend)} />
        <MetricItem label="CPL" value={formatCurrency(row.cpl)} />
        <MetricItem label="CPSL" value={formatCurrency(row.cpsl)} />
        <MetricItem label="SL" value={formatNumber(row.sl)} />
        <MetricItem label="SL Goal" value={formatNumber(row.slGoal)} />
        <MetricItem label="Leads Goal" value={formatNumber(row.leadsGoal)} />
        <MetricItem label="Leads" value={formatNumber(row.leads)} />
        <MetricItem label="Drops" value={formatNumber(row.drops)} />
        <MetricItem label="Drop rate" value={formatPercentage(row.dropRate)} />
        <MetricItem
          label="Conversion"
          value={formatPercentage(row.conversionRate)}
        />
        <MetricItem label="Active Leads" value={formatNumber(row.mql)} />
      </dl>
    </article>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
      <dt className="truncate text-slate-500">{label}</dt>
      <dd className="mt-1 truncate font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function CampaignLowerDetailSection({
  brandLabel,
  chartsReady,
  cplLimit,
  snapshotRows,
  spendRows,
  statusDistributionRows,
}: {
  brandLabel: string;
  chartsReady: boolean;
  cplLimit: number;
  snapshotRows: CampaignStateSnapshotRow[];
  spendRows: CampaignSpendRow[];
  statusDistributionRows: CampaignStatusDistributionRow[];
}) {
  return (
    <section className="grid gap-5">
      <CampaignSnapshotTable
        brandLabel={brandLabel}
        cplLimit={cplLimit}
        rows={snapshotRows}
      />
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Active Leads
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Conditional formatting reference for CPL and campaign quality
              checks.
            </p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3 lg:w-[34rem] lg:max-w-full">
            <ConditionalLegend label="Below CPL limit" tone="healthy" />
            <ConditionalLegend label="Near CPL limit" tone="watch" />
            <ConditionalLegend label="Above CPL limit" tone="critical" />
          </div>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
        <SpendByCampaignPanel chartsReady={chartsReady} rows={spendRows} />
        <LeadStatusDistributionPanel
          chartsReady={chartsReady}
          rows={statusDistributionRows}
        />
      </div>
    </section>
  );
}

function CampaignSnapshotTable({
  brandLabel,
  cplLimit,
  rows,
}: {
  brandLabel: string;
  cplLimit: number;
  rows: CampaignStateSnapshotRow[];
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Results table by campaign
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            State snapshot with conditional CPL formatting.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-slate-700">
            Formato condicional
          </span>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
            %
          </span>
        </div>
      </div>
      <div className="hidden xl:block">
        <table className="w-full table-fixed border-collapse text-left text-xs">
          <colgroup>
            <col className="w-[11%]" />
            <col className="w-[8.5%]" />
            <col className="w-[6.5%]" />
            <col className="w-[8%]" />
            <col className="w-[8.5%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[8.5%]" />
            <col className="w-[8.5%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[8%]" />
            <col className="w-[6.5%]" />
          </colgroup>
          <thead>
            <tr className="bg-slate-950 text-white">
              <th className="px-2 py-2 text-amber-200" scope="col">
                <span className="block truncate" title={brandLabel}>
                  {brandLabel}
                </span>
              </th>
              <th className="px-2 py-2" scope="col">
                Budget
              </th>
              <th className="px-2 py-2" scope="col">
                SL Goal
              </th>
              <th className="px-2 py-2" scope="col">
                Leads Goal
              </th>
              <th className="px-2 py-2" scope="col">
                MTD Spent
              </th>
              <th className="px-2 py-2" scope="col">
                % Spent
              </th>
              <th className="px-2 py-2" scope="col">
                % Goal
              </th>
              <th className="px-2 py-2" scope="col">
                CPSL
              </th>
              <th className="px-2 py-2" scope="col">
                Cost / Active Lead
              </th>
              <th className="px-2 py-2" scope="col">
                MTD SL
              </th>
              <th className="px-2 py-2" scope="col">
                Leads
              </th>
              <th className="px-2 py-2" scope="col">
                Conversion Rate
              </th>
              <th className="border-l-4 border-amber-400 px-2 py-2" scope="col">
                CPL
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-teal-700/20">
            {rows.map((row) => {
              const spentPct = safeRatio(row.mtdSpent, row.budget);
              const goalPct = safeRatio(row.mtdSl, row.slGoal);

              return (
                <tr className="bg-teal-700/90 text-white" key={row.state}>
                  <td
                    className="truncate px-2 py-2 font-bold uppercase"
                    title={row.state}
                  >
                    {row.state}
                  </td>
                  <td className="px-2 py-2">{formatCurrency(row.budget)}</td>
                  <td className="px-2 py-2">{formatNumber(row.slGoal)}</td>
                  <td className="px-2 py-2">{formatNumber(row.leadsGoal)}</td>
                  <td className="px-2 py-2">{formatCurrency(row.mtdSpent)}</td>
                  <td className="px-2 py-2">{formatPercentage(spentPct)}</td>
                  <td className="px-2 py-2">{formatPercentage(goalPct)}</td>
                  <td className="px-2 py-2">{formatCurrency(row.cpsl)}</td>
                  <td className="px-2 py-2">{formatCurrency(row.cpql)}</td>
                  <td className="px-2 py-2">{formatNumber(row.mtdSl)}</td>
                  <td className="px-2 py-2">{formatNumber(row.leads)}</td>
                  <td className="px-2 py-2">
                    {formatPercentage(row.conversionRate)}
                  </td>
                  <td
                    className={`border-l-4 border-amber-400 px-2 py-2 font-semibold ${
                      row.cpl != null && row.cpl > cplLimit
                        ? "bg-rose-100 text-rose-950"
                        : row.cpl != null && row.cpl > cplLimit * 0.8
                          ? "bg-amber-100 text-amber-950"
                          : "bg-teal-100 text-teal-950"
                    }`}
                  >
                    {formatCurrency(row.cpl)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 p-3 xl:hidden">
        {rows.map((row) => (
          <CampaignSnapshotCard cplLimit={cplLimit} key={row.state} row={row} />
        ))}
      </div>
    </section>
  );
}

function CampaignSnapshotCard({
  cplLimit,
  row,
}: {
  cplLimit: number;
  row: CampaignStateSnapshotRow;
}) {
  const spentPct = safeRatio(row.mtdSpent, row.budget);
  const goalPct = safeRatio(row.mtdSl, row.slGoal);

  return (
    <article className="rounded-lg border border-teal-800 bg-teal-700 p-3 text-white">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate text-sm font-bold uppercase">
          {row.state}
        </h3>
        <span
          className={`rounded-md px-2 py-1 text-xs font-semibold ${
            row.cpl != null && row.cpl > cplLimit
              ? "bg-rose-100 text-rose-950"
              : row.cpl != null && row.cpl > cplLimit * 0.8
                ? "bg-amber-100 text-amber-950"
                : "bg-teal-100 text-teal-950"
          }`}
        >
          CPL {formatCurrency(row.cpl)}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <SnapshotMetricItem label="Budget" value={formatCurrency(row.budget)} />
        <SnapshotMetricItem
          label="MTD Spent"
          value={formatCurrency(row.mtdSpent)}
        />
        <SnapshotMetricItem
          label="% Spent"
          value={formatPercentage(spentPct)}
        />
        <SnapshotMetricItem label="SL Goal" value={formatNumber(row.slGoal)} />
        <SnapshotMetricItem
          label="Leads Goal"
          value={formatNumber(row.leadsGoal)}
        />
        <SnapshotMetricItem label="% Goal" value={formatPercentage(goalPct)} />
        <SnapshotMetricItem label="CPSL" value={formatCurrency(row.cpsl)} />
        <SnapshotMetricItem
          label="Cost / Active Lead"
          value={formatCurrency(row.cpql)}
        />
        <SnapshotMetricItem label="MTD SL" value={formatNumber(row.mtdSl)} />
        <SnapshotMetricItem label="Leads" value={formatNumber(row.leads)} />
        <SnapshotMetricItem
          label="Conversion"
          value={formatPercentage(row.conversionRate)}
        />
      </dl>
    </article>
  );
}

function SnapshotMetricItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-white/20 bg-white/10 px-2 py-2">
      <dt className="truncate text-teal-50/80">{label}</dt>
      <dd className="mt-1 truncate font-semibold text-white">{value}</dd>
    </div>
  );
}

function ConditionalLegend({
  label,
  tone,
}: {
  label: string;
  tone: "healthy" | "watch" | "critical";
}) {
  const classes = {
    critical: "border-rose-200 bg-rose-50 text-rose-800",
    healthy: "border-teal-200 bg-teal-50 text-teal-800",
    watch: "border-amber-200 bg-amber-50 text-amber-800",
  };

  return (
    <div
      className={`flex items-center justify-between rounded-md border px-3 py-2 ${classes[tone]}`}
    >
      <span>{label}</span>
      <span className="h-3 w-10 rounded-full bg-current opacity-70" />
    </div>
  );
}

function SpendByCampaignPanel({
  chartsReady,
  rows,
}: {
  chartsReady: boolean;
  rows: CampaignSpendRow[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-slate-950">
          Spend by campaign
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Horizontal bar chart of MTD spend.
        </p>
      </div>
      <div className="mt-4 h-80 min-w-0 rounded-lg bg-slate-950 p-4">
        {chartsReady ? (
          <ResponsiveContainer height="100%" width="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ bottom: 8, left: 16, right: 24, top: 8 }}
            >
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
                tickFormatter={formatCurrency}
                type="number"
              />
              <YAxis
                dataKey="campaign"
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
                type="category"
                width={132}
              />
              <Tooltip
                contentStyle={{
                  background: "#020617",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  color: "#f8fafc",
                }}
                formatter={(value) => [
                  formatCurrency(
                    typeof value === "number" ? value : Number(value),
                  ),
                  "MTD spend",
                ]}
              />
              <Bar
                dataKey="spend"
                fill="#0ea5e9"
                name="Spend"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ChartPlaceholder />
        )}
      </div>
    </section>
  );
}

function LeadStatusDistributionPanel({
  chartsReady,
  rows,
}: {
  chartsReady: boolean;
  rows: CampaignStatusDistributionRow[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-slate-950">
          Leads by status by marketing state
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Stacked percentage distribution by lead status.
        </p>
      </div>
      <div className="mt-4 h-[28rem] min-w-0">
        {chartsReady ? (
          <ResponsiveContainer height="100%" width="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ bottom: 8, left: 16, right: 24, top: 8 }}
            >
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis
                domain={[0, 1]}
                tickFormatter={formatPercentage}
                type="number"
              />
              <YAxis
                dataKey="marketingState"
                tick={{ fontSize: 12 }}
                type="category"
                width={116}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatPercentage(
                    typeof value === "number" ? value : Number(value),
                  ),
                  String(name),
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="hotLeads"
                fill="#f59e0b"
                name="Hot Leads"
                stackId="status"
              />
              <Bar dataKey="drop" fill="#e11d48" name="Drop" stackId="status" />
              <Bar
                dataKey="signedUp"
                fill="#14b8a6"
                name="Signed Up"
                stackId="status"
              />
              <Bar
                dataKey="appointment"
                fill="#0ea5e9"
                name="Appointment"
                stackId="status"
              />
              <Bar
                dataKey="retainerSent"
                fill="#b45309"
                name="Retainer Sent - U"
                stackId="status"
              />
              <Bar
                dataKey="nullStatus"
                fill="#9ca3af"
                name="Null"
                stackId="status"
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ChartPlaceholder />
        )}
      </div>
    </section>
  );
}

function hasStateCompletionData(row: StateCompletionChartRow): boolean {
  return row.sl > 0 || (row.slGoal ?? 0) > 0;
}

function latestRunMatchesPendingRun(
  run: A1AgentLatestResponse,
  pendingRun: PendingAgentRun,
): boolean {
  if (run.status !== "success" || !run.generated_at || !run.payload) {
    return false;
  }

  const generatedAt = Date.parse(run.generated_at);

  if (
    !Number.isFinite(generatedAt) ||
    generatedAt + AGENT_RUN_POLL_INTERVAL_MS < pendingRun.queuedAt
  ) {
    return false;
  }

  const expectedBrand = normalizeLatestRunBrand(pendingRun.brand);
  const payloadScopeBrand = getLatestRunPayloadScopeBrand(run.payload);
  const actualBrand = normalizeLatestRunBrand(run.brand) ?? payloadScopeBrand;
  const actualScope =
    run.scope ?? (actualBrand ? "brand" : ("all_brands" as const));

  if (expectedBrand) {
    return actualScope === "brand" && actualBrand === expectedBrand;
  }

  return actualScope === "all_brands" && actualBrand === null;
}

function getLatestRunPayloadScopeBrand(
  payload: A1AgentLatestResponse["payload"],
): string | null {
  const crmOutput = payload?.crm_output;
  const scope = isRecord(crmOutput) ? crmOutput.scope : null;
  const brand = isRecord(scope) ? scope.brand : null;

  return normalizeLatestRunBrand(typeof brand === "string" ? brand : null);
}

function normalizeLatestRunBrand(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ");

  if (
    !normalized ||
    normalized.toLowerCase() === "all" ||
    normalized.toLowerCase() === "all brands"
  ) {
    return null;
  }

  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasVisibleStateCompletionBar(row: StateCompletionChartRow): boolean {
  return row.completionPct > 0;
}

function getStateCompletionColor(completionPct: number): string {
  if (completionPct >= 1) {
    return "#14b8a6";
  }

  if (completionPct >= 0.75) {
    return "#f59e0b";
  }

  return "#e11d48";
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

function safeRatio(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): number | null {
  if (
    typeof numerator !== "number" ||
    typeof denominator !== "number" ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return null;
  }

  return numerator / denominator;
}

function truncateLabel(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(maxLength - 3, 1))}...`;
}

function getRateDomainMax(values: number[], fallback: number): number {
  const maxValue = values.reduce(
    (currentMax, value) =>
      Number.isFinite(value) ? Math.max(currentMax, value) : currentMax,
    fallback,
  );

  return Math.ceil(maxValue * 4) / 4;
}
