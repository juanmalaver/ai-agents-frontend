"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  type ExpandedState,
  type FilterFn,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type Header,
  type SortingFn,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Fragment, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  CampaignStateRow,
  CampaignStateTableProps,
  RowHealth,
} from "@/src/types/dashboard";
import {
  formatCurrency,
  formatNumber,
  formatPercentage,
  safeDivide,
} from "@/src/utils/dashboardFormatters";
import { buildHealthPageUrl } from "@/src/utils/runtimeApiUrls";
import { RecommendationPanel } from "./RecommendationPanel";
import { StateLawFirmModal } from "./StateLawFirmModal";

const rowHealthClasses: Record<RowHealth, string> = {
  critical: "bg-rose-50 hover:bg-rose-100",
  met: "bg-teal-50 hover:bg-teal-100",
  near: "bg-amber-50 hover:bg-amber-100",
  neutral: "bg-white hover:bg-sky-50",
};

const headerLines: Record<string, string[]> = {
  budget: ["Budget"],
  conversionRate: ["Int.", "Conv."],
  cpl: ["CPL"],
  cpsl: ["CPSL"],
  lawFirms: ["Law", "firms"],
  leads: ["Leads"],
  leadsGoal: ["EOM Lead", "Goal"],
  mtdLeadGoalPct: ["% to MTD", "Lead Goal"],
  mtdLeadsGoal: ["MTD Lead", "Goal"],
  mtdSpent: ["Total", "Spent"],
  mtdSl: ["SL"],
  mtdSlGoal: ["MTD SL", "Goal"],
  mtdSlGoalPct: ["% to MTD", "SL Goal"],
  mtdSpentPct: ["MTD %", "Spent"],
  slGoal: ["EOM SL", "Goal"],
  state: ["State"],
};

