import type {
  A1AgentLatestResponse,
  A1AgentOutput,
  A1DashboardAgentPayload,
} from "@/src/types/dashboard";
import {
  formatCurrency,
  formatDashboardTimestamp,
  formatNumber,
  formatPercentage,
} from "@/src/utils/dashboardFormatters";
import { LoadingSpinner } from "./LoadingSpinner";

interface AgentBriefPanelProps {
  error: string | null;
  isLoading: boolean;
  isRerunning: boolean;
  latestRun: A1AgentLatestResponse | null;
  onRefresh: () => void;
  onRunAgain?: () => void;
  rerunStatus: string | null;
}

interface BriefListItem {
  detail?: string;
  meta?: string;
  title: string;
}

type MetricTone = "critical" | "healthy" | "neutral" | "watch";

export function AgentBriefPanel({
  error,
  isLoading,
  isRerunning,
  latestRun,
  onRefresh,
  onRunAgain,
  rerunStatus,
}: AgentBriefPanelProps) {
  const payload = latestRun?.payload ?? null;
  const agentOutput = payload ? resolveAgentOutput(payload) : null;
  const fleetSummary = agentOutput?.fleet_summary ?? null;
  const summary = payload?.summary ?? null;
  const health = fleetSummary?.overall_health ?? summary?.overall_health;
  const topCampaigns = agentOutput?.top_campaigns ?? [];
  const underperformers = agentOutput?.underperformers ?? [];
  const anomalies = agentOutput?.anomalies ?? [];
  const recommendations = agentOutput?.recommendations ?? [];
  const dataQualityNotes =
    agentOutput?.data_quality_notes ?? getDataQualityWarnings(payload);
  const anomalyCount =
    anomalies.length > 0 ? anomalies.length : summary?.anomaly_count;
  const hasBriefContent =
    Boolean(agentOutput?.summary) ||
    topCampaigns.length > 0 ||
    underperformers.length > 0 ||
    anomalies.length > 0 ||
    recommendations.length > 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
              A1 Campaign Brief
            </p>
            {latestRun?.generated_at ? (
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                {formatTimestamp(latestRun.generated_at)}
              </span>
            ) : null}
          </div>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">
            {agentOutput?.report_date
              ? `Campaign performance review for ${agentOutput.report_date}`
              : "Campaign performance review"}
          </h2>
          {agentOutput?.summary ? (
            <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-600">
              {agentOutput.summary}
            </p>
          ) : isLoading ? (
            <p className="mt-2 flex items-center gap-2 text-sm leading-6 text-slate-600">
              <LoadingSpinner label="Loading A1 campaign brief" />
              Loading A1 campaign brief...
            </p>
          ) : (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {latestRun?.status === "success"
                ? "A1 output was received, but no readable brief is available yet."
                : "No A1 campaign brief received yet."}
            </p>
          )}
          {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
          {rerunStatus ? (
            <p className="mt-2 text-sm text-slate-500">{rerunStatus}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            onClick={onRefresh}
            type="button"
          >
            {isLoading ? (
              <LoadingSpinner
                className="h-3.5 w-3.5 text-slate-500"
                label="Refreshing A1 campaign brief"
              />
            ) : null}
            {isLoading ? "Refreshing" : "Refresh"}
          </button>
          {onRunAgain ? (
            <button
              className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={isRerunning}
              onClick={onRunAgain}
              type="button"
            >
              {isRerunning ? (
                <LoadingSpinner
                  className="h-3.5 w-3.5 text-white"
                  label="Queueing A1 campaign brief"
                />
              ) : null}
              {isRerunning ? "Running..." : "Run again"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <BriefMetric
          label="Health"
          tone={healthTone(health)}
          value={health ?? "-"}
        />
        <BriefMetric
          label="Leads"
          value={formatNumber(
            fleetSummary?.total_leads ?? summary?.total_leads,
          )}
        />
        <BriefMetric
          label="Signed"
          value={formatNumber(
            fleetSummary?.total_signed ?? summary?.total_signed,
          )}
        />
        <BriefMetric
          label="Signed rate"
          value={formatPercentage(fleetSummary?.fleet_signed_rate)}
        />
        <BriefMetric
          label="Fleet CPL"
          value={formatCurrency(fleetSummary?.fleet_cpl ?? summary?.fleet_cpl)}
        />
        <BriefMetric
          label="Fleet CPSL"
          value={formatCurrency(fleetSummary?.fleet_cpsl)}
        />
      </div>

      {dataQualityNotes.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <h3 className="text-sm font-semibold text-amber-950">
            Data quality notes
          </h3>
          <ul className="mt-2 space-y-1 text-sm leading-5 text-amber-900">
            {dataQualityNotes.slice(0, 4).map((note, index) => (
              <li key={`${note}-${index}`}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasBriefContent ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <BriefList
            emptyLabel="No top campaigns returned."
            items={topCampaigns.slice(0, 5).map((item) => ({
              detail: item.why_top,
              meta: compactMeta([
                item.brand,
                item.channel,
                formatOptionalCurrency(item.cpl),
                formatOptionalPercentage(item.signed_rate),
              ]),
              title: item.campaign_name || "Unnamed campaign",
            }))}
            title="Top campaigns"
          />
          <BriefList
            emptyLabel="No priority recommendations returned."
            items={recommendations.slice(0, 5).map((item) => ({
              detail: item.rationale,
              meta: compactMeta([
                item.priority ? `P${item.priority}` : null,
                item.brand,
                item.channel,
                item.requires_approval ? "Approval needed" : null,
              ]),
              title: [item.campaign_name, item.action]
                .filter(Boolean)
                .join(" - "),
            }))}
            title="Priority recommendations"
          />
          <BriefList
            emptyLabel="No underperformers returned."
            items={underperformers.slice(0, 5).map((item) => ({
              detail: item.detail,
              meta: compactMeta([
                item.brand,
                item.channel,
                formatIssue(item.issue),
              ]),
              title: item.campaign_name || "Unnamed campaign",
            }))}
            title="Underperformers"
          />
          <BriefList
            emptyLabel="No anomalies returned."
            items={anomalies.slice(0, 5).map((item) => ({
              detail: item.recommended_action,
              meta: compactMeta([
                item.brand,
                item.channel,
                formatIssue(item.anomaly_type),
              ]),
              title: item.campaign_name || "Unnamed campaign",
            }))}
            title={`Anomalies (${formatNumber(anomalyCount)})`}
          />
        </div>
      ) : null}
    </section>
  );
}

function BriefMetric({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: MetricTone;
  value: string | number;
}) {
  const toneClass =
    tone === "critical"
      ? "border-rose-200 bg-rose-50 text-rose-950"
      : tone === "healthy"
        ? "border-teal-200 bg-teal-50 text-teal-950"
        : tone === "watch"
          ? "border-amber-200 bg-amber-50 text-amber-950"
          : "border-slate-200 bg-slate-50 text-slate-950";

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <p className="text-xs font-medium uppercase tracking-normal opacity-70">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function BriefList({
  emptyLabel,
  items,
  title,
}: {
  emptyLabel: string;
  items: BriefListItem[];
  title: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      {items.length ? (
        <ul className="mt-3 divide-y divide-slate-200">
          {items.map((item, index) => (
            <li className="py-3 first:pt-0 last:pb-0" key={`${title}-${index}`}>
              <p className="text-sm font-semibold text-slate-900">
                {item.title || "-"}
              </p>
              {item.meta ? (
                <p className="mt-1 text-xs font-medium uppercase tracking-normal text-slate-500">
                  {item.meta}
                </p>
              ) : null}
              {item.detail ? (
                <p className="mt-1 text-sm leading-5 text-slate-600">
                  {item.detail}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">{emptyLabel}</p>
      )}
    </div>
  );
}

function resolveAgentOutput(
  payload: A1DashboardAgentPayload,
): A1AgentOutput | null {
  if (payload.agent_output) {
    return payload.agent_output;
  }

  const rawOutput = payload.raw_agent_output?.output;

  if (typeof rawOutput !== "string") {
    return null;
  }

  const jsonText =
    rawOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? rawOutput;

  try {
    const parsed = JSON.parse(jsonText);

    return isRecord(parsed) ? (parsed as A1AgentOutput) : null;
  } catch {
    return null;
  }
}

function getDataQualityWarnings(
  payload: A1DashboardAgentPayload | null,
): string[] {
  const crmOutput = payload?.crm_output;
  const dataQuality = isRecord(crmOutput) ? crmOutput.data_quality : undefined;
  const warnings = isRecord(dataQuality) ? dataQuality.warnings : undefined;

  return Array.isArray(warnings)
    ? warnings.filter(
        (warning): warning is string => typeof warning === "string",
      )
    : [];
}

function formatIssue(value: string | null | undefined): string | null {
  return value ? value.replace(/_/g, " ") : null;
}

function compactMeta(items: Array<string | null | undefined>): string {
  return items.filter(Boolean).join(" / ");
}

function formatOptionalCurrency(
  value: number | null | undefined,
): string | null {
  return typeof value === "number" && Number.isFinite(value)
    ? formatCurrency(value)
    : null;
}

function formatOptionalPercentage(
  value: number | null | undefined,
): string | null {
  return typeof value === "number" && Number.isFinite(value)
    ? formatPercentage(value)
    : null;
}

function formatTimestamp(value: string): string {
  return formatDashboardTimestamp(value);
}

function healthTone(value: string | null | undefined): MetricTone {
  if (!value) {
    return "neutral";
  }

  const normalized = value.toLowerCase();

  if (normalized === "red") {
    return "critical";
  }

  if (normalized === "yellow") {
    return "watch";
  }

  if (normalized === "green") {
    return "healthy";
  }

  return "neutral";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
