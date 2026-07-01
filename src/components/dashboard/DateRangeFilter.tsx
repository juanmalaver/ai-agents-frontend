"use client";

import { useEffect, useMemo, useState } from "react";
import type { DashboardDateRange } from "@/src/types/dashboard";
import {
  addDaysToDateInputValue,
  constrainDateRangeDays,
  getCurrentMonthDateRange,
  getInclusiveDateRangeDays,
  isSameDateRange,
} from "@/src/utils/dateRangeDefaults";

interface DateRangeFilterProps {
  dateRange: DashboardDateRange;
  maxRangeDays?: number;
  onDateRangeChange: (dateRange: DashboardDateRange) => void;
}

export function DateRangeFilter({
  dateRange,
  maxRangeDays,
  onDateRangeChange,
}: DateRangeFilterProps) {
  const defaultDateRange = constrainDateRangeDays(
    getCurrentMonthDateRange(),
    maxRangeDays,
  );
  const effectiveDateRange =
    dateRange.from && dateRange.to ? dateRange : defaultDateRange;
  const [draftRange, setDraftRange] = useState({
    from: effectiveDateRange.from ?? "",
    to: effectiveDateRange.to ?? "",
  });
  const validationError = useMemo(() => {
    if (!draftRange.from && !draftRange.to) {
      return null;
    }

    if (!draftRange.from || !draftRange.to) {
      return "Choose both dates.";
    }

    if (draftRange.from > draftRange.to) {
      return "Start date must be on or before end date.";
    }

    if (
      maxRangeDays &&
      getInclusiveDateRangeDays(draftRange.from, draftRange.to) > maxRangeDays
    ) {
      return `Choose a range of ${maxRangeDays} days or less.`;
    }

    return null;
  }, [draftRange.from, draftRange.to, maxRangeDays]);
  const hasChanges =
    draftRange.from !== (effectiveDateRange.from ?? "") ||
    draftRange.to !== (effectiveDateRange.to ?? "");
  const canReset =
    hasChanges ||
    (Boolean(dateRange.from && dateRange.to) &&
      !isSameDateRange(dateRange, defaultDateRange));

  useEffect(() => {
    setDraftRange({
      from: effectiveDateRange.from ?? "",
      to: effectiveDateRange.to ?? "",
    });
  }, [effectiveDateRange.from, effectiveDateRange.to]);

  const toMaximum = maxRangeDays
    ? getRangeBoundary(draftRange.from, maxRangeDays - 1)
    : undefined;

  function handleFromChange(from: string) {
    const automaticTo = getAutomaticToDate(from, maxRangeDays);

    setDraftRange((current) => ({
      from,
      to: automaticTo ?? current.to,
    }));
  }

  function handleToChange(to: string) {
    setDraftRange((current) => ({ ...current, to }));
  }

  return (
    <form
      className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-start"
      onSubmit={(event) => {
        event.preventDefault();

        if (validationError) {
          return;
        }

        onDateRangeChange({
          from: draftRange.from || null,
          to: draftRange.to || null,
        });
      }}
    >
      <DateInput
        label="From"
        onChange={handleFromChange}
        value={draftRange.from}
      />
      <DateInput
        label="To"
        max={toMaximum}
        min={draftRange.from || undefined}
        onChange={handleToChange}
        value={draftRange.to}
      />
      <div className="flex min-h-9 flex-wrap items-center gap-2 md:mt-6 md:justify-end">
        {hasChanges ? (
          <button
            className="h-9 rounded-md bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={Boolean(validationError)}
            type="submit"
          >
            Apply
          </button>
        ) : null}
        {canReset ? (
          <button
            className="h-9 rounded-md px-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            onClick={() => {
              setDraftRange({
                from: defaultDateRange.from ?? "",
                to: defaultDateRange.to ?? "",
              });
              onDateRangeChange({ from: null, to: null });
            }}
            type="button"
          >
            Reset
          </button>
        ) : null}
      </div>
      {validationError ? (
        <p className="text-xs font-medium text-rose-700 md:col-span-3">
          {validationError}
        </p>
      ) : null}
    </form>
  );
}

function getAutomaticToDate(
  from: string,
  maxRangeDays: number | undefined,
): string | null {
  return from && maxRangeDays && maxRangeDays > 0
    ? addDaysToDateInputValue(from, maxRangeDays - 1)
    : null;
}

function getRangeBoundary(value: string, days: number): string | undefined {
  return value ? addDaysToDateInputValue(value, days) : undefined;
}

function DateInput({
  label,
  max,
  min,
  onChange,
  value,
}: {
  label: string;
  max?: string;
  min?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const id = `marketing-dashboard-date-${label.toLowerCase()}`;

  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      <input
        className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        id={id}
        max={max}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    </label>
  );
}
