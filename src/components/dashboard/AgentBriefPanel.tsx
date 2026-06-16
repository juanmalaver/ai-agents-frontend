import type { A1AgentLatestResponse } from "@/src/types/dashboard";
import {
  formatCurrency,
  formatNumber,
  formatPercentage,
} from "@/src/utils/dashboardFormatters";

interface AgentBriefPanelProps {
  error: string | null;
  isLoading: boolean;
  isRerunning: boolean;
  latestRun: A1AgentLatestResponse | null;
  onRefresh: () => void;
  onRunAgain?: () => void;
  rerunStatus: string | null;
}

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
  const agentOutput = payload?.agent_output ?? null;
  const fleetSummary = agentOutput?.fleet_summary ?? null;
  const health =
    fleetSummary?.overall_health ?? payload?.summary?.overall_health;
  const anomalies = agentOutput?.anomalies ?? [];
  const recommendations = agentOutput?.recommendations ?? [];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
            A1 Agent Brief
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            {agentOutput?.report_date
              ? `Daily performance brief — ${agentOutput.report_date}`
              : "Daily performance brief"}
          </h2>
          {agentOutput?.summary ? (
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              {agentOutput.summary}
            </p>
          ) : (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {isLoading ? "Loading A1 brief..." : "No A1 brief received yet."}
            </p>
          )}
          {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
          {rerunStatus ? (
            <p className="mt-2 text-sm text-slate-500">{rerunStatus}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onRefresh}
            type="button"
          >
            Refresh
          </button>
          {onRunAgain ? (
            <button
              className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={isRerunning}
              onClick={onRunAgain}
              type="button"
            >
              {isRerunning ? "Running..." : "Run again"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <BriefMetric
          label="Health"
          tone={healthTone(health)}
          value={health ?? "-"}
        />
        <BriefMetric
          label="Fleet CPL"
          value={formatCurrency(fleetSummary?.fleet_cpl)}
        />
        <BriefMetric
          label="Signed rate"
          value={formatPercentage(fleetSummary?.fleet_signed_rate)}
        />
        <BriefMetric
          label="Signed"
          value={formatNumber(fleetSummary?.total_signed)}
        />
        <BriefMetric label="Anomalies" value={formatNumber(anomalies.length)} />
      </div>

      {anomalies.length || recommendations.length ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <BriefList
            emptyLabel="No anomalies returned."
            items={anomalies.slice(0, 4).map((item) => ({
              detail: item.recommended_action,
              title: [item.campaign_name, item.anomaly_type]
                .filter(Boolean)
                .join(" — "),
            }))}
            title="Anomalies"
          />
          <BriefList
            emptyLabel="No recommendations returned."
            items={recommendations.slice(0, 4).map((item) => ({
              detail: item.rationale,
              title: [
                item.priority ? `P${item.priority}` : null,
                item.campaign_name,
                item.action,
              ]
                .filter(Boolean)
                .join(" — "),
            }))}
            title="Recommendations"
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
  tone?: "critical" | "healthy" | "neutral" | "watch";
  value: string | number;
}) {
  const toneClass =
    tone === "critical"
      ? "border-rose-200 bg-rose-50 text-rose-950"
      : tone === "healthy"
        ? "border-emerald-200 bg-emerald-50 text-emerald-950"
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
  items: Array<{ detail?: string; title: string }>;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      {items.length ? (
        <ul className="mt-3 space-y-3">
          {items.map((item, index) => (
            <li className="text-sm" key={`${title}-${index}`}>
              <p className="font-medium text-slate-800">{item.title || "-"}</p>
              {item.detail ? (
                <p className="mt-1 leading-5 text-slate-600">{item.detail}</p>
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

function healthTone(
  value: string | null | undefined,
): "critical" | "healthy" | "neutral" | "watch" {
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
