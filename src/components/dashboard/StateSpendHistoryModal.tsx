"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  CampaignStateHistoryRow,
  DashboardQueryParams,
  DashboardSectionResponse,
} from "@/src/types/dashboard";
import {
  formatCurrency,
  formatNumber,
  safeDivide,
} from "@/src/utils/dashboardFormatters";
import {
  appendStateHistoryQueryParams,
  resolveDashboardSectionApiUrl,
} from "@/src/utils/runtimeApiUrls";
import { LoadingSpinner } from "./LoadingSpinner";

interface StateSpendHistoryModalProps {
  apiUrl?: string;
  onClose: () => void;
  query: DashboardQueryParams;
  stateName: string;
}

export function StateSpendHistoryModal({
  apiUrl,
  onClose,
  query,
  stateName,
}: StateSpendHistoryModalProps) {
  const [rows, setRows] = useState<CampaignStateHistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const historyUrl = useMemo(
    () =>
      appendStateHistoryQueryParams(
        resolveDashboardSectionApiUrl("state-history", apiUrl),
        {
          brand: query.brand,
          from: query.from,
          state: stateName,
          to: query.to,
        },
      ),
    [apiUrl, query.brand, query.from, query.to, stateName],
  );
  const totals = useMemo(() => buildHistoryTotals(rows), [rows]);
  const latestWeek = rows.at(-1);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    if (!historyUrl) {
      setRows([]);
      setError("Dashboard API URL is not configured.");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    async function loadHistory() {
      try {
        const response = await fetch(historyUrl as string, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(await buildHistoryFetchError(response));
        }

        const payload =
          (await response.json()) as DashboardSectionResponse<
            CampaignStateHistoryRow[]
          >;

        if (!controller.signal.aborted) {
          setRows(normalizeHistoryRows(payload.data));
        }
      } catch (caughtError) {
        if (!controller.signal.aborted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load six-week history.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadHistory();

    return () => controller.abort();
  }, [historyUrl, reloadKey]);

  return (
    <div
      aria-labelledby="state-spend-history-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
    >
      <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Spend history
            </p>
            <h2
              className="mt-1 text-xl font-bold text-slate-950"
              id="state-spend-history-modal-title"
            >
              {stateName}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Last six weeks by spent, CPSL, and leads.
            </p>
          </div>
          <button
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 md:grid-cols-4">
          <SummaryItem
            label="6-week spent"
            value={formatCurrency(totals.spent)}
          />
          <SummaryItem
            label="6-week CPSL"
            value={formatCurrency(totals.cpsl)}
          />
          <SummaryItem
            label="6-week leads"
            value={formatNumber(totals.leads)}
          />
          <SummaryItem
            label="Latest week"
            value={
              latestWeek
                ? formatWeekRange(latestWeek.weekStart, latestWeek.weekEnd)
                : "-"
            }
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm font-medium text-slate-600">
              <LoadingSpinner label="Loading spend history" />
              Loading spend history...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-10 text-center text-sm text-rose-700">
              <p>{error}</p>
              <button
                className="mt-4 rounded-md border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                onClick={() => setReloadKey((current) => current + 1)}
                type="button"
              >
                Retry
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-slate-200 px-4 py-16 text-center text-sm text-slate-500">
              No six-week history available.
            </div>
          ) : (
            <div className="h-[360px] min-h-[320px]">
              <ResponsiveContainer height="100%" width="100%">
                <LineChart
                  data={rows}
                  margin={{ bottom: 8, left: 0, right: 10, top: 12 }}
                >
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis
                    axisLine={{ stroke: "#cbd5e1" }}
                    dataKey="weekStart"
                    tick={{ fill: "#475569", fontSize: 12 }}
                    tickFormatter={(value) => formatWeekStart(String(value))}
                    tickLine={{ stroke: "#cbd5e1" }}
                  />
                  <YAxis
                    axisLine={{ stroke: "#cbd5e1" }}
                    tick={{ fill: "#475569", fontSize: 12 }}
                    tickFormatter={(value) => formatCurrency(Number(value))}
                    tickLine={{ stroke: "#cbd5e1" }}
                    width={72}
                    yAxisId="currency"
                  />
                  <YAxis
                    axisLine={{ stroke: "#cbd5e1" }}
                    orientation="right"
                    tick={{ fill: "#475569", fontSize: 12 }}
                    tickFormatter={(value) => formatNumber(Number(value))}
                    tickLine={{ stroke: "#cbd5e1" }}
                    width={42}
                    yAxisId="count"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      color: "#0f172a",
                    }}
                    formatter={(value, name) => {
                      const label = String(name);
                      const numericValue =
                        typeof value === "number" ? value : Number(value);

                      if (label === "Leads") {
                        return [formatNumber(numericValue), label];
                      }

                      return [formatCurrency(numericValue), label];
                    }}
                    labelFormatter={(label) => {
                      const point = rows.find(
                        (row) => row.weekStart === String(label),
                      );

                      return point
                        ? formatWeekRange(point.weekStart, point.weekEnd)
                        : String(label);
                    }}
                  />
                  <Legend wrapperStyle={{ color: "#334155", fontSize: 12 }} />
                  <Line
                    dataKey="spent"
                    dot={{ fill: "#0f766e", r: 3, stroke: "#0f766e" }}
                    name="Spent"
                    stroke="#0f766e"
                    strokeWidth={3}
                    type="monotone"
                    yAxisId="currency"
                  />
                  <Line
                    connectNulls={false}
                    dataKey="cpsl"
                    dot={{ fill: "#d97706", r: 3, stroke: "#d97706" }}
                    name="CPSL"
                    stroke="#d97706"
                    strokeWidth={3}
                    type="monotone"
                    yAxisId="currency"
                  />
                  <Line
                    dataKey="leads"
                    dot={{ fill: "#2563eb", r: 3, stroke: "#2563eb" }}
                    name="Leads"
                    stroke="#2563eb"
                    strokeWidth={3}
                    type="monotone"
                    yAxisId="count"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 truncate text-base font-semibold text-slate-950">
        {value}
      </div>
    </div>
  );
}

