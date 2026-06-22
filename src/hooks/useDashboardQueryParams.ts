"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  DashboardDateRange,
  DashboardQueryParams,
} from "@/src/types/dashboard";
import { getCurrentMonthDateRange } from "@/src/utils/dateRangeDefaults";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function useDashboardQueryParams() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedBrand = useMemo(
    () => normalizeBrandParam(searchParams.get("brand")),
    [searchParams],
  );
  const dateRange = useMemo(
    () =>
      normalizeDateRange({
        from: searchParams.get("from"),
        to: searchParams.get("to"),
      }),
    [searchParams],
  );
  const dashboardQuery = useMemo<DashboardQueryParams>(
    () => ({
      brand: selectedBrand,
      from: dateRange.from,
      to: dateRange.to,
    }),
    [dateRange.from, dateRange.to, selectedBrand],
  );
  const replaceParams = useCallback(
    (update: (nextParams: URLSearchParams) => void) => {
      const nextParams = new URLSearchParams(searchParams.toString());

      update(nextParams);

      const query = nextParams.toString();

      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );
  const setSelectedBrand = useCallback(
    (brand: string | null) => {
      replaceParams((nextParams) => {
        const nextBrand = normalizeBrandParam(brand);

        if (nextBrand) {
          nextParams.set("brand", nextBrand);
        } else {
          nextParams.delete("brand");
        }
      });
    },
    [replaceParams],
  );
  const setDateRange = useCallback(
    (range: DashboardDateRange) => {
      replaceParams((nextParams) => {
        const nextRange = normalizeDateRange(range);

        if (nextRange.from && nextRange.to) {
          nextParams.set("from", nextRange.from);
          nextParams.set("to", nextRange.to);
        } else {
          nextParams.delete("from");
          nextParams.delete("to");
        }
      });
    },
    [replaceParams],
  );

  return {
    dashboardQuery,
    dateRange,
    selectedBrand,
    setDateRange,
    setSelectedBrand,
  };
}

function normalizeDateRange(range: DashboardDateRange): DashboardDateRange {
  const from = normalizeDateParam(range.from);
  const to = normalizeDateParam(range.to);

  if (!from || !to || from > to) {
    return getCurrentMonthDateRange();
  }

  return { from, to };
}

function normalizeDateParam(value: string | null | undefined): string | null {
  const normalized = value?.trim();

  if (!normalized || !DATE_PATTERN.test(normalized)) {
    return null;
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);

  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
    ? null
    : normalized;
}

function normalizeBrandParam(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ");

  if (
    !normalized ||
    normalized.toLowerCase() === "all" ||
    normalized.toLowerCase() === "all brands"
  ) {
    return null;
  }

  return normalized;
}
