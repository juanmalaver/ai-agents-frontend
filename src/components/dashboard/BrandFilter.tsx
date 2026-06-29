"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  DashboardDateRange,
  MarketingDashboardBrand,
} from "@/src/types/dashboard";
import {
  appendDashboardQueryParams,
  resolveDashboardBrandsApiUrl,
} from "@/src/utils/runtimeApiUrls";
import { LoadingSpinner } from "./LoadingSpinner";

interface BrandFilterProps {
  apiUrl?: string;
  dateRange: DashboardDateRange;
  onBrandChange: (brand: string | null) => void;
  selectedBrand: string | null;
}

export function BrandFilter({
  apiUrl,
  dateRange,
  onBrandChange,
  selectedBrand,
}: BrandFilterProps) {
  const [brands, setBrands] = useState<MarketingDashboardBrand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedBrands, setHasLoadedBrands] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const brandsUrl = useMemo(
    () =>
      appendDashboardQueryParams(resolveDashboardBrandsApiUrl(apiUrl), {
        brand: null,
        from: dateRange.from,
        to: dateRange.to,
      }),
    [apiUrl, dateRange.from, dateRange.to],
  );
  const namedBrands = useMemo(
    () => brands.filter((brand) => Boolean(brand.name?.trim())),
    [brands],
  );
  const hasSelectedBrand =
    Boolean(selectedBrand) &&
    namedBrands.some((brand) => brand.name?.trim() === selectedBrand);

  useEffect(() => {
    if (!brandsUrl) {
      setBrands([]);
      setError("Dashboard brands API URL is not configured.");
      setHasLoadedBrands(true);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    setIsLoading(true);
    setError(null);
    setHasLoadedBrands(false);

    async function loadBrands() {
      try {
        const response = await fetch(brandsUrl as string, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to load brands.");
        }

        const payload = (await response.json()) as MarketingDashboardBrand[];

        if (!controller.signal.aborted) {
          setBrands(Array.isArray(payload) ? payload : []);
          setHasLoadedBrands(true);
        }
      } catch (caughtError) {
        if (!controller.signal.aborted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load brands.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadBrands();

    return () => controller.abort();
  }, [brandsUrl]);

  useEffect(() => {
    if (hasLoadedBrands && !error && selectedBrand && !hasSelectedBrand) {
      setError("Selected brand has no usable data. Showing all brands.");
      onBrandChange(null);
    }
  }, [error, hasLoadedBrands, hasSelectedBrand, onBrandChange, selectedBrand]);

  return (
    <div className="min-w-0">
      <label
        className="mb-1 block text-sm font-semibold text-slate-700"
        htmlFor="marketing-dashboard-brand"
      >
        Brand
      </label>
      <select
        className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
        disabled={isLoading && namedBrands.length === 0}
        id="marketing-dashboard-brand"
        onChange={(event) => onBrandChange(event.target.value || null)}
        value={selectedBrand ?? ""}
      >
        <option value="">All brands</option>
        {selectedBrand && !hasSelectedBrand ? (
          <option value={selectedBrand}>{selectedBrand}</option>
        ) : null}
        {namedBrands.map((brand) => (
          <option key={brand.id} value={brand.name ?? ""}>
            {brand.name}
          </option>
        ))}
      </select>
      {error ? (
        <p className="mt-1 text-xs font-medium text-rose-700">{error}</p>
      ) : isLoading ? (
        <p className="mt-1 flex items-center gap-2 text-xs font-medium text-slate-500">
          <LoadingSpinner
            className="h-3.5 w-3.5 text-teal-600"
            label="Loading brands"
          />
          Loading brands...
        </p>
      ) : null}
    </div>
  );
}
