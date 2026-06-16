"use client";

import {
  type ColumnDef,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Fragment, useMemo, useState } from "react";
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
import { RecommendationPanel } from "./RecommendationPanel";

const rowHealthClasses: Record<RowHealth, string> = {
  critical: "bg-rose-50 hover:bg-rose-100",
  met: "bg-teal-50 hover:bg-teal-100",
  near: "bg-amber-50 hover:bg-amber-100",
  neutral: "bg-white hover:bg-sky-50",
};

export function CampaignStateTable({ rows }: CampaignStateTableProps) {
  const [expanded, setExpanded] = useState<ExpandedState>({});
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
              <span className="font-semibold text-slate-950">{stateName}</span>
            </div>
          );
        },
        header: "State",
      },
      {
        accessorKey: "budget",
        cell: ({ getValue }) => formatCurrency(getValue<number | null>()),
        header: "Budget",
      },
      {
        accessorKey: "slGoal",
        cell: ({ getValue }) => formatNumber(getValue<number | null>()),
        header: "SL Goal",
      },
      {
        accessorKey: "leadsGoal",
        cell: ({ getValue }) => formatNumber(getValue<number | null>()),
        header: "Q. Leads Goal",
      },
      {
        accessorKey: "mtdSpent",
        cell: ({ getValue }) => formatCurrency(getValue<number | null>()),
        header: "MTD Spent",
      },
      {
        accessorKey: "spentPct",
        cell: ({ getValue }) => formatPercentage(getValue<number | null>()),
        header: "% Spent",
      },
      {
        accessorKey: "goalPct",
        cell: ({ getValue }) => formatPercentage(getValue<number | null>()),
        header: "% Goal",
      },
      {
        accessorKey: "cpsl",
        cell: ({ getValue }) => formatCurrency(getValue<number | null>()),
        header: "CPSL",
      },
      {
        accessorKey: "mtdSl",
        cell: ({ getValue }) => formatNumber(getValue<number | null>()),
        header: "MTD SL",
      },
      {
        accessorKey: "leads",
        cell: ({ getValue }) => formatNumber(getValue<number | null>()),
        header: "Leads",
      },
      {
        accessorKey: "conversionRate",
        cell: ({ getValue }) => formatPercentage(getValue<number | null>()),
        header: "Conversion Rate",
      },
      {
        accessorKey: "cpl",
        cell: ({ getValue }) => formatCurrency(getValue<number | null>()),
        header: "CPL",
      },
    ],
    [],
  );

  const table = useReactTable({
    columns,
    data: rows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: (row) => Boolean(row.original.recommendation),
    onExpandedChange: setExpanded,
    state: {
      expanded,
    },
  });

  return (
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
        <table className="min-w-[1120px] w-full border-collapse text-left text-sm">
          <thead className="bg-sky-50 text-xs uppercase tracking-normal text-slate-600">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    className="whitespace-nowrap px-4 py-3 font-semibold"
                    key={header.id}
                    scope="col"
                  >
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
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-sm text-slate-500"
                  colSpan={columns.length}
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
              <tr>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true" className="h-7 w-7" />
                    <span className="font-semibold">{totalRow.state}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold">
                  {formatCurrency(totalRow.budget)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold">
                  {formatNumber(totalRow.slGoal)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold">
                  {formatNumber(totalRow.leadsGoal)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold">
                  {formatCurrency(totalRow.mtdSpent)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold">
                  {formatPercentage(totalRow.spentPct)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold">
                  {formatPercentage(totalRow.goalPct)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold">
                  {formatCurrency(totalRow.cpsl)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold">
                  {formatNumber(totalRow.mtdSl)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold">
                  {formatNumber(totalRow.leads)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold">
                  {formatPercentage(totalRow.conversionRate)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold">
                  {formatCurrency(totalRow.cpl)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
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
    rows
      .filter((row) => isFiniteNumber(row.budget))
      .map((row) => row.mtdSpent),
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
