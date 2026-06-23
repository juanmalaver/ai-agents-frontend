"use client";

import {
  type ColumnDef,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  type SortingFn,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Fragment, useMemo, useState } from "react";
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

export function CampaignStateTable({ apiUrl, query, rows }: CampaignStateTableProps) {
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedStateRow, setSelectedStateRow] =
    useState<CampaignStateRow | null>(null);
  const totalRow = useMemo(() => buildTotalRow(rows), [rows]);

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
              ) : (
                <span aria-hidden="true" className="h-7 w-7" />
              )}
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
            <span aria-hidden="true" className="h-7 w-7" />
            <span className="font-semibold">Total</span>
          </div>
        ),
        header: "State",
      },
      {
        accessorKey: "budget",
        cell: ({ getValue }) => formatCurrency(getValue<number | null>()),
        footer: () => formatCurrency(totalRow?.budget ?? null),
        header: "Budget",
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "slGoal",
        cell: ({ getValue }) => formatNumber(getValue<number | null>()),
        footer: () => formatNumber(totalRow?.slGoal ?? null),
        header: "SL Goal",
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "leadsGoal",
        cell: ({ getValue }) => formatNumber(getValue<number | null>()),
        footer: () => formatNumber(totalRow?.leadsGoal ?? null),
        header: "Leads Goal",
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "mtdSpent",
        cell: ({ getValue }) => formatCurrency(getValue<number | null>()),
        footer: () => formatCurrency(totalRow?.mtdSpent ?? null),
        header: "MTD Spent",
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "spentPct",
        cell: ({ getValue }) => formatPercentage(getValue<number | null>()),
        footer: () => formatPercentage(totalRow?.spentPct ?? null),
        header: "% Spent",
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "goalPct",
        cell: ({ getValue }) => formatPercentage(getValue<number | null>()),
        footer: () => formatPercentage(totalRow?.goalPct ?? null),
        header: "% Goal",
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "cpsl",
        cell: ({ getValue }) => formatCurrency(getValue<number | null>()),
        footer: () => formatCurrency(totalRow?.cpsl ?? null),
        header: "CPSL",
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "mtdSl",
        cell: ({ getValue }) => formatNumber(getValue<number | null>()),
        footer: () => formatNumber(totalRow?.mtdSl ?? null),
        header: "MTD SL",
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "leads",
        cell: ({ getValue }) => formatNumber(getValue<number | null>()),
        footer: () => formatNumber(totalRow?.leads ?? null),
        header: "Leads",
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "conversionRate",
        cell: ({ getValue }) => formatPercentage(getValue<number | null>()),
        footer: () => formatPercentage(totalRow?.conversionRate ?? null),
        header: "Conversion Rate",
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "cpl",
        cell: ({ getValue }) => formatCurrency(getValue<number | null>()),
        footer: () => formatCurrency(totalRow?.cpl ?? null),
        header: "CPL",
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
      },
    ],
    [query.brand, query.from, query.to, totalRow],
  );

  const table = useReactTable({
    autoResetExpanded: false,
    columns,
    data: rows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: (row) => Boolean(row.original.recommendation),
    getSortedRowModel: getSortedRowModel(),
    onExpandedChange: setExpanded,
    onSortingChange: setSorting,
    state: {
      expanded,
      sorting,
    },
  });

  return (
    <>
      <section
        aria-label="State campaign performance table"
        className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
      >
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-950">
            State campaign performance
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full border-collapse text-left text-sm">
            <thead className="bg-sky-50 text-xs uppercase tracking-normal text-slate-600">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      className="whitespace-nowrap px-4 py-3 font-semibold"
                      key={header.id}
                      scope="col"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          className="flex items-center gap-1 text-left transition hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                          onClick={header.column.getToggleSortingHandler()}
                          type="button"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          <span
                            aria-hidden="true"
                            className="text-[0.65rem] text-slate-400"
                          >
                            {formatSortIndicator(header.column.getIsSorted())}
                          </span>
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
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
                table.getRowModel().rows.map((row) => (
                  <Fragment key={row.id}>
                    <tr
                      className={`transition-colors ${rowHealthClasses[getRowHealth(row.original.goalPct)]}`}
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
                ))
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

function formatSortIndicator(value: false | "asc" | "desc"): string {
  if (value === "asc") {
    return "↑";
  }

  if (value === "desc") {
    return "↓";
  }

  return "↕";
}