function normalizeHistoryRows(
  rows: CampaignStateHistoryRow[],
): CampaignStateHistoryRow[] {
  return rows.map((row) => ({
    cpsl: numberOrNull(row.cpsl),
    leads: numberOrZero(row.leads),
    signedLeads: numberOrZero(row.signedLeads),
    spent: numberOrZero(row.spent),
    weekEnd: row.weekEnd,
    weekStart: row.weekStart,
  }));
}

function buildHistoryTotals(rows: CampaignStateHistoryRow[]) {
  const spent = rows.reduce((sum, row) => sum + row.spent, 0);
  const leads = rows.reduce((sum, row) => sum + row.leads, 0);
  const signedLeads = rows.reduce((sum, row) => sum + row.signedLeads, 0);

  return {
    cpsl: safeDivide(spent, signedLeads),
    leads,
    spent,
  };
}

async function buildHistoryFetchError(response: Response): Promise<string> {
  const message = await readResponseMessage(response);

  if (response.status === 401) {
    return "Authentication expired. Sign out and sign in again.";
  }

  return message ?? `Unable to load six-week history (${response.status}).`;
}

async function readResponseMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as unknown;

    if (typeof body === "object" && body !== null && "message" in body) {
      const { message } = body as { message?: unknown };

      if (Array.isArray(message)) {
        return message.filter((item) => typeof item === "string").join(" ");
      }

      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const start = parseDashboardDate(weekStart);
  const end = parseDashboardDate(weekEnd);

  if (!start || !end) {
    return `${weekStart} to ${weekEnd}`;
  }

  const startLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  }).format(start);
  const endLabel = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: start.getUTCMonth() === end.getUTCMonth() ? undefined : "short",
    timeZone: "UTC",
  }).format(end);

  return `${startLabel} ${start.getUTCDate()}-${endLabel}`;
}

function formatWeekStart(value: string): string {
  const date = parseDashboardDate(value);

  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function parseDashboardDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, rawYear, rawMonth, rawDay] = match;
  const date = new Date(
    Date.UTC(Number(rawYear), Number(rawMonth) - 1, Number(rawDay)),
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberOrZero(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
