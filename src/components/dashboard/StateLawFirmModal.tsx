"use client";

import {
  type ColumnDef,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  CampaignStateRow,
  DashboardQueryParams,
  StateLawFirmRow,
} from "@/src/types/dashboard";
import {
  formatNumber,
  formatPercentage,
} from "@/src/utils/dashboardFormatters";
import {
  appendStateLawFirmsQueryParams,
  buildHealthPageUrl,
  resolveDashboardSectionApiUrl,
} from "@/src/utils/runtimeApiUrls";
import { LoadingSpinner } from "./LoadingSpinner";

interface StateLawFirmModalProps {
  apiUrl?: string;
  onClose: () => void;
  query: DashboardQueryParams;
  stateRow: CampaignStateRow;
}

export function StateLawFirmModal({
  apiUrl,
  onClose,
  query,
  stateRow,
}: StateLawFirmModalProps) {
  const [rows, setRows] = useState<StateLawFirmRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const lawFirmUrl = useMemo(
    () =>
      appendStateLawFirmsQueryParams(
        resolveDashboardSectionApiUrl("state-law-firms", apiUrl),
        {
          brand: query.brand,
          from: query.from,
          state: stateRow.state,
          to: query.to,
        },
      ),
    [apiUrl, query.brand, query.from, query.to, stateRow.state],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (!lawFirmUrl) {
      setRows([]);
      setError("Dashboard API URL is not configured.");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    async function loadLawFirms() {
      try {
        const response = await fetch(lawFirmUrl as string, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(await readLawFirmResponseMessage(response));
        }

        const payload = (await response.json()) as { data: StateLawFirmRow[] };

        if (!controller.signal.aborted) {
          setRows(payload.data ?? []);
        }
      } catch (caughtError) {
        if (!controller.signal.aborted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load law firm breakdown.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadLawFirms();

    return () => controller.abort();
  }, [lawFirmUrl, reloadKey]);

  return (
    <div
      aria-labelledby="state-law-firm-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6"
      role="dialog"
    >
      <div className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              State law firm breakdown
            </p>
            <h2
              className="mt-1 text-xl font-bold text-slate-950"
              id="state-law-firm-modal-title"
            >
              {stateRow.state}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Law firms, goals, and campaign drilldown for this state.{" "}
              <Link
                className="font-semibold text-teal-700 underline decoration-teal-200 underline-offset-2 transition hover:text-teal-900"
                href={buildHealthPageUrl({
                  brand: query.brand,
                  from: query.from,
                  states: [stateRow.state],
                  to: query.to,
                })}
              >
                View in Audit
              </Link>
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
        <div className="grid shrink-0 gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 sm:grid-cols-4">
          <SummaryItem label="Leads goal" value={formatNumber(stateRow.leadsGoal ?? 0)} />
          <SummaryItem label="SL goal" value={formatNumber(stateRow.slGoal ?? 0)} />
          <SummaryItem label="Leads" value={formatNumber(stateRow.leads ?? 0)} />
          <SummaryItem label="MTD SL" value={formatNumber(stateRow.mtdSl ?? 0)} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center gap-2 py-10 text-sm font-medium text-slate-600">
              <div className="flex items-center gap-2">
                <LoadingSpinner label="Loading law firms" />
                Loading law firms...
              </div>
              <p className="text-xs font-normal text-slate-500">
                The first load can take up to 30 seconds while CRM data is fetched.
              </p>
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
          ) : (
            <StateLawFirmTable rows={rows} />
          )}
        </div>
      </div>
    </div>
  );
}

function StateLawFirmTable({ rows }: { rows: StateLawFirmRow[] }) {
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const columns = useMemo<ColumnDef<StateLawFirmRow>[]>(
    () => [
      {
        accessorKey: "lawFirm",
        cell: ({ getValue, row }) => {
          const lawFirm = getValue<string>();
          const hasCampaigns = row.original.campaigns.length > 0;

          return (
            <div className="flex items-center gap-2">
              {hasCampaigns ? (
                <button
                  aria-label={`${row.getIsExpanded() ? "Collapse" : "Expand"} campaigns for ${lawFirm}`}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-sky-50"
                  onClick={row.getToggleExpandedHandler()}
                  type="button"
                >
                  {row.getIsExpanded() ? "−" : "+"}
                </button>
              ) : (
                <span aria-hidden="true" className="h-7 w-7" />
              )}
              <span className="font-semibold text-slate-950">{lawFirm}</span>
            </div>
          );
        },
        header: "Law firm",
      },
      {
        accessorKey: "leadsGoal",
        cell: ({ getValue }) => formatNumber(getValue<number>()),
        header: "Leads goal",
      },
      {
        accessorKey: "slGoal",
        cell: ({ getValue }) => formatNumber(getValue<number>()),
        header: "SL goal",
      },
      {
        accessorKey: "leads",
        cell: ({ getValue }) => formatNumber(getValue<number>()),
        header: "Leads",
      },
      {
        accessorKey: "mtdSl",
        cell: ({ getValue }) => formatNumber(getValue<number>()),
        header: "MTD SL",
      },
      {
        accessorFn: (row) => row.goalPct,
        cell: ({ getValue }) => formatPercentage(getValue<number | null>()),
        header: "Goal %",
        id: "goalPct",
      },
      {
        accessorFn: (row) => row.conversionRate,
        cell: ({ getValue }) => formatPercentage(getValue<number | null>()),
        header: "Conv. rate",
        id: "conversionRate",
      },
    ],
    [],
  );
  const table = useReactTable({
    columns,
    data: rows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: (row) => row.original.campaigns.length > 0,
    onExpandedChange: setExpanded,
    state: {
      expanded,
    },
  });

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th className="px-4 py-3 font-semibold" key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-200">
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                <tr className="bg-white">
                  {row.getVisibleCells().map((cell) => (
                    <td className="px-4 py-3 text-slate-700" key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
                {row.getIsExpanded() ? (
                  <tr>
                    <td className="bg-slate-50 px-4 py-3" colSpan={columns.length}>
                      <LawFirmCampaignTable
                        campaigns={row.original.campaigns}
                        lawFirm={row.original.lawFirm}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))
          ) : (
            <tr>
              <td
                className="px-4 py-10 text-center text-sm text-slate-500"
                colSpan={columns.length}
              >
                No law firms found for this state.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LawFirmCampaignTable({
  campaigns,
  lawFirm,
}: {
  campaigns: StateLawFirmRow["campaigns"];
  lawFirm: string;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-900">
        Campaign drilldown for {lawFirm}
      </h3>
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 font-semibold">Campaign</th>
            <th className="px-3 py-2 text-right font-semibold">Leads</th>
            <th className="px-3 py-2 text-right font-semibold">SL</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {campaigns.map((campaign) => (
            <tr key={campaign.id}>
              <td className="px-3 py-2 font-medium text-slate-900">
                {campaign.campaignName}
              </td>
              <td className="px-3 py-2 text-right">
                {formatNumber(campaign.leads)}
              </td>
              <td className="px-3 py-2 text-right">
                {formatNumber(campaign.signedLeads)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-slate-950">{value}</div>
    </div>
  );
}

async function readLawFirmResponseMessage(response: Response): Promise<string> {
  if (response.status === 401) {
    return "Authentication expired. Sign out and sign in again.";
  }

  try {
    const body = (await response.json()) as unknown;

    if (typeof body === "object" && body !== null && "message" in body) {
      const message = (body as { message?: unknown }).message;

      if (Array.isArray(message)) {
        return message.filter((item) => typeof item === "string").join(" ");
      }

      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }
  } catch {
    return `Unable to load law firm breakdown (${response.status}).`;
  }

  if (response.status === 404) {
    return "Law firm breakdown endpoint was not found. Restart the backend with the latest code.";
  }

  return `Unable to load law firm breakdown (${response.status}).`;
}
