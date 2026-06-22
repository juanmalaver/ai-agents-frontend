"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  CampaignHealthAdRow,
  CampaignHealthConfidence,
  CampaignHealthGrade,
  CampaignHealthMetric,
  CampaignHealthQualitySignal,
  CampaignHealthRecommendation,
  CampaignHealthRow,
  CampaignHealthStatus,
  CampaignMetaDeliveryStatus,
  CampaignMetaStatus,
  MarketingDashboardHealthResponse,
} from "@/src/types/campaignHealth";
import type { DashboardDateRange } from "@/src/types/dashboard";
import {
  formatCurrency,
  formatDashboardTimestamp,
  formatNumber,
  formatPercentage,
} from "@/src/utils/dashboardFormatters";
import { getCurrentMonthDateRange } from "@/src/utils/dateRangeDefaults";
import {
  appendHealthDashboardQueryParams,
  resolveHealthDashboardApiUrl,
} from "@/src/utils/runtimeApiUrls";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardTabs } from "./DashboardTabs";
import { DateRangeFilter } from "./DateRangeFilter";
import { LoadingSpinner } from "./LoadingSpinner";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ALL_GRADES: CampaignHealthGrade[] = [
  "A",
  "B",
  "C",
  "D",
  "F",
];
const ALL_META_STATUSES: Array<{
  id: CampaignMetaDeliveryStatus;
  label: CampaignMetaStatus["label"];
}> = [
  { id: "on", label: "On" },
  { id: "off", label: "Off" },
  { id: "unknown", label: "Unknown" },
];

interface HealthPageProps {
  apiUrl?: string;
}

interface SelectedAdReuse {
  key: string;
  label: string;
}

interface AdNamePlacement {
  ad: CampaignHealthAdRow;
  campaign: CampaignHealthRow;
}