export function CampaignStateTable({
  apiUrl,
  onSelectedStateFilterChange,
  query,
  rows,
  selectedStateFilter,
}: CampaignStateTableProps) {
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedStateRow, setSelectedStateRow] =
    useState<CampaignStateRow | null>(null);
  const stateOptions = useMemo(() => buildStateFilterOptions(rows), [rows]);
  const activeStateFilter = useMemo(
    () =>
      selectedStateFilter.filter((state) => stateOptions.includes(state)),
    [selectedStateFilter, stateOptions],
  );
  const selectedStateSet = useMemo(
    () => new Set(activeStateFilter),
    [activeStateFilter],
  );
  const columnFilters = useMemo<ColumnFiltersState>(
    () =>
      activeStateFilter.length > 0
        ? [{ id: "state", value: activeStateFilter }]
        : [],
    [activeStateFilter],
  );
  const filteredRowsForTotals = useMemo(
    () => filterRowsByStates(rows, activeStateFilter),
    [activeStateFilter, rows],
  );
  const totalRow = useMemo(
    () => buildTotalRow(filteredRowsForTotals),
    [filteredRowsForTotals],
  );
  const monthPacing = useMemo(() => buildMonthPacing(query.to), [query.to]);

  const columns = useMemo<ColumnDef<CampaignStateRow>[]>(
    () => [
      {
        accessorKey: "state",
        cell: ({ getValue, row }) => {
          const stateName = getValue<string>();

          return (
            <div className="flex items-center gap-2">
              {row.getCanExpand() ? (
                <button
                  aria-label={`${row.getIsExpanded() ? "Collapse" : "Expand"} recommendation for ${stateName}`}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-sky-50"
                  onClick={row.getToggleExpandedHandler()}
                  type="button"
                >
                  {row.getIsExpanded() ? "-" : "+"}
                </button>
              ) : null}
              <Link
                className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2 transition hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
                href={buildHealthPageUrl({
                  brand: query.brand,
                  from: query.from,
                  states: [stateName],
                  to: query.to,
                })}
              >
                {stateName}
              </Link>
            </div>
          );
        },
        footer: () => (
          <div className="flex items-center gap-2">
            <span className="font-semibold">Total</span>
          </div>
        ),
        header: "State",
        filterFn: stateFilterFn,
        meta: {
          info: "Meaning: campaign performance grouped by state. Formula: rows are grouped by the campaign state for the selected date range.",
        },
      },
      {
        accessorKey: "budget",
        cell: ({ getValue }) => formatCurrency(getValue<number | null>()),
        footer: () => formatCurrency(totalRow?.budget ?? null),
        header: "Budget",
        meta: {
          info: "Meaning: monthly budget assigned to the state. Formula: sum of active marketing budget targets for the state.",
        },
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "mtdSpent",
        cell: ({ getValue }) => formatCurrency(getValue<number | null>()),
        footer: () => formatCurrency(totalRow?.mtdSpent ?? null),
        header: "Total Spent",
        meta: {
          info: "Meaning: total ad spend attributed to the state in the selected date range. Formula: sum of campaign spend for the state.",
        },
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorFn: (row) => safeDivide(row.mtdSpent, row.budget),
        cell: ({ getValue }) => formatPercentage(getValue<number | null>()),
        footer: () => formatPercentage(totalRow?.spentPct ?? null),
        header: "MTD % Spent",
        id: "mtdSpentPct",
        meta: {
          info: "Meaning: how much of the monthly budget has been spent so far. Formula: MTD Spend / Budget.",
        },
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "cpl",
        cell: ({ getValue }) => formatCurrency(getValue<number | null>()),
        footer: () => formatCurrency(totalRow?.cpl ?? null),
        header: "CPL",
        meta: {
          info: "Meaning: cost per lead. Formula: MTD Spend / MTD Leads.",
        },
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "cpsl",
        cell: ({ getValue }) => formatCurrency(getValue<number | null>()),
        footer: () => formatCurrency(totalRow?.cpsl ?? null),
        header: "CPSL",
        meta: {
          info: "Meaning: cost per signed lead. Formula: MTD Spend / MTD SL.",
        },
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "leadsGoal",
        cell: ({ getValue }) => formatNumber(getValue<number | null>()),
        footer: () => formatNumber(totalRow?.leadsGoal ?? null),
        header: "EOM Lead Goal",
        meta: {
          info: "Meaning: full-month lead target. Formula: EOM SL Goal x 10.",
        },
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorFn: (row) => calculateMtdGoal(row.leadsGoal, monthPacing),
        cell: ({ getValue }) => formatNumber(getValue<number | null>()),
        footer: () =>
          formatNumber(calculateMtdGoal(totalRow?.leadsGoal, monthPacing)),
        header: "MTD Lead Goal",
        id: "mtdLeadsGoal",
        meta: {
          info: "Meaning: lead goal expected by the selected date. Formula: EOM Lead Goal / days in month x elapsed days.",
        },
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "leads",
        cell: ({ getValue }) => formatNumber(getValue<number | null>()),
        footer: () => formatNumber(totalRow?.leads ?? null),
        header: "Leads",
        meta: {
          info: "Meaning: leads generated month-to-date. Formula: count of CRM leads in the selected month-to-date period.",
        },
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorFn: (row) =>
          safeDivide(row.leads, calculateMtdGoal(row.leadsGoal, monthPacing)),
        cell: ({ getValue }) => formatPercentage(getValue<number | null>()),
        footer: () =>
          formatPercentage(
            safeDivide(
              totalRow?.leads,
              calculateMtdGoal(totalRow?.leadsGoal, monthPacing),
            ),
          ),
        header: "% to MTD Lead Goal",
        id: "mtdLeadGoalPct",
        meta: {
          info: "Meaning: lead pacing against the month-to-date target. Formula: MTD Leads / MTD Lead Goal.",
        },
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "slGoal",
        cell: ({ getValue }) => formatNumber(getValue<number | null>()),
        footer: () => formatNumber(totalRow?.slGoal ?? null),
        header: "EOM SL Goal",
        meta: {
          info: "Meaning: full-month signed-lead target. Formula: sum of active state SL goals for the selected month.",
        },
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorFn: (row) => row.slGoal,
        cell: ({ getValue }) => formatNumber(getValue<number | null>()),
        footer: () => formatNumber(totalRow?.slGoal ?? null),
        header: "MTD SL Goal",
        id: "mtdSlGoal",
        meta: {
          info: "Meaning: signed-lead goal for the selected month.",
        },
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "mtdSl",
        cell: ({ getValue }) => formatNumber(getValue<number | null>()),
        footer: () => formatNumber(totalRow?.mtdSl ?? null),
        header: "SL",
        meta: {
          info: "Meaning: signed leads generated month-to-date. Formula: count of signed CRM leads in the selected month-to-date period.",
        },
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorFn: (row) =>
          safeDivide(row.mtdSl, row.slGoal),
        cell: ({ getValue }) => formatPercentage(getValue<number | null>()),
        footer: () =>
          formatPercentage(safeDivide(totalRow?.mtdSl, totalRow?.slGoal)),
        header: "% to MTD SL Goal",
        id: "mtdSlGoalPct",
        meta: {
          info: "Meaning: signed-lead pacing against the selected month's target. Formula: MTD SL / MTD SL Goal.",
        },
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "conversionRate",
        cell: ({ getValue }) => formatPercentage(getValue<number | null>()),
        footer: () => formatPercentage(totalRow?.conversionRate ?? null),
        header: "Int. Conv.",
        meta: {
          info: "Meaning: lead-to-signed-lead conversion rate. Formula: MTD SL / MTD Leads.",
        },
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        cell: ({ row }) => (
          <button
            aria-label={`View law firms for ${row.original.state}`}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            onClick={() => setSelectedStateRow(row.original)}
            type="button"
          >
            View
          </button>
        ),
        enableSorting: false,
        footer: () => null,
        header: "Law firms",
        id: "lawFirms",
        meta: {
          info: "Meaning: opens the state law firm breakdown. Formula: filters law firm rows to this state and selected date range.",
        },
      },
    ],
    [monthPacing, query.brand, query.from, query.to, totalRow],
  );

  const toggleStateFilter = (state: string, checked: boolean) => {
    if (checked) {
      onSelectedStateFilterChange(
        activeStateFilter.includes(state)
          ? activeStateFilter
          : [...activeStateFilter, state],
      );
      return;
    }

    onSelectedStateFilterChange(
      activeStateFilter.filter((currentState) => currentState !== state),
    );
  };

  const table = useReactTable({
    autoResetExpanded: false,
    columns,
    data: rows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowCanExpand: (row) => Boolean(row.original.recommendation),
    getSortedRowModel: getSortedRowModel(),
    onExpandedChange: setExpanded,
    onSortingChange: setSorting,
    state: {
      columnFilters,
      expanded,
      sorting,
    },
  });

  return (
    <>
      <section
        aria-label="State campaign performance table"
        className="rounded-lg border border-slate-200 bg-white shadow-sm"
      >
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              State campaign performance
            </h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {activeStateFilter.length > 0
                ? `${formatNumber(table.getRowModel().rows.length)} of ${formatNumber(
                    rows.length,
                  )} states`
                : "All states"}
            </p>
          </div>
          <StateFilterMenu
            onClear={() => onSelectedStateFilterChange([])}
            onToggle={toggleStateFilter}
            options={stateOptions}
            selectedStates={selectedStateSet}
          />
        </div>
        <div className="max-h-[72vh] overflow-auto">
          <table className="min-w-[1460px] w-full table-fixed border-collapse text-left text-sm">
            <colgroup>
              <col className="w-[120px]" />
              <col className="w-[90px]" />
              <col className="w-[100px]" />
              <col className="w-[85px]" />
              <col className="w-[78px]" />
              <col className="w-[80px]" />
              <col className="w-[95px]" />
              <col className="w-[98px]" />
              <col className="w-[78px]" />
              <col className="w-[105px]" />
              <col className="w-[92px]" />
              <col className="w-[95px]" />
              <col className="w-[70px]" />
              <col className="w-[105px]" />
              <col className="w-[80px]" />
              <col className="w-[89px]" />
            </colgroup>
            <thead className="bg-sky-50 text-xs uppercase tracking-normal text-slate-600">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      className="sticky top-0 z-20 bg-sky-50 px-3 py-2.5 align-middle font-semibold shadow-[inset_0_-1px_0_rgb(226_232_240)]"
                      key={header.id}
                      scope="col"
                    >
                      {renderHeader(header)}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-200">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-sm text-slate-500"
                    colSpan={table.getVisibleLeafColumns().length}
                  >
                    No state campaign rows available.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => {
                  const mtdSlGoalPct = safeDivide(
                    row.original.mtdSl,
                    row.original.slGoal,
                  );

                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={`transition-colors ${rowHealthClasses[getRowHealth(mtdSlGoalPct)]}`}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            className="whitespace-nowrap px-4 py-3 text-slate-700"
                            key={cell.id}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </td>
                        ))}
                      </tr>
                      {row.getIsExpanded() && row.original.recommendation ? (
                        <tr>
                          <td
                            className="bg-white px-4 py-4"
                            colSpan={row.getVisibleCells().length}
                          >
                            <RecommendationPanel
                              recommendation={row.original.recommendation}
                              stateName={row.original.state}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
            {totalRow ? (
              <tfoot className="border-t-2 border-slate-300 bg-slate-950 text-white">
                {table.getFooterGroups().map((footerGroup) => (
                  <tr key={footerGroup.id}>
                    {footerGroup.headers.map((header) => (
                      <td
                        className="whitespace-nowrap px-4 py-3 font-semibold"
                        key={header.id}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.footer,
                              header.getContext(),
                            )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>
      {selectedStateRow ? (
        <StateLawFirmModal
          apiUrl={apiUrl}
          onClose={() => setSelectedStateRow(null)}
          query={query}
          stateRow={selectedStateRow}
        />
      ) : null}
    </>
  );
}

const nullableNumberSortingFn: SortingFn<CampaignStateRow> = (
  first,
  second,
  columnId,
) =>
  normalizeSortableNumber(first.getValue<number | null>(columnId)) -
  normalizeSortableNumber(second.getValue<number | null>(columnId));

const stateFilterFn: FilterFn<CampaignStateRow> = (
  row,
  columnId,
  filterValue,
) => {
  const selectedStates = Array.isArray(filterValue) ? filterValue : [];

  if (selectedStates.length === 0) {
    return true;
  }

  return selectedStates.includes(row.getValue<string>(columnId));
};

function StateFilterMenu({
  onClear,
  onToggle,
  options,
  selectedStates,
}: {
  onClear: () => void;
  onToggle: (state: string, checked: boolean) => void;
  options: string[];
  selectedStates: Set<string>;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [search, setSearch] = useState("");
  const visibleOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return options;
    }

    return options.filter((state) =>
      state.toLowerCase().includes(normalizedSearch),
    );
  }, [options, search]);
  const selectedCount = selectedStates.size;

  if (options.length === 0) {
    return null;
  }

  return (
    <details className="relative" ref={detailsRef}>
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/30">
        <span>States</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {selectedCount > 0
            ? `${formatNumber(selectedCount)} selected`
            : "All"}
        </span>
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-72 rounded-md border border-slate-200 bg-white p-2 shadow-xl">
        <input
          aria-label="Search states"
          className="mb-2 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search states"
          type="search"
          value={search}
        />
        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {visibleOptions.length > 0 ? (
            visibleOptions.map((state) => (
              <label
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                key={state}
              >
                <input
                  checked={selectedStates.has(state)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  onChange={(event) => onToggle(state, event.target.checked)}
                  type="checkbox"
                />
                <span>{state}</span>
              </label>
            ))
          ) : (
            <div className="rounded-md px-2 py-3 text-center text-sm font-medium text-slate-500">
              No states found.
            </div>
          )}
        </div>
        {selectedCount > 0 ? (
          <button
            className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={onClear}
            type="button"
          >
            Clear
          </button>
        ) : null}
        <button
          className="mt-2 w-full rounded-md border border-slate-300 bg-slate-950 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
          onClick={() => detailsRef.current?.removeAttribute("open")}
          type="button"
        >
          Close
        </button>
      </div>
    </details>
  );
}

function buildStateFilterOptions(rows: CampaignStateRow[]): string[] {
  return Array.from(new Set(rows.map((row) => row.state))).sort((first, second) =>
    first.localeCompare(second),
  );
}

function filterRowsByStates(
  rows: CampaignStateRow[],
  selectedStates: string[],
): CampaignStateRow[] {
  if (selectedStates.length === 0) {
    return rows;
  }

  const selectedStateSet = new Set(selectedStates);

  return rows.filter((row) => selectedStateSet.has(row.state));
}

function renderHeader<TData>(header: Header<TData, unknown>) {
  if (header.isPlaceholder) {
    return null;
  }

  const info = getHeaderInfo(header);

  if (!header.column.getCanSort()) {
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5">
        {renderHeaderLabel(header)}
        {info ? <HeaderInfoIcon info={info} /> : null}
      </span>
    );
  }

  const sorted = header.column.getIsSorted();

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <button
        className="inline-flex min-w-0 items-center gap-1 text-left transition hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
        onClick={header.column.getToggleSortingHandler()}
        type="button"
      >
        {renderHeaderLabel(header)}
        <span
          aria-hidden="true"
          className={`inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full text-[0.58rem] leading-none transition ${
            sorted
              ? "bg-teal-100 text-teal-700"
              : "text-slate-300"
          }`}
        >
          {formatSortIndicator(sorted)}
        </span>
      </button>
      {info ? <HeaderInfoIcon info={info} /> : null}
    </span>
  );
}

function renderHeaderLabel<TData>(header: Header<TData, unknown>) {
  const lines = headerLines[header.column.id];

  if (!lines) {
    return (
      <span className="min-w-0 whitespace-normal leading-tight">
        {flexRender(header.column.columnDef.header, header.getContext())}
      </span>
    );
  }

  return (
    <span className="flex min-w-0 flex-col whitespace-normal leading-[1.05]">
      {lines.map((line) => (
        <span className="block" key={line}>
          {line}
        </span>
      ))}
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

function HeaderInfoIcon({ info }: { info: string }) {
  return (
    <button
      aria-label={info}
      className="group/info relative inline-flex h-3 w-3 shrink-0 cursor-help items-center justify-center rounded-full text-slate-400 transition hover:bg-white/70 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
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
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 hidden w-64 -translate-x-1/2 rounded-md bg-slate-950 px-2.5 py-2 text-left text-[0.68rem] font-medium normal-case leading-snug tracking-normal text-white shadow-lg group-hover/info:block group-focus/info:block"
        role="tooltip"
      >
        {info}
      </span>
    </button>
  );
}

function buildTotalRow(rows: CampaignStateRow[]): CampaignStateRow | null {
  if (rows.length === 0) {
    return null;
  }

  const budget = sumNullable(rows.map((row) => row.budget));
  const slGoal = sumNullable(rows.map((row) => row.slGoal));
  const leadsGoal = sumNullable(rows.map((row) => row.leadsGoal));
  const mtdSpent = sumNullable(rows.map((row) => row.mtdSpent));
  const mtdSl = sumNullable(rows.map((row) => row.mtdSl));
  const leads = sumNullable(rows.map((row) => row.leads));
  const spendWithBudget = sumNullable(
    rows.filter((row) => isFiniteNumber(row.budget)).map((row) => row.mtdSpent),
  );
  const slWithGoal = sumNullable(
    rows.filter((row) => isFiniteNumber(row.slGoal)).map((row) => row.mtdSl),
  );

  return {
    budget,
    conversionRate: safeDivide(mtdSl, leads),
    cpl: safeDivide(mtdSpent, leads),
    cpsl: safeDivide(mtdSpent, mtdSl),
    goalPct: safeDivide(slWithGoal, slGoal),
    id: "total",
    leads,
    leadsGoal,
    mtdSl,
    mtdSpent,
    recommendation: null,
    slGoal,
    spentPct: safeDivide(spendWithBudget, budget),
    state: "Total",
  };
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

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getRowHealth(goalPct: number | null): RowHealth {
  if (goalPct == null || !Number.isFinite(goalPct)) {
    return "neutral";
  }

  if (goalPct < 0.8) {
    return "critical";
  }

  if (goalPct < 1) {
    return "near";
  }

  return "met";
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

function formatSortIndicator(value: false | "asc" | "desc"): string {
  if (value === "asc") {
    return "↑";
  }

  if (value === "desc") {
    return "↓";
  }

  return "↕";
}
