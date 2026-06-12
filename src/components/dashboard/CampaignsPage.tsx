"use client";

import { useEffect, useState } from "react";
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
import { campaignsMock } from "@/src/mocks/campaignsMock";
import type {
  CampaignInsight,
  CampaignLeadTrendRow,
  CampaignResultRow,
  CampaignScorecard,
  CampaignStateCompletionRow,
} from "@/src/types/campaigns";
import {
  formatCurrency,
  formatNumber,
  formatPercentage,
} from "@/src/utils/dashboardFormatters";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardTabs } from "./DashboardTabs";

const scorecardClasses: Record<CampaignScorecard["status"], string> = {
  critical: "border-rose-200 bg-rose-50 text-rose-950",
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-950",
  watch: "border-amber-200 bg-amber-50 text-amber-950",
};

export function CampaignsPage() {
  const [chartsReady, setChartsReady] = useState(false);
  const stateChartData = campaignsMock.stateCompletionRows.map((row) => ({
    ...row,
    completionPct: row.slGoal > 0 ? row.sl / row.slGoal : 0,
  }));
  const cplLimit = campaignsMock.alert.cplLimit;

  useEffect(() => {
    setChartsReady(true);
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <DashboardHeader
          lastUpdated={formatGeneratedAt(campaignsMock.generatedAt)}
          subtitle="Campaign-level pacing, CPL risk, and lead behavior."
          title="Campaign Overview"
        />
        <DashboardTabs activeTab="campaigns" />
        <CampaignAlert
          campaignNames={campaignsMock.alert.campaignNames}
          cplLimit={cplLimit}
          message={campaignsMock.alert.message}
        />
        <section className="grid gap-3 md:grid-cols-3">
          {campaignsMock.scorecards.map((scorecard) => (
            <CampaignScorecardItem key={scorecard.id} scorecard={scorecard} />
          ))}
        </section>
        <section className="grid gap-5 xl:grid-cols-2">
          <StateCompletionPanel
            chartsReady={chartsReady}
            rows={stateChartData}
          />
          <LeadBehaviorPanel
            chartsReady={chartsReady}
            rows={campaignsMock.leadTrendRows}
          />
        </section>
        <section className="grid gap-3 md:grid-cols-2">
          <InsightCard insight={campaignsMock.topPerformer} tone="positive" />
          <InsightCard insight={campaignsMock.lowestPerformer} tone="warning" />
        </section>
        <CampaignResultsTable
          cplLimit={cplLimit}
          rows={campaignsMock.campaignRows}
        />
      </div>
    </main>
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
    <section className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm font-semibold text-amber-950">
          {message} CPL limit: {formatCurrency(cplLimit)}.
        </p>
        <p className="mt-1 text-sm text-amber-800">
          {campaignNames.join(", ")}
        </p>
      </div>
      <button
        className="w-fit rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-950 shadow-sm hover:bg-amber-100"
        type="button"
      >
        Share the document
      </button>
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
  rows,
}: {
  chartsReady: boolean;
  rows: Array<CampaignStateCompletionRow & { completionPct: number }>;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            SL completion by accident state
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Actual signed leads against accident-state goals.
          </p>
        </div>
        <span className="w-fit rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
          Life Cycle ?
        </span>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
        <MiniMetricsTable
          columns={["State", "SL", "Goal", "%"]}
          rows={rows.map((row) => [
            row.state,
            formatNumber(row.sl),
            formatNumber(row.slGoal),
            formatPercentage(row.completionPct),
          ])}
        />
        <div className="h-80 min-w-0">
          {chartsReady ? (
            <ResponsiveContainer height="100%" width="100%">
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ bottom: 8, left: 8, right: 24, top: 8 }}
              >
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis
                  domain={[0, 1.25]}
                  tickFormatter={formatPercentage}
                  type="number"
                />
                <YAxis
                  dataKey="state"
                  tick={{ fontSize: 12 }}
                  type="category"
                  width={92}
                />
                <Tooltip
                  formatter={(value) => [
                    formatPercentage(
                      typeof value === "number" ? value : Number(value),
                    ),
                    "SL completion",
                  ]}
                />
                <ReferenceLine
                  ifOverflow="extendDomain"
                  stroke="#2563eb"
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
                      fill={
                        row.completionPct >= 1
                          ? "#22c55e"
                          : row.completionPct >= 0.75
                            ? "#f59e0b"
                            : "#ef4444"
                      }
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

function LeadBehaviorPanel({
  chartsReady,
  rows,
}: {
  chartsReady: boolean;
  rows: CampaignLeadTrendRow[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-slate-950">
          Lead behaviour trends by campaign
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          SL, drops, leads, drop rate, conversion, and no-accident rate.
        </p>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <MiniMetricsTable
          columns={["Campaign", "SL", "Drops", "Leads", "Drop %"]}
          rows={rows.map((row) => [
            row.campaign,
            formatNumber(row.sl),
            formatNumber(row.drops),
            formatNumber(row.leads),
            formatPercentage(row.dropRate),
          ])}
        />
        <div className="h-80 min-w-0">
          {chartsReady ? (
            <ResponsiveContainer height="100%" width="100%">
              <ComposedChart
                data={rows}
                layout="vertical"
                margin={{ bottom: 8, left: 8, right: 16, top: 8 }}
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
                  tick={{ fontSize: 12 }}
                  type="category"
                  width={132}
                />
                <Tooltip
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
                  fill="#94a3b8"
                  name="Leads"
                  radius={[0, 4, 4, 0]}
                  xAxisId="count"
                />
                <Bar
                  dataKey="sl"
                  fill="#22c55e"
                  name="SL"
                  radius={[0, 4, 4, 0]}
                  xAxisId="count"
                />
                <Bar
                  dataKey="drops"
                  fill="#f97316"
                  name="Drops"
                  radius={[0, 4, 4, 0]}
                  xAxisId="count"
                />
                <Line
                  dataKey="conversionRate"
                  dot={{ fill: "#2563eb", r: 3 }}
                  name="Conversion rate"
                  stroke="#2563eb"
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
    </section>
  );
}

function ChartPlaceholder() {
  return (
    <div className="h-full w-full animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
  );
}

function MiniMetricsTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[360px] border-collapse text-left text-xs">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            {columns.map((column) => (
              <th className="px-3 py-2 font-semibold" key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {rows.map((row) => (
            <tr key={row.join("-")}>
              {row.map((cell, index) => (
                <td
                  className={`px-3 py-2 text-slate-700 ${
                    index === 0 ? "font-medium text-slate-950" : ""
                  }`}
                  key={`${cell}-${index}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
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
          <p className="text-xs font-medium opacity-70">{insight.metricLabel}</p>
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
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">
          Results table by campaign
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-normal text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold" scope="col">
                Campaign
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Active marketing states
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                CPL
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                SL
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                SL Goal
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Leads
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Drops
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Drop rate
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Conversion
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                MQL
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((row) => (
              <tr
                className={row.cpl > cplLimit ? "bg-rose-50" : "bg-white"}
                key={row.campaign}
              >
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-950">
                    {row.campaign}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{row.status}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {row.activeMarketingStates}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-950">
                  {formatCurrency(row.cpl)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {formatNumber(row.sl)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {formatNumber(row.slGoal)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {formatNumber(row.leads)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {formatNumber(row.drops)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {formatPercentage(row.dropRate)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {formatPercentage(row.conversionRate)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {formatNumber(row.mql)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
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
