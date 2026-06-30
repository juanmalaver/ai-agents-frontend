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
import type { HealthDashboardPlatform } from "@/src/types/campaignHealth";
import type {
  CampaignGrade,
  CampaignGradeCounts,
  CampaignGradeCountsStatus,
  CampaignStateRow,
  DashboardQueryParams,
  StateLawFirmCampaignAdRow,
  StateLawFirmCampaignRow,
  StateLawFirmRow,
  StateLawFirmsSection,
} from "@/src/types/dashboard";
import {
  formatCurrency,
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

const META_STATUS_CLASSES = {
  off: "border-slate-300 bg-slate-100 text-slate-700",
  on: "border-teal-200 bg-teal-50 text-teal-800",
  unknown: "border-amber-200 bg-amber-50 text-amber-800",
} satisfies Record<StateLawFirmCampaignAdRow["metaStatus"]["id"], string>;

const CONFIDENCE_CLASSES = {
  High: "border-teal-200 bg-teal-50 text-teal-800",
  Learning: "border-slate-200 bg-slate-50 text-slate-600",
  Limited: "border-orange-200 bg-orange-50 text-orange-800",
  Medium: "border-sky-200 bg-sky-50 text-sky-800",
} satisfies Record<StateLawFirmCampaignAdRow["confidence"], string>;

const RECOMMENDATION_CLASSES = {
  Learning: "border-slate-200 bg-slate-50 text-slate-600",
  "Replicate/Keep on": "border-teal-200 bg-teal-50 text-teal-800",
  Review: "border-amber-200 bg-amber-50 text-amber-800",
  "Shut off": "border-rose-200 bg-rose-50 text-rose-800",
} satisfies Record<StateLawFirmCampaignAdRow["recommendation"], string>;

const PLATFORM_CLASSES = {
  meta: "border-sky-200 bg-sky-50 text-sky-700",
  tiktok: "border-rose-200 bg-rose-50 text-rose-700",
} satisfies Record<StateLawFirmCampaignAdRow["platform"], string>;

const HEALTH_STATUS_LABELS = {
  green: "Good",
  neutral: "Not scored",
  red: "Review",
  yellow: "Watch",
} satisfies Record<
  StateLawFirmCampaignAdRow["metricHealth"]["cpsl"]["status"],
  string
>;

const UNKNOWN_META_STATUS: StateLawFirmCampaignAdRow["metaStatus"] = {
  configuredStatus: null,
  effectiveStatus: null,
  id: "unknown",
  label: "Unknown",
};

const LAW_FIRM_FETCH_RETRY_DELAYS_MS = [800, 2_000];
const lawFirmBreakdownMemoryCache = new Map<string, StateLawFirmsSection>();
const LAW_FIRM_LOADING_PREVIEW_COLUMNS = [
  "Law firm",
  "MTD % to Lead Goal",
  "MTD L Goal",
  "MTD Current Leads",
  "EOM L Goal",
  "MTD % to SL Goal",
  "MTD SL Goal",
  "MTD Current SL",
  "EOM SL Goal",
];

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
  const hasRows = rows.length > 0;
  const summaryItems = useMemo(
    () =>
      hasRows
        ? buildStateLawFirmSummaryItems(rows, monthPacing)
        : buildStateSnapshotSummaryItems(stateRow, monthPacing),
    [hasRows, monthPacing, rows, stateRow],
  );
  const auditPlatform = useMemo(() => inferAuditPlatform(apiUrl), [apiUrl]);
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
    const cachedSection = lawFirmBreakdownMemoryCache.get(lawFirmUrl);
    const commitSection = (section: StateLawFirmsSection) => {
      setRows(section.rows);
      setAdGradeCounts(normalizeGradeCounts(section.adGradeCounts));
      setAdGradeCountsStatus(section.adGradeCountsStatus);
      setGradeCounts(normalizeGradeCounts(section.gradeCounts));
      setGradeCountsStatus(section.gradeCountsStatus);
    };

    if (cachedSection) {
      commitSection(cachedSection);
    }

    setIsLoading(true);
    setError(null);

    async function loadLawFirms() {
      try {
        const payload = await fetchLawFirmBreakdown(
          lawFirmUrl as string,
          controller.signal,
        );

        if (!controller.signal.aborted) {
          const section = normalizeStateLawFirmsPayload(payload.data);

          lawFirmBreakdownMemoryCache.set(lawFirmUrl as string, section);
          commitSection(section);
        }
      } catch (caughtError) {
        if (!controller.signal.aborted) {
          setError(
            caughtError instanceof Error
              ? formatLawFirmLoadError(caughtError)
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
                  platform: auditPlatform,
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
          {error && !hasRows ? (
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
              {isLoading ? <LawFirmLoadingNotice hasRows={hasRows} /> : null}
              {error && hasRows ? (
                <LawFirmRefreshError
                  error={error}
                  onRetry={() => setReloadKey((current) => current + 1)}
                />
              ) : null}
              {hasRows || !isLoading ? (
                <>
                  <CampaignGradeSummary
                    adGradeCounts={adGradeCounts}
                    adStatus={adGradeCountsStatus}
                    auditPlatform={auditPlatform}
                    gradeCounts={gradeCounts}
                    query={query}
                    status={gradeCountsStatus}
                    stateName={stateRow.state}
                  />
                  <StateLawFirmTable
                    auditPlatform={auditPlatform}
                    query={query}
                    rows={rows}
                    stateName={stateRow.state}
                  />
                </>
              ) : (
                <LawFirmLoadingPreview />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LawFirmLoadingNotice({ hasRows }: { hasRows: boolean }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-3 text-sm text-sky-800">
      <div className="flex items-center gap-2 font-semibold">
        <LoadingSpinner label="Loading law firms" />
        {hasRows ? "Refreshing law firm details..." : "Loading law firm details..."}
      </div>
      <span className="text-xs font-medium text-sky-700">
        {hasRows
          ? "Showing the latest loaded rows while CRM refreshes."
          : "State totals are available while CRM rows load."}
      </span>
    </div>
  );
}

function LawFirmRefreshError({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
      <span>{error}</span>
      <button
        className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        onClick={onRetry}
        type="button"
      >
        Retry
      </button>
    </div>
  );
}

function LawFirmLoadingPreview() {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs leading-tight text-slate-500">
          <tr>
            {LAW_FIRM_LOADING_PREVIEW_COLUMNS.map((column) => (
              <th className="px-2 py-2 font-semibold" key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {Array.from({ length: 6 }).map((_, rowIndex) => (
            <tr className="bg-white" key={rowIndex}>
              {LAW_FIRM_LOADING_PREVIEW_COLUMNS.map((column, columnIndex) => (
                <td className="px-2 py-3" key={`${column}-${rowIndex}`}>
                  <span
                    className={`block h-3 animate-pulse rounded-full bg-slate-200 ${
                      columnIndex === 0
                        ? "w-4/5"
                        : columnIndex % 3 === 0
                          ? "ml-auto w-12"
                          : "ml-auto w-16"
                    }`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StateLawFirmTable({
  auditPlatform,
  query,
  rows,
  stateName,
}: {
  auditPlatform: HealthDashboardPlatform;
  query: DashboardQueryParams;
  rows: StateLawFirmRow[];
  stateName: string;
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
                        auditPlatform={auditPlatform}
                        campaigns={row.original.campaigns}
                        lawFirm={row.original.lawFirm}
                        query={query}
                        stateName={stateName}
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

const GRADE_SORT_RANKS: Record<CampaignGrade, number> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  F: 4,
};

const AD_STATUS_SORT_RANKS: Record<
  StateLawFirmCampaignAdRow["metaStatus"]["id"],
  number
> = {
  off: 1,
  on: 2,
  unknown: 0,
};

const AD_CONFIDENCE_SORT_RANKS: Record<
  StateLawFirmCampaignAdRow["confidence"],
  number
> = {
  High: 4,
  Learning: 1,
  Limited: 2,
  Medium: 3,
};

const AD_RECOMMENDATION_SORT_RANKS: Record<
  StateLawFirmCampaignAdRow["recommendation"],
  number
> = {
  "Shut off": 4,
  Review: 3,
  Learning: 2,
  "Replicate/Keep on": 1,
};

const campaignGradeBreakdownSortingFn: SortingFn<StateLawFirmCampaignRow> = (
  first,
  second,
  columnId,
) =>
  getGradeBreakdownSortValue(first.original, columnId) -
  getGradeBreakdownSortValue(second.original, columnId);

const campaignAdsCountSortingFn: SortingFn<StateLawFirmCampaignRow> = (
  first,
  second,
) => (first.original.ads?.length ?? 0) - (second.original.ads?.length ?? 0);

const campaignAdGradeSortingFn: SortingFn<StateLawFirmCampaignAdRow> = (
  first,
  second,
  columnId,
) =>
  compareRankedValues(
    first.getValue<CampaignGrade>(columnId),
    second.getValue<CampaignGrade>(columnId),
    GRADE_SORT_RANKS,
  );

const campaignAdStatusSortingFn: SortingFn<StateLawFirmCampaignAdRow> = (
  first,
  second,
  columnId,
) =>
  compareRankedValues(
    first.getValue<StateLawFirmCampaignAdRow["metaStatus"]["id"]>(columnId),
    second.getValue<StateLawFirmCampaignAdRow["metaStatus"]["id"]>(columnId),
    AD_STATUS_SORT_RANKS,
  );

const campaignAdConfidenceSortingFn: SortingFn<StateLawFirmCampaignAdRow> = (
  first,
  second,
  columnId,
) =>
  compareRankedValues(
    first.getValue<StateLawFirmCampaignAdRow["confidence"]>(columnId),
    second.getValue<StateLawFirmCampaignAdRow["confidence"]>(columnId),
    AD_CONFIDENCE_SORT_RANKS,
  );

const campaignAdRecommendationSortingFn: SortingFn<StateLawFirmCampaignAdRow> = (
  first,
  second,
  columnId,
) =>
  compareRankedValues(
    first.getValue<StateLawFirmCampaignAdRow["recommendation"]>(columnId),
    second.getValue<StateLawFirmCampaignAdRow["recommendation"]>(columnId),
    AD_RECOMMENDATION_SORT_RANKS,
  );

const nullableCampaignAdNumberSortingFn: SortingFn<
  StateLawFirmCampaignAdRow
> = (first, second, columnId) =>
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
    adGradeCounts: "20%",
    ads: "10%",
    campaignGradeCounts: "16%",
    campaignName: "34%",
    eomSlGoal: "11%",
    lawFirm: "22%",
    leadGoalPct: "10%",
    leads: "10%",
    leadsGoal: "9%",
    mtdLeadsGoal: "10%",
    mtdSl: "9%",
    mtdSlGoal: "10%",
    signedLeads: "10%",
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

function compareRankedValues<T extends string>(
  firstValue: T,
  secondValue: T,
  ranks: Record<T, number>,
): number {
  return (ranks[firstValue] ?? 0) - (ranks[secondValue] ?? 0);
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

function buildStateSnapshotSummaryItems(
  stateRow: CampaignStateRow,
  monthPacing: MonthPacing,
): StateLawFirmSummaryItem[] {
  const mtdLeadGoal = calculateMtdGoal(stateRow.leadsGoal, monthPacing);

  return [
    {
      label: "Spent",
      value: formatCurrency(stateRow.mtdSpent),
    },
    {
      label: "Budget",
      value: formatCurrency(stateRow.budget),
    },
    {
      label: "MTD % Spent",
      value: formatPercentage(stateRow.spentPct),
    },
    {
      label: "MTD Leads",
      value: formatNumber(stateRow.leads),
    },
    {
      label: "MTD Lead Goal",
      value: formatNumber(mtdLeadGoal),
    },
    {
      label: "MTD SL",
      value: formatNumber(stateRow.mtdSl),
    },
    {
      label: "MTD SL Goal",
      value: formatNumber(stateRow.slGoal),
    },
    {
      label: "CPSL",
      value: formatCurrency(stateRow.cpsl),
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

function renderCampaignMetricCell(value: number) {
  return (
    <span
      className={`block font-semibold tabular-nums ${
        value > 0 ? "text-slate-950" : "text-slate-400"
      }`}
    >
      {formatNumber(value)}
    </span>
  );
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
  auditPlatform,
  campaigns,
  lawFirm,
  query,
  stateName,
}: {
  auditPlatform: HealthDashboardPlatform;
  campaigns: StateLawFirmCampaignRow[];
  lawFirm: string;
  query: DashboardQueryParams;
  stateName: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedCampaign, setSelectedCampaign] =
    useState<StateLawFirmCampaignRow | null>(null);
  const [selectedAdGrades, setSelectedAdGrades] = useState<CampaignGrade[]>([]);
  const [selectedCampaignGrades, setSelectedCampaignGrades] = useState<
    CampaignGrade[]
  >([]);
  const campaignGradeFilterCounts = useMemo(
    () => countCampaignRowsByGrade(campaigns, "campaignGradeCounts"),
    [campaigns],
  );
  const adGradeFilterCounts = useMemo(
    () => countCampaignRowsByGrade(campaigns, "adGradeCounts"),
    [campaigns],
  );
  const filteredCampaigns = useMemo(
    () =>
      campaigns.filter(
        (campaign) =>
          gradeCountsMatchSelection(
            campaign.campaignGradeCounts,
            selectedCampaignGrades,
          ) &&
          gradeCountsMatchSelection(campaign.adGradeCounts, selectedAdGrades),
      ),
    [campaigns, selectedAdGrades, selectedCampaignGrades],
  );
  const hasActiveGradeFilters =
    selectedAdGrades.length > 0 || selectedCampaignGrades.length > 0;
  const stats = useMemo(
    () => buildCampaignDrilldownStats(campaigns, filteredCampaigns),
    [campaigns, filteredCampaigns],
  );
  const columns = useMemo<ColumnDef<StateLawFirmCampaignRow>[]>(
    () => [
      {
        accessorKey: "campaignName",
        cell: ({ row }) => <CampaignNameCell campaign={row.original} />,
        header: "Campaign",
        meta: {
          info: "The campaign grouped under this law firm.",
        },
      },
      {
        cell: ({ row }) => (
          <CampaignGradeCell
            counts={row.original.campaignGradeCounts}
            status={row.original.campaignGradeCountsStatus}
          />
        ),
        header: "Campaign grade",
        id: "campaignGradeCounts",
        meta: {
          info: "Campaign health grade for this campaign in the selected state.",
        },
        sortingFn: campaignGradeBreakdownSortingFn,
      },
      {
        cell: ({ row }) => (
          <GradeBreakdownChips
            counts={row.original.adGradeCounts}
            status={row.original.adGradeCountsStatus}
          />
        ),
        header: "Ad grade mix",
        id: "adGradeCounts",
        meta: {
          info: "Ad health grade mix for this campaign in the selected state.",
        },
        sortingFn: campaignGradeBreakdownSortingFn,
      },
      {
        cell: ({ row }) => (
          <CampaignAdsAction
            campaign={row.original}
            onOpen={() => setSelectedCampaign(row.original)}
          />
        ),
        header: "Ads",
        id: "ads",
        meta: {
          info: "Open the ads inside this campaign with audit grades and performance context.",
        },
        sortDescFirst: true,
        sortingFn: campaignAdsCountSortingFn,
      },
      {
        accessorKey: "leads",
        cell: ({ getValue }) =>
          renderCampaignMetricCell(getValue<number>()),
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
          renderCampaignMetricCell(getValue<number>()),
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
    data: filteredCampaigns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {selectedCampaign ? (
        <CampaignAdsModal
          auditPlatform={auditPlatform}
          campaign={selectedCampaign}
          lawFirm={lawFirm}
          onClose={() => setSelectedCampaign(null)}
          query={query}
          stateName={stateName}
        />
      ) : null}
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-slate-500">
              Campaign drilldown
            </p>
            <h3 className="mt-0.5 truncate text-base font-semibold text-slate-950">
              {lawFirm}
            </h3>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
            <CampaignDrilldownStat
              label="Campaigns"
              value={`${formatNumber(filteredCampaigns.length)} / ${formatNumber(
                campaigns.length,
              )}`}
            />
            <CampaignDrilldownStat
              label="Leads"
              value={
                stats.filteredLeads === stats.totalLeads
                  ? formatNumber(stats.totalLeads)
                  : `${formatNumber(stats.filteredLeads)} / ${formatNumber(
                      stats.totalLeads,
                    )}`
              }
            />
            <CampaignDrilldownStat
              label="SL"
              value={
                stats.filteredSignedLeads === stats.totalSignedLeads
                  ? formatNumber(stats.totalSignedLeads)
                  : `${formatNumber(
                      stats.filteredSignedLeads,
                    )} / ${formatNumber(stats.totalSignedLeads)}`
              }
            />
          </div>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div className="grid gap-3 lg:grid-cols-2">
            <GradeToggleGroup
              counts={campaignGradeFilterCounts}
              label="Campaign grades"
              onToggle={(grade) =>
                setSelectedCampaignGrades((current) =>
                  toggleSelectedGrade(current, grade),
                )
              }
              selectedGrades={selectedCampaignGrades}
            />
            <GradeToggleGroup
              counts={adGradeFilterCounts}
              label="Ad grades"
              onToggle={(grade) =>
                setSelectedAdGrades((current) =>
                  toggleSelectedGrade(current, grade),
                )
              }
              selectedGrades={selectedAdGrades}
            />
          </div>
          {hasActiveGradeFilters ? (
            <button
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              onClick={() => {
                setSelectedAdGrades([]);
                setSelectedCampaignGrades([]);
              }}
              type="button"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>
      <div className="max-h-[34rem] overflow-auto">
        <table className="w-full min-w-[880px] table-fixed border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[0.68rem] uppercase leading-tight tracking-wide text-slate-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    className={`px-4 py-2.5 font-semibold ${
                      isNumericCampaignColumn(header.column.id)
                        ? "text-right"
                        : "text-left"
                    }`}
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
          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  className="bg-white transition hover:bg-slate-50/80"
                  key={row.id}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      className={`overflow-hidden px-4 py-3 align-middle text-slate-700 ${
                        isNumericCampaignColumn(cell.column.id)
                          ? "text-right"
                          : ""
                      }`}
                      key={cell.id}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="px-3 py-8 text-center text-xs font-medium text-slate-500"
                  colSpan={columns.length}
                >
                  No campaigns match the selected grades.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type CampaignGradeCountsKey = "adGradeCounts" | "campaignGradeCounts";

function CampaignDrilldownStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-16 text-right">
      <div className="text-[0.68rem] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-bold tabular-nums text-slate-950">
        {value}
      </div>
    </div>
  );
}

function GradeToggleGroup({
  counts,
  label,
  onToggle,
  selectedGrades,
}: {
  counts: CampaignGradeCounts;
  label: string;
  onToggle: (grade: CampaignGrade) => void;
  selectedGrades: CampaignGrade[];
}) {
  const selectedGradeSet = new Set(selectedGrades);
  const activeCount = selectedGrades.length;

  return (
    <fieldset className="min-w-0">
      <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
        <legend className="text-[0.68rem] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </legend>
        <span className="shrink-0 text-[0.68rem] font-medium text-slate-500">
          {activeCount > 0
            ? `${formatNumber(activeCount)} selected`
            : "All grades"}
        </span>
      </div>
      <div className="grid min-w-0 grid-cols-5 overflow-hidden rounded-md border border-slate-200 bg-white">
        {CAMPAIGN_GRADES.map((grade) => {
          const count = counts[grade] ?? 0;
          const checked = selectedGradeSet.has(grade);
          const disabled = count === 0 && !checked;

          return (
            <button
              aria-pressed={checked}
              className={`flex h-9 min-w-0 items-center justify-center gap-1.5 border-r border-slate-200 px-2 text-xs font-bold tabular-nums transition last:border-r-0 focus:relative focus:z-10 focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${
                checked
                  ? GRADE_CLASSES[grade]
                  : disabled
                    ? "cursor-not-allowed bg-slate-50 text-slate-300"
                    : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
              disabled={disabled}
              key={grade}
              onClick={() => onToggle(grade)}
              type="button"
            >
              <span>{grade}</span>
              <span className={checked ? "text-current" : "text-slate-500"}>
                {formatNumber(count)}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function CampaignNameCell({
  campaign,
}: {
  campaign: StateLawFirmCampaignRow;
}) {
  return (
    <div className="min-w-0">
      <div
        className="truncate font-semibold text-slate-950"
        title={campaign.campaignName}
      >
        {campaign.campaignName}
      </div>
      <div className="mt-0.5 text-[0.68rem] font-medium text-slate-500">
        {formatNumber(campaign.leads)} leads ·{" "}
        {formatNumber(campaign.signedLeads)} SL
      </div>
    </div>
  );
}

function CampaignGradeCell({
  counts,
  status,
}: {
  counts: CampaignGradeCounts | null | undefined;
  status: CampaignGradeCountsStatus | null | undefined;
}) {
  if (status !== "available" || !counts || sumGradeCounts(counts) <= 0) {
    return <span className="text-slate-400">-</span>;
  }

  const grade = getPrimaryCampaignGrade(counts);

  return (
    <span
      className={`inline-flex h-7 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-bold ${GRADE_CLASSES[grade]}`}
      title={formatGradeBreakdownTitle(counts)}
    >
      {grade}
    </span>
  );
}

function GradeBreakdownChips({
  counts,
  status,
}: {
  counts: CampaignGradeCounts | null | undefined;
  status: CampaignGradeCountsStatus | null | undefined;
}) {
  if (status !== "available" || !counts || sumGradeCounts(counts) <= 0) {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      {CAMPAIGN_GRADES.filter((grade) => (counts[grade] ?? 0) > 0).map(
        (grade) => {
          const count = counts[grade] ?? 0;

          return (
            <span
              className={`inline-flex h-6 min-w-7 items-center justify-center gap-1 rounded-md border px-1.5 text-[0.68rem] font-bold tabular-nums ${GRADE_CLASSES[grade]}`}
              key={grade}
              title={`${grade}: ${formatNumber(count)}`}
            >
              <span>{grade}</span>
              {count > 1 ? (
                <span className="font-semibold tabular-nums">{count}</span>
              ) : null}
            </span>
          );
        },
      )}
    </div>
  );
}

function CampaignAdsAction({
  campaign,
  onOpen,
}: {
  campaign: StateLawFirmCampaignRow;
  onOpen: () => void;
}) {
  const adCount = campaign.ads?.length ?? 0;
  const canOpen = campaign.adsStatus === "available" && adCount > 0;
  const label = `Open ${formatNumber(adCount)} ads for ${campaign.campaignName}`;

  if (!canOpen) {
    return (
      <span className="block text-right text-xs font-semibold text-slate-400">
        -
      </span>
    );
  }

  return (
    <button
      aria-label={label}
      className="inline-flex h-8 min-w-16 items-center justify-center rounded-md border border-teal-200 bg-teal-50 px-2.5 text-xs font-bold tabular-nums text-teal-800 transition hover:border-teal-300 hover:bg-teal-100 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
      onClick={onOpen}
      title={label}
      type="button"
    >
      {formatNumber(adCount)}
    </button>
  );
}

function CampaignAdsModal({
  auditPlatform,
  campaign,
  lawFirm,
  onClose,
  query,
  stateName,
}: {
  auditPlatform: HealthDashboardPlatform;
  campaign: StateLawFirmCampaignRow;
  lawFirm: string;
  onClose: () => void;
  query: DashboardQueryParams;
  stateName: string;
}) {
  const ads = campaign.ads ?? [];
  const [sorting, setSorting] = useState<SortingState>([
    { desc: true, id: "spend" },
  ]);
  const stats = useMemo(() => buildCampaignAdStats(ads), [ads]);
  const columns = useMemo<ColumnDef<StateLawFirmCampaignAdRow>[]>(
    () => [
      {
        accessorKey: "adName",
        header: "Ad",
      },
      {
        accessorKey: "grade",
        header: "Grade",
        sortDescFirst: true,
        sortingFn: campaignAdGradeSortingFn,
      },
      {
        accessorKey: "platform",
        header: "Platform",
      },
      {
        accessorFn: (row) => getCampaignAdStatus(row).id,
        header: "Status",
        id: "status",
        sortingFn: campaignAdStatusSortingFn,
      },
      {
        accessorKey: "spend",
        header: "Spend",
        sortDescFirst: true,
        sortingFn: nullableCampaignAdNumberSortingFn,
      },
      {
        accessorKey: "leads",
        header: "Leads",
        sortDescFirst: true,
        sortingFn: nullableCampaignAdNumberSortingFn,
      },
      {
        accessorKey: "signedLeads",
        header: "SL",
        sortDescFirst: true,
        sortingFn: nullableCampaignAdNumberSortingFn,
      },
      {
        accessorKey: "cpl",
        header: "CPL",
        sortingFn: nullableCampaignAdNumberSortingFn,
      },
      {
        accessorKey: "cpsl",
        header: "Overall CPSL",
        id: "overallCpsl",
        sortingFn: nullableCampaignAdNumberSortingFn,
      },
      {
        accessorKey: "inStateSignedLeads",
        header: "In-State SL",
        sortDescFirst: true,
        sortingFn: nullableCampaignAdNumberSortingFn,
      },
      {
        accessorKey: "oosSignedLeads",
        header: "OOS SL",
        sortDescFirst: true,
        sortingFn: nullableCampaignAdNumberSortingFn,
      },
      {
        accessorKey: "inStateCpsl",
        header: "In-State CPSL",
        sortingFn: nullableCampaignAdNumberSortingFn,
      },
      {
        accessorKey: "oosCpsl",
        header: "OOS CPSL",
        sortingFn: nullableCampaignAdNumberSortingFn,
      },
      {
        accessorKey: "confidence",
        header: "Confidence",
        sortingFn: campaignAdConfidenceSortingFn,
      },
      {
        accessorKey: "recommendation",
        header: "Recommendation",
        sortingFn: campaignAdRecommendationSortingFn,
      },
    ],
    [],
  );
  const table = useReactTable({
    columns,
    data: ads,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  return (
    <div
      aria-labelledby="campaign-ads-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 px-4 py-6"
      role="dialog"
    >
      <div className="flex max-h-full w-full max-w-[1280px] flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Campaign ads
            </p>
            <h2
              className="mt-1 truncate text-xl font-bold text-slate-950"
              id="campaign-ads-modal-title"
              title={campaign.campaignName}
            >
              {campaign.campaignName}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {lawFirm} · {formatNumber(ads.length)} ads · {stateName}{" "}
              <Link
                className="font-semibold text-teal-700 underline decoration-teal-200 underline-offset-2 transition hover:text-teal-900"
                href={buildHealthPageUrl({
                  brand: query.brand,
                  from: query.from,
                  platform: auditPlatform,
                  states: [stateName],
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
          <SummaryItem label="Spend" value={formatCurrency(stats.spend)} />
          <SummaryItem label="Leads" value={formatNumber(stats.leads)} />
          <SummaryItem label="SL" value={formatNumber(stats.signedLeads)} />
          <SummaryItem label="Overall CPSL" value={formatCurrency(stats.cpsl)} />
          <SummaryItem
            label="In-State SL"
            value={formatNumber(stats.inStateSignedLeads)}
          />
          <SummaryItem label="OOS SL" value={formatNumber(stats.oosSignedLeads)} />
          <SummaryItem
            label="In-State CPSL"
            value={formatCurrency(stats.inStateCpsl)}
          />
          <SummaryItem label="OOS CPSL" value={formatCurrency(stats.oosCpsl)} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-5">
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full min-w-[1580px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[260px]" />
                <col className="w-[80px]" />
                <col className="w-[100px]" />
                <col className="w-[95px]" />
                <col className="w-[105px]" />
                <col className="w-[90px]" />
                <col className="w-[90px]" />
                <col className="w-[100px]" />
                <col className="w-[125px]" />
                <col className="w-[105px]" />
                <col className="w-[90px]" />
                <col className="w-[125px]" />
                <col className="w-[115px]" />
                <col className="w-[110px]" />
                <col className="w-[150px]" />
              </colgroup>
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        className={`px-3 py-2 font-semibold ${
                          isNumericCampaignAdColumn(header.column.id)
                            ? "text-right"
                            : "text-left"
                        }`}
                        key={header.id}
                      >
                        {renderSortableHeader(header)}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map((tableRow) => {
                    const ad = tableRow.original;
                    const status = getCampaignAdStatus(ad);

                    return (
                      <tr
                        className="bg-white transition hover:bg-slate-50/80"
                        key={tableRow.id}
                      >
                        <td className="min-w-0 px-3 py-3">
                          <div
                            className="break-words font-semibold text-slate-950 [overflow-wrap:anywhere]"
                            title={ad.adName || undefined}
                          >
                            {ad.adName || "Unnamed ad"}
                          </div>
                          <div className="mt-1 space-y-0.5 text-xs font-medium text-slate-500">
                            <div>{ad.brand}</div>
                            <div className="break-words [overflow-wrap:anywhere]">
                              {formatAdContextLine(ad)}
                            </div>
                          </div>
                        </td>
                        <td
                          className="px-3 py-3"
                          title={formatCampaignAdGradeTitle(ad)}
                        >
                          <CampaignAdGradeChip grade={ad.grade} />
                        </td>
                        <td className="px-3 py-3">
                          <CampaignAdPlatformChip platform={ad.platform} />
                        </td>
                        <td className="px-3 py-3">
                          <CampaignAdStatusChip status={status} />
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatCurrency(ad.spend)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatNumber(ad.leads)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatNumber(ad.signedLeads)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatCurrency(ad.cpl)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatCurrency(ad.cpsl)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatNumber(ad.inStateSignedLeads)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatNumber(ad.oosSignedLeads)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatCurrency(ad.inStateCpsl)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatCurrency(ad.oosCpsl)}
                        </td>
                        <td className="px-3 py-3">
                          <CampaignAdConfidenceChip
                            confidence={ad.confidence}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <CampaignAdRecommendationChip
                            recommendation={ad.recommendation}
                          />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      className="px-3 py-8 text-center text-sm font-medium text-slate-500"
                      colSpan={columns.length}
                    >
                      No ad audit data is available for this campaign.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function CampaignAdGradeChip({ grade }: { grade: CampaignGrade }) {
  return (
    <span
      className={`inline-flex h-8 min-w-10 items-center justify-center rounded-md border px-2 text-sm font-bold ${GRADE_CLASSES[grade]}`}
    >
      {grade}
    </span>
  );
}

function CampaignAdPlatformChip({
  platform,
}: {
  platform: StateLawFirmCampaignAdRow["platform"];
}) {
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${PLATFORM_CLASSES[platform]}`}
    >
      {platform === "tiktok" ? "TikTok" : "Meta"}
    </span>
  );
}

function CampaignAdStatusChip({
  status,
}: {
  status: StateLawFirmCampaignAdRow["metaStatus"];
}) {
  const rawStatus = [status.effectiveStatus, status.configuredStatus]
    .filter(Boolean)
    .join(" / ");

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${META_STATUS_CLASSES[status.id]}`}
      title={
        rawStatus
          ? `Effective/configured status: ${rawStatus}`
          : "Delivery status is unavailable."
      }
    >
      {status.label}
    </span>
  );
}

function CampaignAdConfidenceChip({
  confidence,
}: {
  confidence: StateLawFirmCampaignAdRow["confidence"];
}) {
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${CONFIDENCE_CLASSES[confidence]}`}
    >
      {confidence}
    </span>
  );
}

function CampaignAdRecommendationChip({
  recommendation,
}: {
  recommendation: StateLawFirmCampaignAdRow["recommendation"];
}) {
  return (
    <span
      className={`inline-flex max-w-full rounded-md border px-2 py-1 text-left text-xs font-semibold leading-tight ${RECOMMENDATION_CLASSES[recommendation]}`}
    >
      {recommendation}
    </span>
  );
}

function toggleSelectedGrade(
  selectedGrades: CampaignGrade[],
  grade: CampaignGrade,
): CampaignGrade[] {
  const next = selectedGrades.includes(grade)
    ? selectedGrades.filter((currentGrade) => currentGrade !== grade)
    : [...selectedGrades, grade];
  const nextSet = new Set(next);

  return CAMPAIGN_GRADES.filter((currentGrade) => nextSet.has(currentGrade));
}

function countCampaignRowsByGrade(
  campaigns: StateLawFirmCampaignRow[],
  key: CampaignGradeCountsKey,
): CampaignGradeCounts {
  return campaigns.reduce((counts, campaign) => {
    const gradeCounts = campaign[key];

    for (const grade of CAMPAIGN_GRADES) {
      if ((gradeCounts?.[grade] ?? 0) > 0) {
        counts[grade] += 1;
      }
    }

    return counts;
  }, buildEmptyGradeCounts());
}

function isNumericCampaignColumn(columnId: string): boolean {
  return (
    columnId === "ads" || columnId === "leads" || columnId === "signedLeads"
  );
}

function gradeCountsMatchSelection(
  counts: CampaignGradeCounts | null | undefined,
  selectedGrades: CampaignGrade[],
): boolean {
  if (selectedGrades.length === 0) {
    return true;
  }

  return selectedGrades.some((grade) => (counts?.[grade] ?? 0) > 0);
}

function getGradeBreakdownSortValue(
  row: StateLawFirmCampaignRow,
  columnId: string,
): number {
  const counts =
    columnId === "adGradeCounts" ? row.adGradeCounts : row.campaignGradeCounts;
  const presentGrades = CAMPAIGN_GRADES.filter(
    (grade) => (counts?.[grade] ?? 0) > 0,
  );

  if (presentGrades.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(...presentGrades.map((grade) => GRADE_SORT_RANKS[grade]));
}

function getPrimaryCampaignGrade(counts: CampaignGradeCounts): CampaignGrade {
  return CAMPAIGN_GRADES.reduce((selectedGrade, grade) => {
    if ((counts[grade] ?? 0) <= 0) {
      return selectedGrade;
    }

    return GRADE_SORT_RANKS[grade] > GRADE_SORT_RANKS[selectedGrade]
      ? grade
      : selectedGrade;
  }, "A" as CampaignGrade);
}

function buildEmptyGradeCounts(): CampaignGradeCounts {
  return CAMPAIGN_GRADES.reduce((counts, grade) => {
    counts[grade] = 0;

    return counts;
  }, {} as CampaignGradeCounts);
}

function buildCampaignDrilldownStats(
  campaigns: StateLawFirmCampaignRow[],
  filteredCampaigns: StateLawFirmCampaignRow[],
) {
  const totalLeads = sumCampaignMetric(campaigns, "leads");
  const totalSignedLeads = sumCampaignMetric(campaigns, "signedLeads");
  const filteredLeads = sumCampaignMetric(filteredCampaigns, "leads");
  const filteredSignedLeads = sumCampaignMetric(
    filteredCampaigns,
    "signedLeads",
  );

  return {
    filteredLeads,
    filteredSignedLeads,
    totalLeads,
    totalSignedLeads,
  };
}

function sumCampaignMetric(
  campaigns: StateLawFirmCampaignRow[],
  key: "leads" | "signedLeads",
): number {
  return campaigns.reduce((total, campaign) => total + campaign[key], 0);
}

function buildCampaignAdStats(ads: StateLawFirmCampaignAdRow[]) {
  const spend = sumCampaignAdMetric(ads, "spend");
  const leads = sumCampaignAdMetric(ads, "leads");
  const signedLeads = sumCampaignAdMetric(ads, "signedLeads");
  const inStateSignedLeads = sumCampaignAdMetric(ads, "inStateSignedLeads");
  const oosSignedLeads = sumCampaignAdMetric(ads, "oosSignedLeads");

  return {
    cpl: safeDivide(spend, leads),
    cpsl: safeDivide(spend, signedLeads),
    inStateCpsl: safeDivide(spend, inStateSignedLeads),
    inStateSignedLeads,
    leads,
    oosCpsl: safeDivide(spend, oosSignedLeads),
    oosSignedLeads,
    signedLeads,
    spend,
  };
}

function sumCampaignAdMetric(
  ads: StateLawFirmCampaignAdRow[],
  key:
    | "inStateSignedLeads"
    | "leads"
    | "oosSignedLeads"
    | "signedLeads"
    | "spend",
): number {
  return ads.reduce((total, ad) => total + (ad[key] ?? 0), 0);
}

function isNumericCampaignAdColumn(columnId: string): boolean {
  return (
    columnId === "spend" ||
    columnId === "leads" ||
    columnId === "signedLeads" ||
    columnId === "cpl" ||
    columnId === "overallCpsl" ||
    columnId === "cpsl" ||
    columnId === "inStateSignedLeads" ||
    columnId === "oosSignedLeads" ||
    columnId === "inStateCpsl" ||
    columnId === "oosCpsl"
  );
}

function getCampaignAdStatus(
  ad: StateLawFirmCampaignAdRow,
): StateLawFirmCampaignAdRow["metaStatus"] {
  if (ad.platform === "tiktok") {
    return ad.adsetStatus ?? ad.metaStatus ?? UNKNOWN_META_STATUS;
  }

  return ad.metaStatus ?? UNKNOWN_META_STATUS;
}

function formatAdContextLine(ad: StateLawFirmCampaignAdRow): string {
  const parts = [
    ad.adId ? `Ad ID ${ad.adId}` : null,
    ad.adsetName ? `Ad set ${ad.adsetName}` : null,
  ].filter(Boolean);

  return parts.join(" · ") || "Ad ID unavailable";
}

function formatCampaignAdGradeTitle(ad: StateLawFirmCampaignAdRow): string {
  const metricHealth = ad.metricHealth;
  const metricSummary = metricHealth
    ? [
        metricHealth.attribution,
        metricHealth.cpsl,
        metricHealth.volume,
        metricHealth.intake,
      ]
        .filter(Boolean)
        .map(
          (metric) =>
            `${metric.label}: ${HEALTH_STATUS_LABELS[metric.status]}`,
        )
        .join("; ")
    : "";

  return [
    ad.recommendation,
    `${ad.confidence} confidence`,
    metricSummary,
  ]
    .filter(Boolean)
    .join(". ");
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
  auditPlatform,
  gradeCounts,
  query,
  stateName,
  status,
}: {
  adGradeCounts: CampaignGradeCounts;
  adStatus: CampaignGradeCountsStatus;
  auditPlatform: HealthDashboardPlatform;
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
            platform={auditPlatform}
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
            platform={auditPlatform}
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
  platform,
  query,
  stateName,
  total,
}: {
  counts: Partial<CampaignGradeCounts> | null | undefined;
  kind: "ad" | "campaign";
  label: string;
  platform: HealthDashboardPlatform;
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
            platform={platform}
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
  platform,
  query,
  stateName,
}: {
  count: number;
  grade: CampaignGrade;
  kind: "ad" | "campaign";
  platform: HealthDashboardPlatform;
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
        platform,
        grades: kind === "campaign" ? [grade] : null,
        states: [stateName],
        to: query.to,
      })}
    >
      {content}
    </Link>
  );
}

function inferAuditPlatform(
  apiUrl: string | null | undefined,
): HealthDashboardPlatform {
  const normalized = apiUrl?.trim().toLowerCase().replace(/\/+$/, "") ?? "";

  if (normalized.endsWith("/marketing-dashboard/tiktok")) {
    return "tiktok";
  }

  if (normalized.endsWith("/marketing-dashboard/combined")) {
    return "all";
  }

  return "meta";
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

function formatGradeBreakdownTitle(
  counts: Partial<CampaignGradeCounts> | null | undefined,
): string {
  if (!counts) {
    return "";
  }

  return CAMPAIGN_GRADES.filter((grade) => (counts[grade] ?? 0) > 0)
    .map((grade) => `${grade}: ${formatNumber(counts[grade] ?? 0)}`)
    .join(" · ");
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

async function fetchLawFirmBreakdown(
  url: string,
  signal: AbortSignal,
): Promise<{ data: StateLawFirmsSection | StateLawFirmRow[] }> {
  let lastError: unknown = null;

  for (
    let attempt = 0;
    attempt <= LAW_FIRM_FETCH_RETRY_DELAYS_MS.length;
    attempt += 1
  ) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        credentials: "include",
        signal,
      });

      if (
        shouldRetryLawFirmResponse(response) &&
        attempt < LAW_FIRM_FETCH_RETRY_DELAYS_MS.length
      ) {
        await waitForLawFirmRetry(
          LAW_FIRM_FETCH_RETRY_DELAYS_MS[attempt],
          signal,
        );
        continue;
      }

      if (!response.ok) {
        throw new Error(await readLawFirmResponseMessage(response));
      }

      return (await response.json()) as {
        data: StateLawFirmsSection | StateLawFirmRow[];
      };
    } catch (caughtError) {
      if (signal.aborted) {
        throw caughtError;
      }

      lastError = caughtError;

      if (
        !isRetryableLawFirmFetchError(caughtError) ||
        attempt >= LAW_FIRM_FETCH_RETRY_DELAYS_MS.length
      ) {
        throw caughtError;
      }

      await waitForLawFirmRetry(
        LAW_FIRM_FETCH_RETRY_DELAYS_MS[attempt],
        signal,
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to load law firm breakdown.");
}

function shouldRetryLawFirmResponse(response: Response): boolean {
  return [408, 429, 500, 502, 503, 504].includes(response.status);
}

function isRetryableLawFirmFetchError(caughtError: unknown): boolean {
  if (!(caughtError instanceof Error)) {
    return false;
  }

  const message = caughtError.message.toLowerCase();

  return (
    caughtError.name === "TypeError" &&
    (message.includes("failed to fetch") ||
      message.includes("load failed") ||
      message.includes("networkerror") ||
      message.includes("network request failed"))
  );
}

function formatLawFirmLoadError(error: Error): string {
  if (isRetryableLawFirmFetchError(error)) {
    return "The connection dropped while loading the law firm breakdown. We retried automatically; please try again in a moment.";
  }

  return error.message;
}

function waitForLawFirmRetry(
  delayMs: number,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Request was aborted.", "AbortError"));
      return;
    }

    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, delayMs);

    function handleAbort() {
      window.clearTimeout(timeoutId);
      reject(new DOMException("Request was aborted.", "AbortError"));
    }

    signal.addEventListener("abort", handleAbort, { once: true });
  });
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
