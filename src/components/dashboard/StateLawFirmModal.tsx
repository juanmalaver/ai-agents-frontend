"use client";

import {
  type ColumnDef,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  type Header,
  type SortingFn,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  CampaignGrade,
  CampaignGradeCounts,
  CampaignGradeCountsStatus,
  CampaignStateRow,
  DashboardQueryParams,
  StateLawFirmCampaignRow,
  StateLawFirmRow,
  StateLawFirmsSection,
} from "@/src/types/dashboard";
import {
  formatNumber,
  formatPercentage,
  safeDivide,
} from "@/src/utils/dashboardFormatters";
import {
  appendStateLawFirmsQueryParams,
  buildHealthPageUrl,
  resolveDashboardSectionApiUrl,
} from "@/src/utils/runtimeApiUrls";
import { LoadingSpinner } from "./LoadingSpinner";

const CAMPAIGN_GRADES: CampaignGrade[] = ["A", "B", "C", "D", "F"];

const GRADE_CLASSES: Record<CampaignGrade, string> = {
  A: "border-teal-200 bg-teal-50 text-teal-800",
  B: "border-sky-200 bg-sky-50 text-sky-800",
  C: "border-amber-200 bg-amber-50 text-amber-800",
  D: "border-orange-200 bg-orange-50 text-orange-800",
  F: "border-rose-200 bg-rose-50 text-rose-800",
};