export function HealthPage({ apiUrl }: HealthPageProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedBrands = useMemo(
    () =>
      normalizeBrands([
        ...searchParams.getAll("brands"),
        searchParams.get("brand") ?? "",
      ]),
    [searchParams],
  );
  const selectedBrandsKey = selectedBrands.join("\u0000");
  const dateRange = useMemo(
    () =>
      normalizeDateRange({
        from: searchParams.get("from"),
        to: searchParams.get("to"),
      }),
    [searchParams],
  );
  const [data, setData] = useState<MarketingDashboardHealthResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [selectedAdIds, setSelectedAdIds] = useState<string[]>([]);
  const [selectedGrades, setSelectedGrades] = useState<CampaignHealthGrade[]>(
    [],
  );
  const [selectedMetaStatuses, setSelectedMetaStatuses] = useState<
    CampaignMetaDeliveryStatus[]
  >([]);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [selectedAdReuse, setSelectedAdReuse] =
    useState<SelectedAdReuse | null>(null);
  const healthUrl = useMemo(
    () =>
      appendHealthDashboardQueryParams(resolveHealthDashboardApiUrl(apiUrl), {
        brands: selectedBrands,
        from: dateRange.from,
        to: dateRange.to,
      }),
    [apiUrl, dateRange.from, dateRange.to, selectedBrandsKey],
  );
  const tabQuery = useMemo(
    () => ({
      brand: selectedBrands.length === 1 ? selectedBrands[0] : null,
      from: dateRange.from,
      to: dateRange.to,
    }),
    [dateRange.from, dateRange.to, selectedBrands],
  );
  const brandOptions = useMemo(
    () =>
      (data?.filterOptions.brands ?? [])
        .map((brand) => brand.name?.trim())
        .filter((name): name is string => Boolean(name))
        .map((name) => ({ id: name, label: name })),
    [data],
  );
  const campaignOptions = data?.filterOptions.campaigns ?? [];
  const adOptions = data?.filterOptions.ads ?? [];
  const gradeOptions = (data?.filterOptions.grades ?? ALL_GRADES).map(
    (grade) => ({
      id: grade,
      label: grade,
    }),
  );
  const metaStatusOptions =
    data?.filterOptions.metaStatuses ?? ALL_META_STATUSES;
  const rowsBeforeGradeFilter = useMemo(
    () =>
      filterHealthRows(data?.campaignRows ?? [], {
        selectedAdIds,
        selectedCampaignIds,
        selectedGrades: [],
        selectedMetaStatuses,
      }),
    [data, selectedAdIds, selectedCampaignIds, selectedMetaStatuses],
  );
  const filteredRows = useMemo(
    () =>
      filterHealthRows(rowsBeforeGradeFilter, {
        selectedAdIds,
        selectedCampaignIds,
        selectedGrades,
        selectedMetaStatuses,
      }),
    [
      rowsBeforeGradeFilter,
      selectedAdIds,
      selectedCampaignIds,
      selectedGrades,
      selectedMetaStatuses,
    ],
  );
  const adNamePlacements = useMemo(
    () => buildAdNamePlacementMap(data?.campaignRows ?? []),
    [data],
  );
  const selectedAdReusePlacements = selectedAdReuse
    ? adNamePlacements.get(selectedAdReuse.key) ?? []
    : [];

  useEffect(() => {
    if (!healthUrl) {
      setData(null);
      setError("Dashboard API URL is not configured.");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    async function loadHealth() {
      try {
        const response = await fetch(healthUrl as string, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(await readResponseMessage(response));
        }

        const payload =
          (await response.json()) as MarketingDashboardHealthResponse;

        if (!controller.signal.aborted) {
          setData(payload);
        }
      } catch (caughtError) {
        if (!controller.signal.aborted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load campaign health.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadHealth();

    return () => controller.abort();
  }, [healthUrl]);

  useEffect(() => {
    pruneSelection(
      selectedCampaignIds,
      campaignOptions.map((option) => option.id),
      setSelectedCampaignIds,
    );
    pruneSelection(
      selectedAdIds,
      adOptions.map((option) => option.id),
      setSelectedAdIds,
    );
    pruneSelection(
      selectedGrades,
      (data?.filterOptions.grades ?? ALL_GRADES) as string[],
      (values) => setSelectedGrades(values as CampaignHealthGrade[]),
    );
    pruneSelection(
      selectedMetaStatuses,
      (data?.filterOptions.metaStatuses ?? ALL_META_STATUSES).map(
        (option) => option.id,
      ),
      (values) =>
        setSelectedMetaStatuses(values as CampaignMetaDeliveryStatus[]),
    );
  }, [
    adOptions,
    campaignOptions,
    data?.filterOptions.grades,
    data?.filterOptions.metaStatuses,
    selectedAdIds,
    selectedCampaignIds,
    selectedGrades,
    selectedMetaStatuses,
  ]);

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
  const handleBrandChange = useCallback(
    (brands: string[]) => {
      replaceParams((nextParams) => {
        nextParams.delete("brand");
        nextParams.delete("brands");

        for (const brand of brands) {
          nextParams.append("brands", brand);
        }
      });
      setSelectedCampaignIds([]);
      setSelectedAdIds([]);
      setSelectedGrades([]);
      setSelectedMetaStatuses([]);
      setSelectedAdReuse(null);
    },
    [replaceParams],
  );
  const handleDateRangeChange = useCallback(
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
      setSelectedCampaignIds([]);
      setSelectedAdIds([]);
      setSelectedGrades([]);
      setSelectedMetaStatuses([]);
      setSelectedAdReuse(null);
    },
    [replaceParams],
  );
  const toggleExpandedRow = useCallback((id: string) => {
    setExpandedRows((current) =>
      current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id],
    );
  }, []);
  const lastUpdated = data?.generatedAt
    ? formatDashboardTimestamp(data.generatedAt)
    : undefined;
  const isRefreshingHealth = isLoading && Boolean(data);
  const dependentFiltersDisabled = !data || isRefreshingHealth;
  const handleSummaryGradeToggle = useCallback(
    (grade: CampaignHealthGrade) => {
      setSelectedGrades((current) =>
        current.includes(grade)
          ? current.filter((currentGrade) => currentGrade !== grade)
          : [...current, grade],
      );
    },
    [],
  );
  const handleOpenAdReuse = useCallback((ad: CampaignHealthAdRow) => {
    const key = normalizeAdName(ad.adName);

    if (!key) {
      return;
    }

    setSelectedAdReuse({
      key,
      label: ad.adName,
    });
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f8fb] px-4 py-6 text-slate-950 md:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-5">
        <DashboardHeader
          lastUpdated={lastUpdated}
          subtitle="Campaign and ad audit across selected Meta brands, campaigns, and ads."
          title="Audit"
        />
        <DashboardTabs activeTab="health" query={tabQuery} />
        <section
          aria-label="Audit filters"
          className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
        >
          <div className="grid gap-3 xl:grid-cols-[minmax(14rem,1fr)_minmax(14rem,1fr)_minmax(14rem,1fr)_minmax(10rem,0.65fr)_minmax(10rem,0.65fr)]">
            <MultiSelectFilter
              disabled={isLoading && !data}
              label="Brands"
              loading={isRefreshingHealth}
              onChange={handleBrandChange}
              options={brandOptions}
              selectedIds={selectedBrands}
              summary={summarizeBrands(selectedBrands)}
            />
            <MultiSelectFilter
              disabled={dependentFiltersDisabled}
              label="Campaigns"
              loading={isRefreshingHealth}
              onChange={setSelectedCampaignIds}
              options={campaignOptions}
              selectedIds={selectedCampaignIds}
              summary={summarizeSelection(
                selectedCampaignIds,
                "All campaigns",
                "campaigns selected",
              )}
            />
            <MultiSelectFilter
              disabled={dependentFiltersDisabled}
              label="Ads"
              loading={isRefreshingHealth}
              onChange={setSelectedAdIds}
              options={adOptions}
              selectedIds={selectedAdIds}
              summary={summarizeSelection(
                selectedAdIds,
                "All ads",
                "ads selected",
              )}
            />
            <MultiSelectFilter
              disabled={dependentFiltersDisabled}
              label="Grades"
              loading={isRefreshingHealth}
              onChange={(values) =>
                setSelectedGrades(values as CampaignHealthGrade[])
              }
              options={gradeOptions}
              selectedIds={selectedGrades}
              summary={summarizeSelection(
                selectedGrades,
                "All grades",
                "grades selected",
              )}
              withSearch={false}
            />
            <MultiSelectFilter
              disabled={dependentFiltersDisabled}
              label="Meta status"
              loading={isRefreshingHealth}
              onChange={(values) =>
                setSelectedMetaStatuses(values as CampaignMetaDeliveryStatus[])
              }
              options={metaStatusOptions}
              selectedIds={selectedMetaStatuses}
              summary={summarizeSelection(
                selectedMetaStatuses,
                "All statuses",
                "statuses selected",
              )}
              withSearch={false}
            />
          </div>
          <div className="mt-3">
            <DateRangeFilter
              dateRange={dateRange}
              onDateRangeChange={handleDateRangeChange}
            />
          </div>
        </section>

        {isLoading && !data ? (
          <HealthLoadingPanel />
        ) : error ? (
          <HealthErrorPanel message={error} />
        ) : data ? (
          <>
            {isRefreshingHealth ? <HealthRefreshNotice /> : null}
            <RefreshingRegion isRefreshing={isRefreshingHealth}>
              <HealthSummary
                disabled={dependentFiltersDisabled}
                gradeCountRows={rowsBeforeGradeFilter}
                onClearGrades={() => setSelectedGrades([])}
                onToggleGrade={handleSummaryGradeToggle}
                rows={filteredRows}
                selectedGrades={selectedGrades}
                totalRows={rowsBeforeGradeFilter.length}
              />
            </RefreshingRegion>
            <RefreshingRegion isRefreshing={isRefreshingHealth}>
              <HealthTable
                adNamePlacements={adNamePlacements}
                expandedRows={expandedRows}
                isRefreshing={isRefreshingHealth}
                onOpenAdReuse={handleOpenAdReuse}
                onToggleExpandedRow={toggleExpandedRow}
                rampUpDays={data.thresholds.rampUp.minimumCampaignAgeDays}
                rows={filteredRows}
                selectedAdIds={selectedAdIds}
              />
            </RefreshingRegion>
            <RefreshingRegion isRefreshing={isRefreshingHealth}>
              <ThresholdsPanel data={data} />
            </RefreshingRegion>
            {selectedAdReuse ? (
              <AdReuseModal
                adName={selectedAdReuse.label}
                onClose={() => setSelectedAdReuse(null)}
                placements={selectedAdReusePlacements}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}

function MultiSelectFilter({
  disabled = false,
  label,
  loading = false,
  onChange,
  options,
  selectedIds,
  summary,
  withSearch = true,
}: {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onChange: (ids: string[]) => void;
  options: Array<{ id: string; label: string }>;
  selectedIds: string[];
  summary: string;
  withSearch?: boolean;
}) {
  const [search, setSearch] = useState("");
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return options;
    }

    return options.filter((option) =>
      option.label.toLowerCase().includes(normalizedSearch),
    );
  }, [options, search]);

  return (
    <fieldset className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <legend className="text-sm font-semibold text-slate-800">{label}</legend>
        <button
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-500 transition hover:border-teal-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled || selectedIds.length === 0}
          onClick={() => onChange([])}
          type="button"
        >
          Clear
        </button>
      </div>
      <p className="mb-2 truncate text-xs font-semibold text-teal-700">
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <LoadingSpinner
              className="h-3.5 w-3.5 text-teal-600"
              label={`Updating ${label.toLowerCase()}`}
            />
            Updating...
          </span>
        ) : (
          summary
        )}
      </p>
      {withSearch ? (
        <input
          className="mb-2 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-100"
          disabled={disabled}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`Search ${label.toLowerCase()}`}
          type="search"
          value={search}
        />
      ) : null}
      <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
        {visibleOptions.length > 0 ? (
          visibleOptions.map((option) => (
            <label
              className="flex min-h-8 cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 transition hover:bg-white"
              key={option.id}
            >
              <input
                checked={selectedSet.has(option.id)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                disabled={disabled}
                onChange={() => {
                  onChange(
                    selectedSet.has(option.id)
                      ? selectedIds.filter((id) => id !== option.id)
                      : [...selectedIds, option.id],
                  );
                }}
                type="checkbox"
              />
              <span className="min-w-0 break-words">{option.label}</span>
            </label>
          ))
        ) : (
          <div className="rounded-md bg-white px-2 py-3 text-sm font-medium text-slate-500">
            {loading ? "Updating options..." : "No options"}
          </div>
        )}
      </div>
    </fieldset>
  );
}

function HealthSummary({
  disabled,
  gradeCountRows,
  onClearGrades,
  onToggleGrade,
  rows,
  selectedGrades,
  totalRows,
}: {
  disabled: boolean;
  gradeCountRows: CampaignHealthRow[];
  onClearGrades: () => void;
  onToggleGrade: (grade: CampaignHealthGrade) => void;
  rows: CampaignHealthRow[];
  selectedGrades: CampaignHealthGrade[];
  totalRows: number;
}) {
  const counts = countGrades(gradeCountRows);
  const selectedGradeSet = new Set(selectedGrades);

  return (
    <section className="grid gap-3 md:grid-cols-6">
      <SummaryTile
        active={selectedGrades.length === 0}
        disabled={disabled}
        label="Visible"
        onClick={onClearGrades}
        value={`${rows.length}/${totalRows}`}
      />
      {ALL_GRADES.map((grade) => (
        <SummaryTile
          active={selectedGradeSet.has(grade)}
          disabled={
            disabled ||
            ((counts[grade] ?? 0) === 0 && !selectedGradeSet.has(grade))
          }
          key={grade}
          label={grade}
          onClick={() => onToggleGrade(grade)}
          value={String(counts[grade] ?? 0)}
        />
      ))}
    </section>
  );
}

function RefreshingRegion({
  children,
  isRefreshing,
}: {
  children: ReactNode;
  isRefreshing: boolean;
}) {
  return (
    <div
      aria-busy={isRefreshing}
      className={`relative transition ${isRefreshing ? "opacity-70" : ""}`}
    >
      {children}
      {isRefreshing ? (
        <div className="pointer-events-none absolute inset-0 flex items-start justify-end rounded-lg bg-white/45 p-3">
          <div className="inline-flex items-center gap-2 rounded-md border border-teal-100 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 shadow-sm">
            <LoadingSpinner
              className="h-3.5 w-3.5 text-teal-600"
              label="Updating section"
            />
            Updating
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryTile({
  active = false,
  disabled = false,
  label,
  onClick,
  value,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick?: () => void;
  value: string;
}) {
  const isInteractive = Boolean(onClick);

  return (
    <button
      aria-pressed={isInteractive ? active : undefined}
      className={`rounded-lg border bg-white p-3 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${
        active
          ? "border-teal-300 ring-1 ring-teal-200"
          : "border-slate-200 hover:border-teal-300 hover:shadow-md"
      } ${disabled ? "cursor-not-allowed opacity-50 hover:border-slate-200 hover:shadow-sm" : ""}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
    </button>
  );
}

function HealthTable({
  adNamePlacements,
  expandedRows,
  isRefreshing,
  onOpenAdReuse,
  onToggleExpandedRow,
  rampUpDays,
  rows,
  selectedAdIds,
}: {
  adNamePlacements: Map<string, AdNamePlacement[]>;
  expandedRows: string[];
  isRefreshing: boolean;
  onOpenAdReuse: (ad: CampaignHealthAdRow) => void;
  onToggleExpandedRow: (id: string) => void;
  rampUpDays: number;
  rows: CampaignHealthRow[];
  selectedAdIds: string[];
}) {
  const expandedSet = new Set(expandedRows);
  const selectedAdSet = new Set(selectedAdIds);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">
          Campaign health
        </h2>
      </div>
      <div className="overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[4%]" />
            <col className="w-[11%]" />
            <col className="w-[14%]" />
            <col className="w-[7%]" />
            <col className="w-[5%]" />
            <col className="w-[7%]" />
            <col className="w-[9%]" />
            <col className="w-[7%]" />
            <col className="w-[5%]" />
            <col className="w-[4%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-12 px-4 py-3" />
              <th className="px-4 py-3">Brand</th>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Meta</th>
              <th className="px-4 py-3">Grade</th>
              <th className="px-4 py-3">Confidence</th>
              <th className="px-4 py-3">Recommendation</th>
              <th className="px-4 py-3 text-right">Spend</th>
              <th className="px-4 py-3 text-right">Leads</th>
              <th className="px-4 py-3 text-right">SL</th>
              <th className="px-4 py-3">CPSL</th>
              <th className="px-4 py-3">Volume</th>
              <th className="px-4 py-3">Quality</th>
              <th className="px-4 py-3">Int. Conv.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length > 0 ? (
              rows.map((row) => {
                const autoExpanded =
                  selectedAdSet.size > 0 &&
                  row.ads.some((ad) => selectedAdSet.has(toAdFilterId(row, ad)));
                const isExpanded = expandedSet.has(row.id) || autoExpanded;

                return (
                  <HealthTableRow
                    adNamePlacements={adNamePlacements}
                    isExpanded={isExpanded}
                    isRefreshing={isRefreshing}
                    key={row.id}
                    onOpenAdReuse={onOpenAdReuse}
                    onToggleExpandedRow={onToggleExpandedRow}
                    rampUpDays={rampUpDays}
                    row={row}
                    selectedAdIds={selectedAdSet}
                  />
                );
              })
            ) : (
              <tr>
                <td className="px-4 py-10 text-center text-slate-500" colSpan={14}>
                  No campaigns match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HealthTableRow({
  adNamePlacements,
  isExpanded,
  isRefreshing,
  onOpenAdReuse,
  onToggleExpandedRow,
  rampUpDays,
  row,
  selectedAdIds,
}: {
  adNamePlacements: Map<string, AdNamePlacement[]>;
  isExpanded: boolean;
  isRefreshing: boolean;
  onOpenAdReuse: (ad: CampaignHealthAdRow) => void;
  onToggleExpandedRow: (id: string) => void;
  rampUpDays: number;
  row: CampaignHealthRow;
  selectedAdIds: Set<string>;
}) {
  return (
    <>
      <tr className="align-top transition hover:bg-slate-50">
        <td className="px-4 py-3">
          <button
            aria-expanded={isExpanded}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-sm font-bold text-slate-600 transition hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onToggleExpandedRow(row.id)}
            disabled={isRefreshing}
            title={isExpanded ? "Hide ads" : "Show ads"}
            type="button"
          >
            {isExpanded ? "−" : "+"}
          </button>
        </td>
        <td className="break-words px-4 py-3 font-medium text-slate-900">
          {row.brand}
        </td>
        <td className="break-words px-4 py-3">
          <div className="font-semibold text-slate-950">{row.campaignName}</div>
          <div className="mt-1 text-xs text-slate-500">
            {row.campaignId ?? "CRM-only campaign"}
          </div>
          {row.isRampUp ? (
            <div className="mt-2 inline-flex rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800">
              Ramp-up day {formatNumber(row.campaignAgeDays)} of{" "}
              {formatNumber(rampUpDays)}
            </div>
          ) : null}
        </td>
        <td className="px-4 py-3">
          <MetaStatusChip status={getRowMetaStatus(row)} />
        </td>
        <td className="px-4 py-3">
          <GradeChip grade={row.grade} />
        </td>
        <td className="px-4 py-3">
          <ConfidenceChip confidence={row.confidence} />
        </td>
        <td className="break-words px-4 py-3">
          <RecommendationChip recommendation={row.recommendation} />
        </td>
        <td className="px-4 py-3 text-right font-semibold text-slate-950">
          {formatCurrency(row.spend)}
        </td>
        <td className="px-4 py-3 text-right">{formatNumber(row.leads)}</td>
        <td className="px-4 py-3 text-right">{formatNumber(row.signedLeads)}</td>
        <td className="px-4 py-3">
          <MetricChip metric={row.metricHealth.cpsl} variant="currency" />
        </td>
        <td className="px-4 py-3">
          <MetricChip metric={row.metricHealth.volume} variant="currency" />
        </td>
        <td className="px-4 py-3">
          <MetricChip metric={row.metricHealth.quality} variant="percentage" />
        </td>
        <td className="px-4 py-3">
          <MetricChip metric={row.metricHealth.intake} variant="percentage" />
        </td>
      </tr>
      {isExpanded ? (
        <tr className="bg-slate-50/70">
          <td className="px-4 py-3" />
          <td className="px-4 py-3" colSpan={13}>
            <div className="space-y-3">
              <QualitySignalsPanel signals={row.qualitySignals} />
              <AdDetailTable
                adNamePlacements={adNamePlacements}
                ads={row.ads}
                campaign={row}
                onOpenAdReuse={onOpenAdReuse}
                selectedAdIds={selectedAdIds}
              />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function QualitySignalsPanel({
  signals,
}: {
  signals: CampaignHealthRow["qualitySignals"];
}) {
  const orderedSignals = [
    signals.noAccident,
    signals.callNotAnswered,
    signals.previousAttorney,
    signals.oldAccident,
    signals.speedToLead,
  ];

  return (
    <div className="grid gap-2 md:grid-cols-5">
      {orderedSignals.map((signal) => (
        <div
          className={`rounded-md border px-3 py-2 ${healthStatusClasses[signal.status]}`}
          key={signal.label}
          title={signal.reason}
        >
          <div className="text-xs font-semibold uppercase tracking-wide opacity-80">
            {signal.label}
          </div>
          <div className="mt-1 text-sm font-bold">
            {formatQualitySignalValue(signal)}
          </div>
          <div className="mt-1 text-xs font-medium opacity-80">
            {formatQualitySignalCount(signal)}
          </div>
        </div>
      ))}
    </div>
  );
}

function AdDetailTable({
  adNamePlacements,
  ads,
  campaign,
  onOpenAdReuse,
  selectedAdIds,
}: {
  adNamePlacements: Map<string, AdNamePlacement[]>;
  ads: CampaignHealthAdRow[];
  campaign: CampaignHealthRow;
  onOpenAdReuse: (ad: CampaignHealthAdRow) => void;
  selectedAdIds: Set<string>;
}) {
  const visibleAds =
    selectedAdIds.size > 0
      ? ads.filter((ad) => selectedAdIds.has(toAdFilterId(campaign, ad)))
      : ads;

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[19%]" />
          <col className="w-[7%]" />
          <col className="w-[8%]" />
          <col className="w-[13%]" />
          <col className="w-[9%]" />
          <col className="w-[8%]" />
          <col className="w-[7%]" />
          <col className="w-[9%]" />
          <col className="w-[9%]" />
          <col className="w-[14%]" />
        </colgroup>
        <thead className="bg-white text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left">Ad</th>
            <th className="px-3 py-2 text-left">Grade</th>
            <th className="px-3 py-2 text-left">Meta</th>
            <th className="px-3 py-2 text-left">Ad ID</th>
            <th className="px-3 py-2 text-right">Spend</th>
            <th className="px-3 py-2 text-right">Leads</th>
            <th className="px-3 py-2 text-right">SL</th>
            <th className="px-3 py-2 text-right">CPL</th>
            <th className="px-3 py-2 text-right">CPSL</th>
            <th className="px-3 py-2 text-right">Meta leads</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {visibleAds.map((ad) => {
            const placementCount = getAdNamePlacementCount(
              adNamePlacements,
              ad,
            );
            const isClickable = Boolean(normalizeAdName(ad.adName));

            return (
              <tr key={ad.id}>
                <td className="break-words px-3 py-2 font-medium text-slate-900">
                  {isClickable ? (
                    <button
                      className="text-left font-semibold text-teal-700 underline decoration-teal-200 underline-offset-2 transition hover:text-teal-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                      onClick={() => onOpenAdReuse(ad)}
                      type="button"
                    >
                      {ad.adName}
                    </button>
                  ) : (
                    ad.adName
                  )}
                  {placementCount > 1 ? (
                    <div className="mt-1 text-xs font-medium text-slate-500">
                      {formatNumber(placementCount)} placements
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2" title={formatAdGradeTitle(ad)}>
                  <GradeChip grade={ad.grade} />
                </td>
                <td className="px-3 py-2">
                  <MetaStatusChip status={getAdMetaStatus(ad)} />
                </td>
                <td className="break-words px-3 py-2 text-slate-500">
                  {ad.adId ?? "-"}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(ad.spend)}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatNumber(ad.leads)}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatNumber(ad.signedLeads)}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(ad.cpl)}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(ad.cpsl)}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatNumber(ad.metaLeadActions)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AdReuseModal({
  adName,
  onClose,
  placements,
}: {
  adName: string;
  onClose: () => void;
  placements: AdNamePlacement[];
}) {
  const totals = placements.reduce(
    (sum, placement) => ({
      leads: sum.leads + placement.ad.leads,
      metaLeadActions:
        sum.metaLeadActions + (placement.ad.metaLeadActions ?? 0),
      signedLeads: sum.signedLeads + placement.ad.signedLeads,
      spend: sum.spend + placement.ad.spend,
    }),
    {
      leads: 0,
      metaLeadActions: 0,
      signedLeads: 0,
      spend: 0,
    },
  );

  return (
    <div
      aria-labelledby="ad-reuse-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6"
      role="dialog"
    >
      <div className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ad name reuse
            </p>
            <h2
              className="mt-1 break-words text-xl font-bold text-slate-950"
              id="ad-reuse-modal-title"
            >
              {adName}
            </h2>
          </div>
          <button
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
        <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 sm:grid-cols-4">
          <AdReuseSummaryItem label="Placements" value={formatNumber(placements.length)} />
          <AdReuseSummaryItem label="Spend" value={formatCurrency(totals.spend)} />
          <AdReuseSummaryItem label="Leads" value={formatNumber(totals.leads)} />
          <AdReuseSummaryItem label="SL" value={formatNumber(totals.signedLeads)} />
        </div>
        <div className="overflow-auto">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[20%]" />
              <col className="w-[7%]" />
              <col className="w-[8%]" />
              <col className="w-[14%]" />
              <col className="w-[9%]" />
              <col className="w-[7%]" />
              <col className="w-[6%]" />
              <col className="w-[8%]" />
              <col className="w-[9%]" />
            </colgroup>
            <thead className="bg-white text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3">Meta</th>
                <th className="px-4 py-3">Ad ID</th>
                <th className="px-4 py-3 text-right">Spend</th>
                <th className="px-4 py-3 text-right">Leads</th>
                <th className="px-4 py-3 text-right">SL</th>
                <th className="px-4 py-3 text-right">CPL</th>
                <th className="px-4 py-3 text-right">CPSL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {placements.map((placement) => (
                <tr key={`${placement.campaign.id}::${placement.ad.id}`}>
                  <td className="break-words px-4 py-3 font-medium text-slate-900">
                    {placement.campaign.brand}
                  </td>
                  <td className="break-words px-4 py-3">
                    <div className="font-semibold text-slate-950">
                      {placement.campaign.campaignName}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {placement.campaign.campaignId ?? "CRM-only campaign"}
                    </div>
                  </td>
                  <td
                    className="px-4 py-3"
                    title={formatAdGradeTitle(placement.ad)}
                  >
                    <GradeChip grade={placement.ad.grade} />
                  </td>
                  <td className="px-4 py-3">
                    <MetaStatusChip status={getAdMetaStatus(placement.ad)} />
                  </td>
                  <td className="break-words px-4 py-3 text-slate-500">
                    {placement.ad.adId ?? "No ad ID"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(placement.ad.spend)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatNumber(placement.ad.leads)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatNumber(placement.ad.signedLeads)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(placement.ad.cpl)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(placement.ad.cpsl)}
                  </td>
                </tr>
              ))}
              {placements.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-10 text-center text-slate-500"
                    colSpan={10}
                  >
                    No matching ad names in the current health data.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdReuseSummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-slate-950">{value}</div>
    </div>
  );
}

function MetricChip({
  metric,
  variant,
}: {
  metric: CampaignHealthMetric;
  variant: "currency" | "percentage";
}) {
  const value =
    variant === "currency"
      ? formatCurrency(metric.value)
      : formatPercentage(metric.value);

  return (
    <span
      className={`inline-flex w-full max-w-28 flex-col rounded-md border px-2 py-1 text-xs font-semibold ${healthStatusClasses[metric.status]}`}
      title={metric.reason}
    >
      <span>{value}</span>
      <span className="font-medium opacity-80">
        {healthStatusLabels[metric.status]}
      </span>
    </span>
  );
}

function formatQualitySignalValue(signal: CampaignHealthQualitySignal): string {
  if (signal.label === "Speed to lead" && signal.value != null) {
    return `${formatNumber(signal.value)} min`;
  }

  return formatPercentage(signal.value);
}

function formatQualitySignalCount(signal: CampaignHealthQualitySignal): string {
  if (signal.count == null || signal.denominator == null) {
    return healthStatusLabels[signal.status];
  }

  return `${formatNumber(signal.count)} of ${formatNumber(
    signal.denominator,
  )} leads`;
}

function formatAdGradeTitle(ad: CampaignHealthAdRow): string {
  const metrics = [
    ad.metricHealth.attribution,
    ad.metricHealth.cpsl,
    ad.metricHealth.volume,
    ad.metricHealth.intake,
  ];
  const metricSummary = metrics
    .map((metric) => `${metric.label}: ${healthStatusLabels[metric.status]}`)
    .join("; ");

  return `${ad.recommendation}. ${ad.confidence} confidence. ${metricSummary}`;
}

function MetaStatusChip({ status }: { status: CampaignMetaStatus }) {
  const rawStatus = [status.effectiveStatus, status.configuredStatus]
    .filter(Boolean)
    .join(" / ");

  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${metaStatusClasses[status.id]}`}
      title={
        rawStatus
          ? `Meta effective/configured status: ${rawStatus}`
          : "Meta campaign status is unavailable."
      }
    >
      {status.label}
    </span>
  );
}

function GradeChip({ grade }: { grade: CampaignHealthGrade }) {
  return (
    <span
      className={`inline-flex h-9 min-w-12 items-center justify-center rounded-md border px-3 text-sm font-bold ${gradeClasses[grade]}`}
    >
      {grade}
    </span>
  );
}

function ConfidenceChip({ confidence }: { confidence: CampaignHealthConfidence }) {
  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${confidenceClasses[confidence]}`}
    >
      {confidence}
    </span>
  );
}

function RecommendationChip({
  recommendation,
}: {
  recommendation: CampaignHealthRecommendation;
}) {
  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${recommendationClasses[recommendation]}`}
    >
      {recommendation}
    </span>
  );
}

function ThresholdsPanel({ data }: { data: MarketingDashboardHealthResponse }) {
  const thresholds = data.thresholds;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">
        Health formulas
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Campaign grades use CPSL, volume, quality, and Int. Conv. Ad grades use
        CPSL, volume, Int. Conv., and attribution quality; source-backed
        quality stays at campaign level until it can be reliably tied to ad IDs.
      </p>
      <div className="mt-3 overflow-hidden">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[12%]" />
            <col className="w-[22%]" />
            <col className="w-[13%]" />
            <col className="w-[22%]" />
            <col className="w-[13%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Metric</th>
              <th className="px-3 py-2">Formula</th>
              <th className="px-3 py-2">Green</th>
              <th className="px-3 py-2">Yellow</th>
              <th className="px-3 py-2">Red</th>
              <th className="px-3 py-2">Not scored</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <ThresholdRow
              formula="Spend / Signed Leads"
              green={`< ${formatCurrency(thresholds.cpsl.greenMaxExclusive)}`}
              metric="CPSL"
              neutral={`0 signed leads and spend < ${formatCurrency(
                thresholds.cpsl.zeroSignedLeadYellowSpendMin,
              )}`}
              red={`>= ${formatCurrency(thresholds.cpsl.redMin)}`}
              yellow={`${formatCurrency(
                thresholds.cpsl.greenMaxExclusive,
              )} - ${formatCurrency(
                thresholds.cpsl.redMin - 1,
              )}; or 0 signed leads and spend ${formatCurrency(
                thresholds.cpsl.zeroSignedLeadYellowSpendMin,
              )} - ${formatCurrency(
                thresholds.cpsl.zeroSignedLeadRedSpendMin - 1,
              )}`}
            />
            <ThresholdRow
              formula="Spend / Leads"
              green={`<= ${formatCurrency(thresholds.volume.greenMax)}`}
              metric="Volume"
              neutral={`0 leads and spend < ${formatCurrency(
                thresholds.volume.zeroLeadYellowSpendMin,
              )}`}
              red={`> ${formatCurrency(thresholds.volume.redMinExclusive)}`}
              yellow={`${formatCurrency(
                thresholds.volume.greenMax + 1,
              )} - ${formatCurrency(
                thresholds.volume.redMinExclusive,
              )}; or 0 leads and spend ${formatCurrency(
                thresholds.volume.zeroLeadYellowSpendMin,
              )} - ${formatCurrency(
                thresholds.volume.zeroLeadRedSpendMin - 1,
              )}`}
            />
            <ThresholdRow
              formula="No-accident signals / leads; CNA can downgrade quality"
              green={`< ${formatPercentage(
                thresholds.quality.greenMax,
              )}; CNA <= ${formatPercentage(
                thresholds.quality.callNotAnsweredGreenMax,
              )}`}
              metric="Quality"
              neutral={`Fewer than ${formatNumber(
                thresholds.quality.minimumLeads,
              )} leads`}
              red={`> ${formatPercentage(
                thresholds.quality.yellowMax,
              )}; or 20-25% plus CNA > ${formatPercentage(
                thresholds.quality.callNotAnsweredGreenMax,
              )}`}
              yellow={`${formatPercentage(
                thresholds.quality.greenMax,
              )} - ${formatPercentage(
                thresholds.quality.yellowMax,
              )}; or healthy primary with CNA > ${formatPercentage(
                thresholds.quality.callNotAnsweredGreenMax,
              )}`}
            />
            <ThresholdRow
              formula="CRM Leads / Meta Lead Actions"
              green={`>= ${formatPercentage(thresholds.intake.greenMin)}`}
              metric="Int. Conv."
              neutral={`Meta lead actions missing or fewer than ${formatNumber(
                thresholds.intake.minimumMetaLeadActions,
              )}`}
              red={`< ${formatPercentage(thresholds.intake.yellowMin)}`}
              yellow={`${formatPercentage(
                thresholds.intake.yellowMin,
              )} - ${formatPercentage(thresholds.intake.greenMin)}`}
            />
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs font-medium text-slate-500">
        Campaigns inside the first{" "}
        {formatNumber(thresholds.rampUp.minimumCampaignAgeDays)} days are in
        ramp-up: no-lead and no-signed-lead failures are not scored yet.
        Quality sources are exact CRM substatus/stage values, Turndown Reason,
        Date of Accident, and structured attorney answers. Previous attorney and
        old-accident signals are shown as quality context. Speed-to-lead needs
        call-log data before it can be scored.
      </p>
    </section>
  );
}

function ThresholdRow({
  formula,
  green,
  metric,
  neutral,
  red,
  yellow,
}: {
  formula: string;
  green: string;
  metric: string;
  neutral: string;
  red: string;
  yellow: string;
}) {
  return (
    <tr>
      <td className="px-3 py-2 font-semibold text-slate-900">{metric}</td>
      <td className="break-words px-3 py-2 text-slate-600">{formula}</td>
      <td className="break-words px-3 py-2 text-teal-700">{green}</td>
      <td className="break-words px-3 py-2 text-amber-700">{yellow}</td>
      <td className="break-words px-3 py-2 text-rose-700">{red}</td>
      <td className="break-words px-3 py-2 text-slate-600">{neutral}</td>
    </tr>
  );
}

function HealthLoadingPanel() {
  return (
    <section className="flex min-h-80 items-center justify-center rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <LoadingSpinner className="h-6 w-6 text-teal-600" label="Loading audit" />
      <span className="ml-3 text-sm font-semibold text-slate-600">
        Loading campaign audit...
      </span>
    </section>
  );
}

function HealthRefreshNotice() {
  return (
    <section className="flex items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800 shadow-sm">
      <LoadingSpinner
        className="h-4 w-4 text-teal-700"
        label="Updating audit view"
      />
      Updating audit data for the selected filters...
    </section>
  );
}

function HealthErrorPanel({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
      {message}
    </section>
  );
}

const healthStatusClasses: Record<CampaignHealthStatus, string> = {
  green: "border-teal-200 bg-teal-50 text-teal-800",
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
  red: "border-rose-200 bg-rose-50 text-rose-800",
  yellow: "border-amber-200 bg-amber-50 text-amber-800",
};

const healthStatusLabels: Record<CampaignHealthStatus, string> = {
  green: "Green",
  neutral: "Not scored",
  red: "Red",
  yellow: "Yellow",
};

const gradeClasses: Record<CampaignHealthGrade, string> = {
  A: "border-teal-200 bg-teal-50 text-teal-800",
  B: "border-sky-200 bg-sky-50 text-sky-800",
  C: "border-amber-200 bg-amber-50 text-amber-800",
  D: "border-orange-200 bg-orange-50 text-orange-800",
  F: "border-rose-200 bg-rose-50 text-rose-800",
};

const confidenceClasses: Record<CampaignHealthConfidence, string> = {
  High: "border-teal-200 bg-teal-50 text-teal-800",
  Learning: "border-slate-200 bg-slate-50 text-slate-600",
  Limited: "border-orange-200 bg-orange-50 text-orange-800",
  Medium: "border-sky-200 bg-sky-50 text-sky-800",
};

const recommendationClasses: Record<CampaignHealthRecommendation, string> = {
  "Fix tracking": "border-violet-200 bg-violet-50 text-violet-800",
  Investigate: "border-orange-200 bg-orange-50 text-orange-800",
  Learning: "border-slate-200 bg-slate-50 text-slate-600",
  Monitor: "border-amber-200 bg-amber-50 text-amber-800",
  "Pause candidate": "border-rose-200 bg-rose-50 text-rose-800",
  Working: "border-teal-200 bg-teal-50 text-teal-800",
};

const metaStatusClasses: Record<CampaignMetaDeliveryStatus, string> = {
  off: "border-slate-300 bg-slate-100 text-slate-700",
  on: "border-teal-200 bg-teal-50 text-teal-800",
  unknown: "border-amber-200 bg-amber-50 text-amber-800",
};

function filterHealthRows(
  rows: CampaignHealthRow[],
  filters: {
    selectedAdIds: string[];
    selectedCampaignIds: string[];
    selectedGrades: CampaignHealthGrade[];
    selectedMetaStatuses: CampaignMetaDeliveryStatus[];
  },
): CampaignHealthRow[] {
  const selectedCampaignIds = new Set(filters.selectedCampaignIds);
  const selectedAdIds = new Set(filters.selectedAdIds);
  const selectedGrades = new Set(filters.selectedGrades);
  const selectedMetaStatuses = new Set(filters.selectedMetaStatuses);

  return rows.filter((row) => {
    if (selectedCampaignIds.size > 0 && !selectedCampaignIds.has(row.id)) {
      return false;
    }

    if (
      selectedMetaStatuses.size > 0 &&
      !selectedMetaStatuses.has(getRowMetaStatus(row).id)
    ) {
      return false;
    }

    if (selectedGrades.size > 0 && !selectedGrades.has(row.grade)) {
      return false;
    }

    if (
      selectedAdIds.size > 0 &&
      !row.ads.some((ad) => selectedAdIds.has(toAdFilterId(row, ad)))
    ) {
      return false;
    }

    return true;
  });
}

function toAdFilterId(row: CampaignHealthRow, ad: CampaignHealthAdRow): string {
  return `${row.id}::${ad.id}`;
}

function buildAdNamePlacementMap(
  rows: CampaignHealthRow[],
): Map<string, AdNamePlacement[]> {
  const placements = new Map<string, AdNamePlacement[]>();

  for (const campaign of rows) {
    for (const ad of campaign.ads) {
      const key = normalizeAdName(ad.adName);

      if (!key) {
        continue;
      }

      const current = placements.get(key) ?? [];

      current.push({ ad, campaign });
      placements.set(key, current);
    }
  }

  for (const current of placements.values()) {
    current.sort(
      (first, second) =>
        first.campaign.brand.localeCompare(second.campaign.brand) ||
        first.campaign.campaignName.localeCompare(
          second.campaign.campaignName,
        ) ||
        (second.ad.spend - first.ad.spend) ||
        first.ad.id.localeCompare(second.ad.id),
    );
  }

  return placements;
}

function getAdNamePlacementCount(
  placements: Map<string, AdNamePlacement[]>,
  ad: CampaignHealthAdRow,
): number {
  return placements.get(normalizeAdName(ad.adName))?.length ?? 0;
}

function normalizeAdName(value: string | null | undefined): string {
  const normalized = value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";

  return normalized === "unattributed" ? "" : normalized;
}

function getRowMetaStatus(row: CampaignHealthRow): CampaignMetaStatus {
  return (
    row.metaStatus ?? {
      configuredStatus: null,
      effectiveStatus: null,
      id: "unknown",
      label: "Unknown",
    }
  );
}

function getAdMetaStatus(ad: CampaignHealthAdRow): CampaignMetaStatus {
  return (
    ad.metaStatus ?? {
      configuredStatus: null,
      effectiveStatus: null,
      id: "unknown",
      label: "Unknown",
    }
  );
}

function countGrades(rows: CampaignHealthRow[]) {
  return rows.reduce(
    (counts, row) => {
      counts[row.grade] = (counts[row.grade] ?? 0) + 1;

      return counts;
    },
    {} as Partial<Record<CampaignHealthGrade, number>>,
  );
}

function summarizeBrands(selectedBrands: string[]): string {
  if (selectedBrands.length === 0) {
    return "All brands";
  }

  if (selectedBrands.length === 1) {
    return selectedBrands[0];
  }

  return `${selectedBrands.length} brands selected`;
}

function summarizeSelection(
  selectedIds: string[],
  emptyLabel: string,
  selectedLabel: string,
): string {
  if (selectedIds.length === 0) {
    return emptyLabel;
  }

  if (selectedIds.length === 1) {
    return "1 selected";
  }

  return `${selectedIds.length} ${selectedLabel}`;
}

function pruneSelection(
  selectedIds: string[],
  allowedIds: string[],
  onChange: (ids: string[]) => void,
): void {
  if (selectedIds.length === 0) {
    return;
  }

  const allowed = new Set(allowedIds);
  const nextIds = selectedIds.filter((id) => allowed.has(id));

  if (nextIds.length !== selectedIds.length) {
    onChange(nextIds);
  }
}

function normalizeBrands(values: string[]): string[] {
  const normalized = new Map<string, string>();

  for (const value of values) {
    const brand = normalizeBrandParam(value);

    if (brand) {
      normalized.set(brand.toLowerCase(), brand);
    }
  }

  return Array.from(normalized.values());
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

async function readResponseMessage(response: Response): Promise<string> {
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
    return `Unable to load campaign health (${response.status}).`;
  }

  return `Unable to load campaign health (${response.status}).`;
}
