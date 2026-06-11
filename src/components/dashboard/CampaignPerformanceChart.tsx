"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CampaignPerformanceChartProps } from "@/src/types/dashboard";
import {
  formatMonth,
  formatNumber,
  formatPercentage,
} from "@/src/utils/dashboardFormatters";

export function CampaignPerformanceChart({
  data,
  isLoading,
}: CampaignPerformanceChartProps) {
  if (isLoading) {
    return (
      <section className="rounded-lg bg-slate-950 p-5 shadow-sm">
        <div className="h-6 w-64 animate-pulse rounded bg-slate-800" />
        <div className="mt-6 h-80 animate-pulse rounded bg-slate-900" />
      </section>
    );
  }

  if (data.length === 0) {
    return (
      <section className="rounded-lg bg-slate-950 p-5 text-white shadow-sm">
        <h2 className="text-base font-semibold">SL performance over time</h2>
        <div className="mt-4 flex h-80 items-center justify-center rounded border border-slate-800 text-sm text-slate-300">
          No monthly chart data available.
        </div>
      </section>
    );
  }

  const hasGoalData = data.some(
    (item) => typeof item.slGoal === "number" && Number.isFinite(item.slGoal),
  );

  return (
    <section className="rounded-lg bg-slate-950 p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-1">
        <h2 className="text-base font-semibold text-white">
          SL performance over time
        </h2>
        <p className="text-sm text-slate-400">
          {hasGoalData
            ? "Monthly actuals, goals, and percentage to target."
            : "Monthly signed-lead actuals."}
        </p>
      </div>

      <div className="h-80">
        <ResponsiveContainer height="100%" width="100%">
          <ComposedChart
            data={data}
            margin={{ bottom: 8, left: 0, right: 12, top: 8 }}
          >
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis
              axisLine={{ stroke: "#334155" }}
              dataKey="month"
              tick={{ fill: "#cbd5e1", fontSize: 12 }}
              tickFormatter={formatMonth}
              tickLine={{ stroke: "#334155" }}
            />
            <YAxis
              axisLine={{ stroke: "#334155" }}
              tick={{ fill: "#cbd5e1", fontSize: 12 }}
              tickFormatter={formatNumber}
              tickLine={{ stroke: "#334155" }}
              yAxisId="count"
            />
            {hasGoalData ? (
              <YAxis
                axisLine={{ stroke: "#334155" }}
                orientation="right"
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
                tickFormatter={formatPercentage}
                tickLine={{ stroke: "#334155" }}
                yAxisId="percent"
              />
            ) : null}
            <Tooltip
              contentStyle={{
                background: "#020617",
                border: "1px solid #334155",
                borderRadius: 8,
                color: "#f8fafc",
              }}
              formatter={(value, name) => {
                const label = String(name);
                const numericValue =
                  typeof value === "number" ? value : Number(value);

                if (label === "SL % to target") {
                  return [formatPercentage(numericValue), label];
                }

                return [formatNumber(numericValue), label];
              }}
              labelFormatter={(label) => formatMonth(String(label))}
            />
            <Legend wrapperStyle={{ color: "#f8fafc", fontSize: 12 }} />
            <Bar
              dataKey="sl"
              fill="#22c55e"
              name="SL"
              radius={[4, 4, 0, 0]}
              yAxisId="count"
            />
            {hasGoalData ? (
              <>
                <Line
                  dataKey="slGoal"
                  dot={false}
                  name="SL Goal"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  type="monotone"
                  yAxisId="count"
                />
                <Line
                  connectNulls={false}
                  dataKey="slPctToTarget"
                  dot={{ fill: "#f8fafc", r: 3, stroke: "#f8fafc" }}
                  name="SL % to target"
                  stroke="#f8fafc"
                  strokeWidth={3}
                  type="monotone"
                  yAxisId="percent"
                />
              </>
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