const EMPTY_GRADE_COUNTS = Object.freeze(
  CAMPAIGN_GRADES.reduce((counts, grade) => {
    counts[grade] = 0;

    return counts;
  }, {} as CampaignGradeCounts),
);

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
  const [adGradeCounts, setAdGradeCounts] =
    useState<CampaignGradeCounts>(EMPTY_GRADE_COUNTS);
  const [adGradeCountsStatus, setAdGradeCountsStatus] =
    useState<CampaignGradeCountsStatus>("unavailable");
  const [gradeCounts, setGradeCounts] =
    useState<CampaignGradeCounts>(EMPTY_GRADE_COUNTS);
  const [gradeCountsStatus, setGradeCountsStatus] =
    useState<CampaignGradeCountsStatus>("unavailable");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const monthPacing = useMemo(() => buildMonthPacing(query.to), [query.to]);
  const summaryItems = useMemo(
    () => buildStateLawFirmSummaryItems(rows, monthPacing),
    [monthPacing, rows],
  );
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
      setAdGradeCounts(EMPTY_GRADE_COUNTS);
      setAdGradeCountsStatus("unavailable");
      setGradeCounts(EMPTY_GRADE_COUNTS);
      setGradeCountsStatus("unavailable");
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

        const payload = (await response.json()) as {
          data: StateLawFirmsSection | StateLawFirmRow[];
        };

        if (!controller.signal.aborted) {
          const section = normalizeStateLawFirmsPayload(payload.data);

          setRows(section.rows);
          setAdGradeCounts(normalizeGradeCounts(section.adGradeCounts));
          setAdGradeCountsStatus(section.adGradeCountsStatus);
          setGradeCounts(normalizeGradeCounts(section.gradeCounts));
          setGradeCountsStatus(section.gradeCountsStatus);
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
      <div className="flex max-h-full w-full max-w-[1440px] flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
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
        <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 md:grid-cols-4 xl:grid-cols-8">
          {summaryItems.map((item) => (
            <SummaryItem
              key={item.label}
              label={item.label}
              value={item.value}
            />
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center gap-2 py-10 text-sm font-medium text-slate-600">
              <div className="flex items-center gap-2">
                <LoadingSpinner label="Loading law firms" />
                Loading law firms...
              </div>
              <p className="text-xs font-normal text-slate-500">
                The first load can take up to 30 seconds while CRM data is
                fetched.
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
            <>
              <CampaignGradeSummary
                adGradeCounts={adGradeCounts}
                adStatus={adGradeCountsStatus}
                gradeCounts={gradeCounts}
                query={query}
                status={gradeCountsStatus}
                stateName={stateRow.state}
              />
              <StateLawFirmTable query={query} rows={rows} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StateLawFirmTable({
  query,
  rows,
}: {
  query: DashboardQueryParams;
  rows: StateLawFirmRow[];
}) {
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const monthPacing = useMemo(() => buildMonthPacing(query.to), [query.to]);
  const columns = useMemo<ColumnDef<StateLawFirmRow>[]>(
    () => [
      {
        accessorKey: "lawFirm",
        cell: ({ getValue, row }) => {
          const lawFirm = getValue<string>();
          const hasCampaigns = row.original.campaigns.length > 0;

          return (
            <div className="flex min-w-0 items-center gap-1.5">
              {hasCampaigns ? (
                <button
                  aria-label={`${row.getIsExpanded() ? "Collapse" : "Expand"} campaigns for ${lawFirm}`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-sky-50"
                  onClick={row.getToggleExpandedHandler()}
                  type="button"
                >
                  {row.getIsExpanded() ? "−" : "+"}
                </button>
              ) : (
                <span aria-hidden="true" className="h-7 w-7 shrink-0" />
              )}
              <span
                className="truncate font-semibold text-slate-950"
                title={lawFirm}
              >
                {lawFirm}
              </span>
            </div>
          );
        },
        header: "Law firm",
        meta: {
          info: "The law firm receiving leads for this state.",
        },
      },
      {
        accessorFn: (row) =>
          safeDivide(row.leads, calculateMtdGoal(row.leadsGoal, monthPacing)),
        cell: ({ getValue }) =>
          renderNumberCell(formatPercentage(getValue<number | null>())),
        header: "MTD % to Lead Goal",
        id: "leadGoalPct",
        meta: {
          info: "How much of the month-to-date lead goal has been reached: MTD current leads divided by MTD lead goal.",
        },
        sortDescFirst: true,
        sortingFn: nullableLawFirmNumberSortingFn,
      },
      {
        accessorFn: (row) => calculateMtdGoal(row.leadsGoal, monthPacing),
        cell: ({ getValue }) =>
          renderNumberCell(formatNumber(getValue<number | null>())),
        header: "MTD L GOAL",
        id: "mtdLeadsGoal",
        meta: {
          info: "The lead goal expected by the selected date: EOM lead goal divided by days in the month, then multiplied by elapsed days.",
        },
        sortDescFirst: true,
        sortingFn: nullableLawFirmNumberSortingFn,
      },
      {
        accessorKey: "leads",
        cell: ({ getValue }) =>
          renderNumberCell(formatNumber(getValue<number>())),
        header: "MTD Current Leads",
        meta: {
          info: "Leads generated so far in the selected month.",
        },
        sortDescFirst: true,
        sortingFn: nullableLawFirmNumberSortingFn,
      },
      {
        accessorKey: "leadsGoal",
        cell: ({ getValue }) =>
          renderNumberCell(formatNumber(getValue<number>())),
        header: "EOM L Goal",
        meta: {
          info: "The full-month lead goal for this law firm.",
        },
        sortDescFirst: true,
        sortingFn: nullableLawFirmNumberSortingFn,
      },
      {
        accessorFn: (row) =>
          safeDivide(row.mtdSl, calculateMtdGoal(row.slGoal, monthPacing)),
        cell: ({ getValue }) => renderSlPacingCell(getValue<number | null>()),
        header: "MTD % to SL Goal",
        id: "slPacingPct",
        meta: {
          info: "Signed-lead pacing for the month: MTD SL divided by MTD SL goal. Green is 100% or more, yellow is 80% to 99%, red is below 80%.",
        },
        sortDescFirst: true,
        sortingFn: nullableLawFirmNumberSortingFn,
      },
      {
        accessorFn: (row) => calculateMtdGoal(row.slGoal, monthPacing),
        cell: ({ getValue }) =>
          renderNumberCell(formatNumber(getValue<number | null>())),
        header: "MTD SL GOAL",
        id: "mtdSlGoal",
        meta: {
          info: "The signed-lead goal expected by the selected date: EOM SL goal divided by days in the month, then multiplied by elapsed days.",
        },
        sortDescFirst: true,
        sortingFn: nullableLawFirmNumberSortingFn,
      },
      {
        accessorKey: "mtdSl",
        cell: ({ getValue }) =>
          renderNumberCell(formatNumber(getValue<number>())),
        header: "MTD Current SL",
        meta: {
          info: "Signed leads generated so far in the selected month.",
        },
        sortDescFirst: true,
        sortingFn: nullableLawFirmNumberSortingFn,
      },
      {
        accessorKey: "slGoal",
        cell: ({ getValue }) =>
          renderNumberCell(formatNumber(getValue<number>())),
        header: "EOM SL Goal",
        id: "eomSlGoal",
        meta: {
          info: "The full-month signed-lead goal for this law firm.",
        },
        sortDescFirst: true,
        sortingFn: nullableLawFirmNumberSortingFn,
      },
    ],
    [monthPacing],
  );
  const table = useReactTable({
    autoResetExpanded: false,
    columns,
    data: rows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: (row) => row.original.campaigns.length > 0,
    getSortedRowModel: getSortedRowModel(),
    onExpandedChange: setExpanded,
    onSortingChange: setSorting,
    state: {
      expanded,
      sorting,
    },
  });

  return (
    <div className="rounded-lg border border-slate-200">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs leading-tight text-slate-500">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  className="px-2 py-2 font-semibold"
                  key={header.id}
                  scope="col"
                  style={{ width: getColumnWidth(header.column.id) }}
                >
                  {renderSortableHeader(header)}
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
                    <td
                      className="overflow-hidden px-2 py-2 text-slate-700"
                      key={cell.id}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
                {row.getIsExpanded() ? (
                  <tr>
                    <td
                      className="bg-slate-50 px-4 py-3"
                      colSpan={columns.length}
                    >
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

const nullableLawFirmNumberSortingFn: SortingFn<StateLawFirmRow> = (
  first,
  second,
  columnId,
) =>
  normalizeSortableNumber(first.getValue<number | null>(columnId)) -
  normalizeSortableNumber(second.getValue<number | null>(columnId));

const nullableCampaignNumberSortingFn: SortingFn<StateLawFirmCampaignRow> = (
  first,
  second,
  columnId,
) =>
  normalizeSortableNumber(first.getValue<number | null>(columnId)) -
  normalizeSortableNumber(second.getValue<number | null>(columnId));

function renderSortableHeader<TData>(header: Header<TData, unknown>) {
  if (header.isPlaceholder) {
    return null;
  }

  const info = getHeaderInfo(header);

  if (!header.column.getCanSort()) {
    return (
      <span className="inline-flex min-w-0 items-center gap-1">
        {flexRender(header.column.columnDef.header, header.getContext())}
        {info ? <HeaderInfoIcon info={info} /> : null}
      </span>
    );
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <button
        className="group/sort relative inline-flex min-w-0 pr-3 text-left leading-tight transition hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
        onClick={header.column.getToggleSortingHandler()}
        type="button"
      >
        {flexRender(header.column.columnDef.header, header.getContext())}
        <SortIndicator value={header.column.getIsSorted()} />
      </button>
      {info ? <HeaderInfoIcon info={info} /> : null}
    </span>
  );
}

function getHeaderInfo<TData>(header: Header<TData, unknown>): string | null {
  const meta = header.column.columnDef.meta as
    | { info?: unknown }
    | undefined;

  return typeof meta?.info === "string" && meta.info.trim()
    ? meta.info
    : null;
}

function getColumnWidth(columnId: string): string {
  const widths: Record<string, string> = {
    campaignName: "70%",
    eomSlGoal: "11%",
    lawFirm: "22%",
    leadGoalPct: "10%",
    leads: "9%",
    leadsGoal: "9%",
    mtdLeadsGoal: "10%",
    mtdSl: "9%",
    mtdSlGoal: "10%",
    signedLeads: "15%",
    slPacingPct: "10%",
  };

  return widths[columnId] ?? "8%";
}

function HeaderInfoIcon({ info }: { info: string }) {
  return (
    <button
      aria-label={info}
      className="group/info relative inline-flex h-3 w-3 shrink-0 cursor-help items-center justify-center self-center rounded-full text-slate-400 transition hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="h-2.5 w-2.5"
        fill="none"
        viewBox="0 0 16 16"
      >
        <circle
          cx="8"
          cy="8"
          r="6.25"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M8 7.25v4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
        <circle cx="8" cy="4.75" fill="currentColor" r="0.75" />
      </svg>
      <span
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 hidden w-56 -translate-x-1/2 rounded-md bg-slate-950 px-2.5 py-2 text-left text-[0.68rem] font-medium normal-case leading-snug tracking-normal text-white shadow-lg group-hover/info:block group-focus/info:block"
        role="tooltip"
      >
        {info}
      </span>
    </button>
  );
}

function SortIndicator({ value }: { value: false | "asc" | "desc" }) {
  const isActive = value !== false;

  return (
    <span
      aria-hidden="true"
      className={`absolute right-0 top-0 inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center transition ${
        isActive
          ? "text-teal-700 opacity-100"
          : "text-slate-300 opacity-0 group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100"
      }`}
    >
      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 16 16">
        {value === "asc" ? (
          <path
            d="M8 3.5v9M8 3.5 4.75 6.75M8 3.5l3.25 3.25"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.6"
          />
        ) : value === "desc" ? (
          <path
            d="M8 12.5v-9M8 12.5 4.75 9.25M8 12.5l3.25-3.25"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.6"
          />
        ) : (
          <path
            d="M8 3.5v9M5.25 6.25 8 3.5l2.75 2.75M5.25 9.75 8 12.5l2.75-2.75"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.4"
          />
        )}
      </svg>
    </span>
  );
}

function normalizeSortableNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : Number.NEGATIVE_INFINITY;
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

interface StateLawFirmSummaryItem {
  label: string;
  value: string;
}

function buildStateLawFirmSummaryItems(
  rows: StateLawFirmRow[],
  monthPacing: MonthPacing,
): StateLawFirmSummaryItem[] {
  const totals = buildStateLawFirmTotals(rows, monthPacing);

  return [
    {
      label: "MTD % to Lead Goal",
      value: formatPercentage(safeDivide(totals.leads, totals.mtdLeadsGoal)),
    },
    {
      label: "MTD L GOAL",
      value: formatNumber(totals.mtdLeadsGoal),
    },
    {
      label: "MTD Current Leads",
      value: formatNumber(totals.leads),
    },
    {
      label: "EOM L Goal",
      value: formatNumber(totals.leadsGoal),
    },
    {
      label: "MTD % to SL Goal",
      value: formatPercentage(safeDivide(totals.mtdSl, totals.mtdSlGoal)),
    },
    {
      label: "MTD SL GOAL",
      value: formatNumber(totals.mtdSlGoal),
    },
    {
      label: "MTD Current SL",
      value: formatNumber(totals.mtdSl),
    },
    {
      label: "EOM SL Goal",
      value: formatNumber(totals.slGoal),
    },
  ];
}

function buildStateLawFirmTotals(
  rows: StateLawFirmRow[],
  monthPacing: MonthPacing,
) {
  return rows.reduce(
    (totals, row) => ({
      leads: totals.leads + row.leads,
      leadsGoal: totals.leadsGoal + row.leadsGoal,
      mtdLeadsGoal:
        totals.mtdLeadsGoal +
        (calculateMtdGoal(row.leadsGoal, monthPacing) ?? 0),
      mtdSl: totals.mtdSl + row.mtdSl,
      mtdSlGoal:
        totals.mtdSlGoal + (calculateMtdGoal(row.slGoal, monthPacing) ?? 0),
      slGoal: totals.slGoal + row.slGoal,
    }),
    {
      leads: 0,
      leadsGoal: 0,
      mtdLeadsGoal: 0,
      mtdSl: 0,
      mtdSlGoal: 0,
      slGoal: 0,
    },
  );
}

function renderNumberCell(value: string) {
  return <span className="block text-right tabular-nums">{value}</span>;
}

function renderSlPacingCell(value: number | null) {
  return (
    <span
      className={`inline-flex min-w-12 justify-center rounded-full border px-1.5 py-0.5 text-xs font-semibold tabular-nums ${getSlPacingClass(
        value,
      )}`}
    >
      {formatPercentage(value)}
    </span>
  );
}

function getSlPacingClass(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "border-slate-200 bg-slate-50 text-slate-500";
  }

  if (value >= 1) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value >= 0.8) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-rose-200 bg-rose-50 text-rose-700";
}

function LawFirmCampaignTable({
  campaigns,
  lawFirm,
}: {
  campaigns: StateLawFirmCampaignRow[];
  lawFirm: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo<ColumnDef<StateLawFirmCampaignRow>[]>(
    () => [
      {
        accessorKey: "campaignName",
        cell: ({ getValue }) => (
          <span className="font-medium text-slate-900">
            {getValue<string>()}
          </span>
        ),
        header: "Campaign",
        meta: {
          info: "The campaign grouped under this law firm.",
        },
      },
      {
        accessorKey: "leads",
        cell: ({ getValue }) =>
          renderNumberCell(formatNumber(getValue<number>())),
        header: "Leads",
        meta: {
          info: "Leads generated by this campaign in the selected month.",
        },
        sortDescFirst: true,
        sortingFn: nullableCampaignNumberSortingFn,
      },
      {
        accessorKey: "signedLeads",
        cell: ({ getValue }) =>
          renderNumberCell(formatNumber(getValue<number>())),
        header: "SL",
        meta: {
          info: "Signed leads generated by this campaign in the selected month.",
        },
        sortDescFirst: true,
        sortingFn: nullableCampaignNumberSortingFn,
      },
    ],
    [],
  );
  const table = useReactTable({
    columns,
    data: campaigns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-900">
        Campaign drilldown for {lawFirm}
      </h3>
      <table className="w-full table-fixed border-collapse text-left text-xs">
        <thead className="text-[0.68rem] leading-tight text-slate-500">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  className="px-2 py-2 font-semibold"
                  key={header.id}
                  scope="col"
                  style={{ width: getColumnWidth(header.column.id) }}
                >
                  {renderSortableHeader(header)}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-200">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td
                  className="overflow-hidden px-2 py-2 text-slate-700"
                  key={cell.id}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
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

function CampaignGradeSummary({
  adGradeCounts,
  adStatus,
  gradeCounts,
  query,
  stateName,
  status,
}: {
  adGradeCounts: CampaignGradeCounts;
  adStatus: CampaignGradeCountsStatus;
  gradeCounts: CampaignGradeCounts;
  query: DashboardQueryParams;
  stateName: string;
  status: CampaignGradeCountsStatus;
}) {
  const campaignTotal = sumGradeCounts(gradeCounts);
  const adTotal = sumGradeCounts(adGradeCounts);

  if (status !== "available" && adStatus !== "available") {
    return null;
  }

  return (
    <section className="mb-3 rounded-lg border border-slate-200 bg-white px-3.5 py-3 shadow-sm">
      <div className="mb-3 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Grade mix
        </div>
        <div className="text-xs text-slate-500">
          Campaign and ad health in {stateName}
        </div>
      </div>
      <div className="grid gap-2.5">
        {status === "available" ? (
          <GradeCountRow
            counts={gradeCounts}
            kind="campaign"
            label="Campaigns"
            query={query}
            stateName={stateName}
            total={campaignTotal}
          />
        ) : null}
        {adStatus === "available" ? (
          <GradeCountRow
            counts={adGradeCounts}
            kind="ad"
            label="Ads"
            query={query}
            stateName={stateName}
            total={adTotal}
          />
        ) : null}
      </div>
    </section>
  );
}

function GradeCountRow({
  counts,
  kind,
  label,
  query,
  stateName,
  total,
}: {
  counts: Partial<CampaignGradeCounts> | null | undefined;
  kind: "ad" | "campaign";
  label: string;
  query: DashboardQueryParams;
  stateName: string;
  total: number;
}) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50/60 px-2.5 py-2">
      <div className="mb-2 flex min-w-0 items-baseline justify-between gap-2">
        <div className="truncate text-xs font-semibold text-slate-800">
          {label}
        </div>
        <div className="shrink-0 text-[0.68rem] font-medium text-slate-500 tabular-nums">
          {formatNumber(total)} total
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {CAMPAIGN_GRADES.map((grade) => (
          <GradeCountTile
            count={counts?.[grade] ?? 0}
            grade={grade}
            kind={kind}
            key={grade}
            query={query}
            stateName={stateName}
          />
        ))}
      </div>
    </div>
  );
}

function GradeCountTile({
  count,
  grade,
  kind,
  query,
  stateName,
}: {
  count: number;
  grade: CampaignGrade;
  kind: "ad" | "campaign";
  query: DashboardQueryParams;
  stateName: string;
}) {
  const className = `flex items-center justify-between gap-1.5 rounded-md border px-2 py-1 ${GRADE_CLASSES[grade]}`;
  const content = (
    <>
      <span className="text-[0.68rem] font-bold">{grade}</span>
      <span className="text-xs font-bold tabular-nums">
        {formatNumber(count)}
      </span>
    </>
  );

  if (count <= 0) {
    return <div className={`${className} opacity-60`}>{content}</div>;
  }

  return (
    <Link
      aria-label={`Open Audit for ${stateName} ${kind === "ad" ? "ad" : "campaign"} grade ${grade}`}
      className={`${className} transition hover:-translate-y-px hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30`}
      href={buildHealthPageUrl({
        adGrades: kind === "ad" ? [grade] : null,
        brand: query.brand,
        from: query.from,
        grades: kind === "campaign" ? [grade] : null,
        states: [stateName],
        to: query.to,
      })}
    >
      {content}
    </Link>
  );
}

function normalizeStateLawFirmsPayload(
  data: StateLawFirmsSection | StateLawFirmRow[] | null | undefined,
): StateLawFirmsSection {
  if (Array.isArray(data)) {
    return {
      adGradeCounts: EMPTY_GRADE_COUNTS,
      adGradeCountsStatus: "unavailable",
      gradeCounts: EMPTY_GRADE_COUNTS,
      gradeCountsStatus: "unavailable",
      rows: data,
    };
  }

  return {
    adGradeCounts: normalizeGradeCounts(data?.adGradeCounts),
    adGradeCountsStatus:
      data?.adGradeCountsStatus === "available" ? "available" : "unavailable",
    gradeCounts: normalizeGradeCounts(data?.gradeCounts),
    gradeCountsStatus:
      data?.gradeCountsStatus === "available" ? "available" : "unavailable",
    rows: data?.rows ?? [],
  };
}

function sumGradeCounts(
  counts: Partial<CampaignGradeCounts> | null | undefined,
): number {
  return CAMPAIGN_GRADES.reduce(
    (sum, grade) => sum + (counts?.[grade] ?? 0),
    0,
  );
}

function normalizeGradeCounts(
  counts: Partial<CampaignGradeCounts> | null | undefined,
): CampaignGradeCounts {
  return CAMPAIGN_GRADES.reduce((normalized, grade) => {
    const value = counts?.[grade];

    normalized[grade] =
      typeof value === "number" && Number.isFinite(value) ? value : 0;

    return normalized;
  }, {} as CampaignGradeCounts);
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
