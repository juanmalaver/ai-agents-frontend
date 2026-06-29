"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingFn,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import type {
  CampaignHealthAdMedia,
  CampaignHealthAdRow,
  CampaignHealthConfidence,
  CampaignHealthGrade,
  CampaignHealthMetric,
  CampaignHealthQualitySignal,
  CampaignHealthRecommendation,
  CampaignHealthRow,
  CampaignHealthStatus,
  CampaignPlatform,
  HealthDashboardPlatform,
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
  resolveDashboardAdMediaApiUrl,
  resolveHealthDashboardApiUrl,
} from "@/src/utils/runtimeApiUrls";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardTabs } from "./DashboardTabs";
import { DateRangeFilter } from "./DateRangeFilter";
import { LoadingSpinner } from "./LoadingSpinner";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ALL_GRADES: CampaignHealthGrade[] = ["A", "B", "C", "D", "F"];
const ALL_RECOMMENDATIONS: Array<{
  id: CampaignHealthRecommendation;
  label: string;
}> = [
  {
    id: "WINNER / REPLICATE / SCALE REVIEW",
    label: "Winner / Scale",
  },
  {
    id: "KEEP / WATCH",
    label: "Keep / Watch",
  },
  {
    id: "WATCH / DIAGNOSE",
    label: "Watch / Diagnose",
  },
  {
    id: "REDUCE / REBUILD REVIEW",
    label: "Reduce / Rebuild",
  },
  {
    id: "PAUSE / SHUTDOWN REVIEW",
    label: "Pause / Shutdown",
  },
];
const ALL_META_STATUSES: Array<{
  id: CampaignMetaDeliveryStatus;
  label: CampaignMetaStatus["label"];
}> = [
  { id: "on", label: "On" },
  { id: "off", label: "Off" },
  { id: "unknown", label: "Unknown" },
];
const ALL_PLATFORM_OPTIONS: Array<{
  id: CampaignPlatform;
  label: string;
}> = [
  { id: "meta", label: "Meta" },
  { id: "tiktok", label: "TikTok" },
];
const MAX_META_CREATIVE_FALLBACK_TARGETS = 3;

interface HealthPageProps {
  apiUrl?: string;
}

interface SelectedAdReuse {
  label: string;
  mediaPlacements: AdNamePlacement[];
  placements: AdNamePlacement[];
}

interface AdNamePlacement {
  ad: CampaignHealthAdRow;
  campaign: CampaignHealthRow;
}

interface AdMediaTarget {
  adId: string;
  campaignLabel: string;
  platform: CampaignPlatform;
}

interface AdMediaState {
  error: string | null;
  isLoading: boolean;
  media: CampaignHealthAdMedia | null;
}

interface AdMediaSelection {
  state: AdMediaState;
  target: AdMediaTarget;
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
  const selectedPlatform = useMemo(
    () => normalizePlatformParam(searchParams.get("platform")),
    [searchParams],
  );
  const selectedPlatformIds = useMemo(
    () => (selectedPlatform === "all" ? [] : [selectedPlatform]),
    [selectedPlatform],
  );
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
  const selectedGrades = useMemo(
    () => normalizeGradeParams(searchParams.getAll("grades")),
    [searchParams],
  );
  const selectedAdGrades = useMemo(
    () => normalizeGradeParams(searchParams.getAll("adGrades")),
    [searchParams],
  );
  const [selectedRecommendations, setSelectedRecommendations] = useState<
    CampaignHealthRecommendation[]
  >([]);
  const selectedCampaignMetaStatuses = useMemo(
    () => normalizeMetaStatusParams(searchParams.getAll("campaignStatuses")),
    [searchParams],
  );
  const selectedAdMetaStatuses = useMemo(
    () => normalizeMetaStatusParams(searchParams.getAll("adStatuses")),
    [searchParams],
  );
  const selectedStates = useMemo(
    () =>
      searchParams
        .getAll("states")
        .map((state) => state.trim())
        .filter(Boolean),
    [searchParams],
  );
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [selectedAdReuse, setSelectedAdReuse] =
    useState<SelectedAdReuse | null>(null);
  const adMediaApiUrl = useMemo(
    () => resolveDashboardAdMediaApiUrl(apiUrl),
    [apiUrl],
  );
  const healthUrl = useMemo(
    () =>
      appendHealthDashboardQueryParams(resolveHealthDashboardApiUrl(apiUrl), {
        brands: selectedBrands,
        from: dateRange.from,
        platform: selectedPlatform,
        to: dateRange.to,
      }),
    [apiUrl, dateRange.from, dateRange.to, selectedBrandsKey, selectedPlatform],
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
  const recommendationOptions = ALL_RECOMMENDATIONS;
  const metaStatusOptions =
    data?.filterOptions.metaStatuses ?? ALL_META_STATUSES;
  const platformOptions = mergePlatformOptions(data?.filterOptions.platforms);
  const stateOptions = data?.filterOptions.states ?? [];
  const rowsBeforeGradeFilter = useMemo(
    () =>
      filterHealthRows(data?.campaignRows ?? [], {
        selectedAdIds,
        selectedAdGrades,
        selectedAdMetaStatuses,
        selectedCampaignIds,
        selectedGrades: [],
        selectedCampaignMetaStatuses,
        selectedRecommendations,
        selectedStates,
      }),
    [
      data,
      selectedAdIds,
      selectedAdGrades,
      selectedAdMetaStatuses,
      selectedCampaignIds,
      selectedCampaignMetaStatuses,
      selectedRecommendations,
      selectedStates,
    ],
  );
  const filteredRows = useMemo(
    () =>
      filterHealthRows(rowsBeforeGradeFilter, {
        selectedAdIds,
        selectedAdGrades,
        selectedAdMetaStatuses,
        selectedCampaignIds,
        selectedGrades,
        selectedCampaignMetaStatuses,
        selectedRecommendations,
        selectedStates,
      }),
    [
      rowsBeforeGradeFilter,
      selectedAdIds,
      selectedAdGrades,
      selectedAdMetaStatuses,
      selectedCampaignIds,
      selectedGrades,
      selectedCampaignMetaStatuses,
      selectedRecommendations,
      selectedStates,
    ],
  );
  const adNamePlacements = useMemo(
    () => buildAdNamePlacementMap(data?.campaignRows ?? []),
    [data],
  );
  const creativePlacements = useMemo(
    () => buildCreativePlacementMap(data?.campaignRows ?? []),
    [data],
  );
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
  const handleStatesChange = useCallback(
    (states: string[]) => {
      replaceParams((nextParams) => {
        setRepeatedQueryValues(nextParams, "states", states);
      });
    },
    [replaceParams],
  );
  const handleGradesChange = useCallback(
    (grades: string[]) => {
      replaceParams((nextParams) => {
        setRepeatedQueryValues(nextParams, "grades", grades);
      });
    },
    [replaceParams],
  );
  const handleAdGradesChange = useCallback(
    (grades: string[]) => {
      replaceParams((nextParams) => {
        setRepeatedQueryValues(nextParams, "adGrades", grades);
      });
    },
    [replaceParams],
  );
  const handleCampaignMetaStatusesChange = useCallback(
    (statuses: string[]) => {
      replaceParams((nextParams) => {
        setRepeatedQueryValues(nextParams, "campaignStatuses", statuses);
      });
    },
    [replaceParams],
  );
  const handleAdMetaStatusesChange = useCallback(
    (statuses: string[]) => {
      replaceParams((nextParams) => {
        setRepeatedQueryValues(nextParams, "adStatuses", statuses);
      });
    },
    [replaceParams],
  );
  const handlePlatformChange = useCallback(
    (platforms: string[]) => {
      const selectedPlatforms = normalizePlatformIds(platforms);

      replaceParams((nextParams) => {
        if (selectedPlatforms.length === 1) {
          nextParams.set("platform", selectedPlatforms[0]);
        } else {
          nextParams.delete("platform");
        }

        nextParams.delete("campaignStatuses");
        nextParams.delete("adStatuses");
      });
      setSelectedCampaignIds([]);
      setSelectedAdIds([]);
      setSelectedRecommendations([]);
      setSelectedAdReuse(null);
    },
    [replaceParams],
  );
  const handleBrandChange = useCallback(
    (brands: string[]) => {
      replaceParams((nextParams) => {
        nextParams.delete("brand");
        nextParams.delete("brands");
        nextParams.delete("states");
        nextParams.delete("grades");
        nextParams.delete("adGrades");
        nextParams.delete("campaignStatuses");
        nextParams.delete("adStatuses");

        for (const brand of brands) {
          nextParams.append("brands", brand);
        }
      });
      setSelectedCampaignIds([]);
      setSelectedAdIds([]);
      setSelectedRecommendations([]);
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

        nextParams.delete("states");
        nextParams.delete("grades");
        nextParams.delete("adGrades");
        nextParams.delete("campaignStatuses");
        nextParams.delete("adStatuses");
      });
      setSelectedCampaignIds([]);
      setSelectedAdIds([]);
      setSelectedRecommendations([]);
      setSelectedAdReuse(null);
    },
    [replaceParams],
  );
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
      handleGradesChange,
    );
    pruneSelection(
      selectedAdGrades,
      (data?.filterOptions.grades ?? ALL_GRADES) as string[],
      handleAdGradesChange,
    );
    pruneSelection(
      selectedRecommendations,
      ALL_RECOMMENDATIONS.map((option) => option.id),
      (values) =>
        setSelectedRecommendations(values as CampaignHealthRecommendation[]),
    );
    pruneSelection(
      selectedCampaignMetaStatuses,
      (data?.filterOptions.metaStatuses ?? ALL_META_STATUSES).map(
        (option) => option.id,
      ),
      handleCampaignMetaStatusesChange,
    );
    pruneSelection(
      selectedAdMetaStatuses,
      (data?.filterOptions.metaStatuses ?? ALL_META_STATUSES).map(
        (option) => option.id,
      ),
      handleAdMetaStatusesChange,
    );

    const allowedStateIds = (data?.filterOptions.states ?? []).map(
      (option) => option.id,
    );

    if (allowedStateIds.length > 0) {
      pruneSelection(selectedStates, allowedStateIds, handleStatesChange);
    }
  }, [
    adOptions,
    campaignOptions,
    data?.filterOptions.grades,
    data?.filterOptions.metaStatuses,
    data?.filterOptions.states,
    handleAdGradesChange,
    handleAdMetaStatusesChange,
    handleCampaignMetaStatusesChange,
    handleGradesChange,
    handleStatesChange,
    selectedAdIds,
    selectedAdGrades,
    selectedAdMetaStatuses,
    selectedCampaignIds,
    selectedCampaignMetaStatuses,
    selectedGrades,
    selectedRecommendations,
    selectedStates,
  ]);
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
      handleGradesChange(
        selectedGrades.includes(grade)
          ? selectedGrades.filter((currentGrade) => currentGrade !== grade)
          : [...selectedGrades, grade],
      );
    },
    [handleGradesChange, selectedGrades],
  );
  const handleOpenAdReuse = useCallback(
    (ad: CampaignHealthAdRow, campaign: CampaignHealthRow) => {
      const key = buildAdNamePlacementKey(campaign, ad);

      if (!key) {
        return;
      }

      setSelectedAdReuse({
        label: ad.adName,
        mediaPlacements: buildAdReuseMediaPlacements({
          creativePlacements,
          placements: adNamePlacements.get(key) ?? [{ ad, campaign }],
          source: { ad, campaign },
        }),
        placements: adNamePlacements.get(key) ?? [{ ad, campaign }],
      });
    },
    [adNamePlacements, creativePlacements],
  );

  return (
    <main className="min-h-screen bg-[#f7f8fb] px-4 py-6 text-slate-950 md:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-5">
        <DashboardHeader
          lastUpdated={lastUpdated}
          subtitle="Campaign and ad audit across selected platforms, brands, campaigns, and ads."
          title="Audit"
        />
        <DashboardTabs activeTab="health" query={tabQuery} />
        <section
          aria-label="Audit filters"
          className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <MultiSelectFilter
              disabled={isLoading && !data}
              label="Platforms"
              loading={isRefreshingHealth}
              onChange={handlePlatformChange}
              options={platformOptions}
              selectedIds={selectedPlatformIds}
              summary={summarizePlatformSelection(selectedPlatformIds)}
              withSearch={false}
            />
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
            <div className="grid min-w-0 grid-cols-2 gap-2">
              <MultiSelectFilter
                disabled={dependentFiltersDisabled}
                label="Campaign grades"
                loading={isRefreshingHealth}
                onChange={handleGradesChange}
                options={gradeOptions}
                selectedIds={selectedGrades}
                summary={summarizeSelection(
                  selectedGrades,
                  "All campaign grades",
                  "campaign grades selected",
                )}
                withSearch={false}
              />
              <MultiSelectFilter
                disabled={dependentFiltersDisabled}
                label="Ad grades"
                loading={isRefreshingHealth}
                onChange={handleAdGradesChange}
                options={gradeOptions}
                selectedIds={selectedAdGrades}
                summary={summarizeSelection(
                  selectedAdGrades,
                  "All ad grades",
                  "ad grades selected",
                )}
                withSearch={false}
              />
            </div>
            <MultiSelectFilter
              disabled={dependentFiltersDisabled}
              label="Recommendation"
              loading={isRefreshingHealth}
              onChange={(values) =>
                setSelectedRecommendations(
                  values as CampaignHealthRecommendation[],
                )
              }
              options={recommendationOptions}
              selectedIds={selectedRecommendations}
              summary={summarizeSelection(
                selectedRecommendations,
                "All recommendations",
                "recommendations selected",
              )}
              withSearch={false}
            />
            <div className="grid min-w-0 grid-cols-2 gap-2">
              <MultiSelectFilter
                disabled={dependentFiltersDisabled}
                label="Campaign status"
                loading={isRefreshingHealth}
                onChange={handleCampaignMetaStatusesChange}
                options={metaStatusOptions}
                selectedIds={selectedCampaignMetaStatuses}
                summary={summarizeSelection(
                  selectedCampaignMetaStatuses,
                  "All campaign statuses",
                  "campaign statuses selected",
                )}
                withSearch={false}
              />
              <MultiSelectFilter
                disabled={dependentFiltersDisabled}
                label="Ad status"
                loading={isRefreshingHealth}
                onChange={handleAdMetaStatusesChange}
                options={metaStatusOptions}
                selectedIds={selectedAdMetaStatuses}
                summary={summarizeSelection(
                  selectedAdMetaStatuses,
                  "All ad statuses",
                  "ad statuses selected",
                )}
                withSearch={false}
              />
            </div>
            <MultiSelectFilter
              disabled={dependentFiltersDisabled}
              label="States"
              loading={isRefreshingHealth}
              onChange={handleStatesChange}
              options={stateOptions}
              selectedIds={selectedStates}
              summary={summarizeSelection(
                selectedStates,
                "All states",
                "states selected",
              )}
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
                onClearGrades={() => handleGradesChange([])}
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
                selectedAdGrades={selectedAdGrades}
                selectedAdMetaStatuses={selectedAdMetaStatuses}
              />
            </RefreshingRegion>
            <RefreshingRegion isRefreshing={isRefreshingHealth}>
              <ThresholdsPanel data={data} />
            </RefreshingRegion>
            {selectedAdReuse ? (
              <AdReuseModal
                adMediaApiUrl={adMediaApiUrl}
                adName={selectedAdReuse.label}
                mediaPlacements={selectedAdReuse.mediaPlacements}
                onClose={() => setSelectedAdReuse(null)}
                placements={selectedAdReuse.placements}
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
        <legend className="text-sm font-semibold text-slate-800">
          {label}
        </legend>
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
  selectedAdGrades,
  selectedAdMetaStatuses,
}: {
  adNamePlacements: Map<string, AdNamePlacement[]>;
  expandedRows: string[];
  isRefreshing: boolean;
  onOpenAdReuse: (ad: CampaignHealthAdRow, campaign: CampaignHealthRow) => void;
  onToggleExpandedRow: (id: string) => void;
  rampUpDays: number;
  rows: CampaignHealthRow[];
  selectedAdIds: string[];
  selectedAdGrades: CampaignHealthGrade[];
  selectedAdMetaStatuses: CampaignMetaDeliveryStatus[];
}) {
  const expandedSet = new Set(expandedRows);
  const selectedAdSet = new Set(selectedAdIds);
  const selectedAdGradeSet = new Set(selectedAdGrades);
  const selectedAdMetaStatusSet = new Set(selectedAdMetaStatuses);
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo<ColumnDef<CampaignHealthRow>[]>(
    () => [
      {
        enableSorting: false,
        header: "",
        id: "expand",
      },
      {
        accessorKey: "brand",
        header: "Brand",
      },
      {
        accessorFn: (row) => row.platform ?? "meta",
        header: "Platform",
        id: "platform",
      },
      {
        accessorKey: "campaignName",
        header: "Campaign",
      },
      {
        accessorKey: "activeDays",
        header: "Age days",
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorFn: (row) => getRowMetaStatus(row).id,
        header: "Status",
        id: "meta",
        sortingFn: metaStatusSortingFn,
      },
      {
        accessorKey: "grade",
        header: "Grade",
        sortDescFirst: true,
        sortingFn: gradeSortingFn,
      },
      {
        accessorKey: "confidence",
        header: "Confidence",
        sortDescFirst: true,
        sortingFn: confidenceSortingFn,
      },
      {
        accessorKey: "recommendation",
        header: "Recommendation",
        sortDescFirst: true,
        sortingFn: recommendationSortingFn,
      },
      {
        accessorKey: "spend",
        header: "Spend",
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "leads",
        header: "Leads",
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "signedLeads",
        header: "SL",
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorFn: (row) => row.metricHealth.cpsl.value,
        header: "CPSL",
        id: "cpsl",
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorFn: (row) => row.metricHealth.volume.value,
        header: "Volume",
        id: "volume",
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorFn: (row) =>
          toPositiveQualityValue(row.metricHealth.quality.value),
        header: "Quality",
        id: "quality",
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorFn: (row) => row.metricHealth.intake.value,
        header: "Int. Conv.",
        id: "intake",
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
    ],
    [],
  );
  const table = useReactTable({
    columns,
    data: rows,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">
          Campaign audit
        </h2>
      </div>
      <div className="overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[4%]" />
            <col className="w-[8%]" />
            <col className="w-[6%]" />
            <col className="w-[11%]" />
            <col className="w-[5%]" />
            <col className="w-[5%]" />
            <col className="w-[5%]" />
            <col className="w-[6%]" />
            <col className="w-[8%]" />
            <col className="w-[6%]" />
            <col className="w-[5%]" />
            <col className="w-[4%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    className={getCampaignHeaderClassName(header.column.id)}
                    key={header.id}
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        className={`flex w-full items-center gap-1 text-left font-semibold transition hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${getCampaignHeaderButtonClassName(
                          header.column.id,
                        )}`}
                        onClick={header.column.getToggleSortingHandler()}
                        type="button"
                      >
                        <span className="min-w-0 truncate">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                        </span>
                        <span
                          aria-hidden="true"
                          className="shrink-0 text-[0.65rem] text-slate-400"
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
          <tbody className="divide-y divide-slate-100">
            {rows.length > 0 ? (
              table.getRowModel().rows.map((tableRow) => {
                const row = tableRow.original;
                const hasAdScopedFilter =
                  selectedAdSet.size > 0 ||
                  selectedAdGradeSet.size > 0 ||
                  selectedAdMetaStatusSet.size > 0;
                const autoExpanded =
                  hasAdScopedFilter &&
                  row.ads.some(
                    (ad) =>
                      (selectedAdSet.size === 0 ||
                        selectedAdSet.has(toAdFilterId(row, ad))) &&
                      adMatchesSelectedGrade(ad, selectedAdGradeSet) &&
                      adMatchesSelectedMetaStatus(
                        ad,
                        selectedAdMetaStatusSet,
                        row.platform ?? "meta",
                      ),
                  );
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
                    selectedAdIds={selectedAdIds}
                    selectedAdGrades={selectedAdGrades}
                    selectedAdMetaStatuses={selectedAdMetaStatuses}
                  />
                );
              })
            ) : (
              <tr>
                <td
                  className="px-4 py-10 text-center text-slate-500"
                  colSpan={16}
                >
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
  selectedAdGrades,
  selectedAdMetaStatuses,
}: {
  adNamePlacements: Map<string, AdNamePlacement[]>;
  isExpanded: boolean;
  isRefreshing: boolean;
  onOpenAdReuse: (ad: CampaignHealthAdRow, campaign: CampaignHealthRow) => void;
  onToggleExpandedRow: (id: string) => void;
  rampUpDays: number;
  row: CampaignHealthRow;
  selectedAdIds: string[];
  selectedAdGrades: CampaignHealthGrade[];
  selectedAdMetaStatuses: CampaignMetaDeliveryStatus[];
}) {
  const activePeriod = formatActivePeriod(row);
  const activePeriodTitle = activePeriod === "-" ? undefined : activePeriod;

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
        <td className="px-4 py-3">
          <PlatformChip platform={row.platform ?? "meta"} />
        </td>
        <td className="break-words px-4 py-3">
          <div className="font-semibold text-slate-950">{row.campaignName}</div>
          <div className="mt-1 text-xs text-slate-500">
            {row.campaignId ?? "CRM-only campaign"}
          </div>
          {row.isRampUp ? (
            <div className="mt-2 inline-flex rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800">
              Ramp-up active day {formatNumber(row.activeDays)} of{" "}
              {formatNumber(rampUpDays)}
            </div>
          ) : null}
        </td>
        <td className="px-4 py-3 text-right">
          <span
            className="inline-block font-medium text-slate-900"
            title={activePeriodTitle}
          >
            {formatNumber(row.activeDays)}
          </span>
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
        <td className="px-4 py-3 text-right">
          {formatNumber(row.signedLeads)}
        </td>
        <td className="px-4 py-3">
          <MetricChip metric={row.metricHealth.cpsl} variant="currency" />
        </td>
        <td className="px-4 py-3">
          <MetricChip metric={row.metricHealth.volume} variant="currency" />
        </td>
        <td className="px-4 py-3">
          <MetricChip
            formatValue={formatPositiveQualityValue}
            metric={row.metricHealth.quality}
            variant="percentage"
          />
        </td>
        <td className="px-4 py-3">
          <MetricChip metric={row.metricHealth.intake} variant="percentage" />
        </td>
      </tr>
      {isExpanded ? (
        <tr className="bg-slate-50/70">
          <td className="px-4 py-3" />
          <td className="px-4 py-3" colSpan={15}>
            <div className="space-y-3">
              <QualitySignalsPanel signals={row.qualitySignals} />
              <AdDetailTable
                adNamePlacements={adNamePlacements}
                ads={row.ads}
                campaign={row}
                onOpenAdReuse={onOpenAdReuse}
                selectedAdIds={selectedAdIds}
                selectedAdGrades={selectedAdGrades}
                selectedAdMetaStatuses={selectedAdMetaStatuses}
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
  const resolvedSignals = normalizeQualitySignals(signals);
  const orderedSignals = [
    resolvedSignals.noAccident,
    resolvedSignals.callNotAnswered,
    resolvedSignals.commercial,
    resolvedSignals.previousAttorney,
    resolvedSignals.oldAccident,
    resolvedSignals.speedToLead,
  ].filter((signal): signal is CampaignHealthQualitySignal => Boolean(signal));

  return (
    <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-6">
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
  selectedAdGrades,
  selectedAdMetaStatuses,
}: {
  adNamePlacements: Map<string, AdNamePlacement[]>;
  ads: CampaignHealthAdRow[];
  campaign: CampaignHealthRow;
  onOpenAdReuse: (ad: CampaignHealthAdRow, campaign: CampaignHealthRow) => void;
  selectedAdIds: string[];
  selectedAdGrades: CampaignHealthGrade[];
  selectedAdMetaStatuses: CampaignMetaDeliveryStatus[];
}) {
  const visibleAds = useMemo(() => {
    const selectedAdIdSet = new Set(selectedAdIds);
    const selectedAdGradeSet = new Set(selectedAdGrades);
    const selectedAdMetaStatusSet = new Set(selectedAdMetaStatuses);

    return ads.filter((ad) => {
      if (
        selectedAdIdSet.size > 0 &&
        !selectedAdIdSet.has(toAdFilterId(campaign, ad))
      ) {
        return false;
      }

      if (!adMatchesSelectedGrade(ad, selectedAdGradeSet)) {
        return false;
      }

      if (
        !adMatchesSelectedMetaStatus(
          ad,
          selectedAdMetaStatusSet,
          campaign.platform ?? "meta",
        )
      ) {
        return false;
      }

      return true;
    });
  }, [
    ads,
    campaign,
    selectedAdIds,
    selectedAdGrades,
    selectedAdMetaStatuses,
  ]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const isTikTokCampaign = campaign.platform === "tiktok";
  const showAdGroupColumn = isTikTokCampaign;
  const showAdStatusColumn = !isTikTokCampaign;
  const columns = useMemo<ColumnDef<CampaignHealthAdRow>[]>(
    () => {
      const nextColumns: ColumnDef<CampaignHealthAdRow>[] = [
        {
          accessorKey: "adName",
          header: "Ad",
        },
        {
          accessorKey: "grade",
          header: "Grade",
          sortDescFirst: true,
          sortingFn: adGradeSortingFn,
        },
      ];

      if (showAdGroupColumn) {
        nextColumns.push({
          accessorFn: (row) => getAdsetMetaStatus(row).id,
          header: "Ad status",
          id: "adsetStatus",
          sortingFn: adMetaStatusSortingFn,
        });
      }

      if (showAdStatusColumn) {
        nextColumns.push({
          accessorFn: (row) => getAdMetaStatus(row).id,
          header: "Ad status",
          id: "meta",
          sortingFn: adMetaStatusSortingFn,
        });
      }

      nextColumns.push(
        {
          accessorFn: (row) => row.adId ?? "",
          header: "Ad ID",
          id: "adId",
        },
        {
          accessorKey: "spend",
          header: "Spend",
          sortDescFirst: true,
          sortingFn: nullableAdNumberSortingFn,
        },
        {
          accessorKey: "leads",
          header: "Leads",
          sortDescFirst: true,
          sortingFn: nullableAdNumberSortingFn,
        },
        {
          accessorKey: "signedLeads",
          header: "SL",
          sortDescFirst: true,
          sortingFn: nullableAdNumberSortingFn,
        },
        {
          accessorKey: "cpl",
          header: "CPL",
          sortingFn: nullableAdNumberSortingFn,
        },
        {
          accessorKey: "cpsl",
          header: "CPSL",
          sortingFn: nullableAdNumberSortingFn,
        },
      );

      return nextColumns;
    },
    [showAdGroupColumn, showAdStatusColumn],
  );
  const table = useReactTable({
    columns,
    data: visibleAds,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <table className="w-full table-fixed text-sm">
        {isTikTokCampaign ? (
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[6%]" />
            <col className="w-[14%]" />
            <col className="w-[13%]" />
            <col className="w-[8%]" />
            <col className="w-[7%]" />
            <col className="w-[6%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
          </colgroup>
        ) : (
          <colgroup>
            <col className="w-[31%]" />
            <col className="w-[6%]" />
            <col className="w-[9%]" />
            <col className="w-[14%]" />
            <col className="w-[8%]" />
            <col className="w-[7%]" />
            <col className="w-[6%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
          </colgroup>
        )}
          <thead className="bg-white text-xs uppercase tracking-wide text-slate-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    className={getAdHeaderClassName(header.column.id)}
                    key={header.id}
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        className={`flex w-full items-center gap-1 text-left font-semibold transition hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${getAdHeaderButtonClassName(
                          header.column.id,
                        )}`}
                        onClick={header.column.getToggleSortingHandler()}
                        type="button"
                      >
                        <span className="min-w-0 truncate">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                        </span>
                        <span
                          aria-hidden="true"
                          className="shrink-0 text-[0.65rem] text-slate-400"
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
          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((tableRow) => {
                const ad = tableRow.original;
                const placementCount = getAdNamePlacementCount(
                  adNamePlacements,
                  ad,
                  campaign,
                );
                const isClickable = Boolean(normalizeAdName(ad.adName));

                return (
                  <tr key={ad.id}>
                    <td className="min-w-0 px-3 py-2 font-medium text-slate-900">
                      {isClickable ? (
                        <button
                          className="block max-w-full whitespace-normal break-words text-left font-semibold text-teal-700 underline decoration-teal-200 underline-offset-2 transition [overflow-wrap:anywhere] hover:text-teal-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                          onClick={() => onOpenAdReuse(ad, campaign)}
                          title={ad.adName}
                          type="button"
                        >
                          {ad.adName}
                        </button>
                      ) : (
                        <span
                          className="block max-w-full break-words [overflow-wrap:anywhere]"
                          title={ad.adName || undefined}
                        >
                          {ad.adName}
                        </span>
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
                    {showAdGroupColumn ? (
                      <td className="px-3 py-2">
                        <MetaStatusChip
                          status={getAdsetMetaStatus(ad)}
                          unknownLabel="-"
                        />
                      </td>
                    ) : null}
                    {showAdStatusColumn ? (
                      <td className="px-3 py-2">
                        <MetaStatusChip status={getAdMetaStatus(ad)} />
                      </td>
                    ) : null}
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
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  className="px-3 py-6 text-center text-sm font-medium text-slate-500"
                  colSpan={columns.length}
                >
                  No ads match the selected ad filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
    </div>
  );
}

function AdReuseModal({
  adMediaApiUrl,
  adName,
  mediaPlacements,
  onClose,
  placements,
}: {
  adMediaApiUrl?: string;
  adName: string;
  mediaPlacements: AdNamePlacement[];
  onClose: () => void;
  placements: AdNamePlacement[];
}) {
  const placementPlatform = getAdReusePlacementPlatform(placements);
  const isMetaPlacement = placementPlatform === "meta";
  const [selectedMetaStatuses, setSelectedMetaStatuses] = useState<
    CampaignMetaDeliveryStatus[]
  >([]);
  const visiblePlacements = useMemo(
    () =>
      isMetaPlacement
        ? filterPlacementsByMetaStatus(placements, selectedMetaStatuses)
        : placements,
    [isMetaPlacement, placements, selectedMetaStatuses],
  );
  const mediaTargets = useMemo(
    () => buildAdMediaTargets(mediaPlacements),
    [mediaPlacements],
  );
  const [mediaByTargetKey, setMediaByTargetKey] = useState<
    Record<string, AdMediaState>
  >({});
  const totals = visiblePlacements.reduce(
    (sum, placement) => ({
      leads: sum.leads + placement.ad.leads,
      signedLeads: sum.signedLeads + placement.ad.signedLeads,
      spend: sum.spend + placement.ad.spend,
    }),
    {
      leads: 0,
      signedLeads: 0,
      spend: 0,
    },
  );

  useEffect(() => {
    setSelectedMetaStatuses([]);
  }, [adName, placements]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (!adMediaApiUrl || mediaTargets.length === 0) {
      setMediaByTargetKey({});
      return;
    }

    let isActive = true;

    setMediaByTargetKey(
      Object.fromEntries(
        mediaTargets.map((target) => [
          buildAdMediaTargetKey(target),
          { error: null, isLoading: true, media: null },
        ]),
      ),
    );

    async function loadMedia() {
      const results = await Promise.all(
        mediaTargets.map(async (target) => {
          try {
            const media = await fetchAdMedia(adMediaApiUrl as string, target);

            return {
              state: { error: null, isLoading: false, media },
              target,
            };
          } catch (caughtError) {
            return {
              state: {
                error:
                  caughtError instanceof Error
                    ? caughtError.message
                    : "Unable to load ad media.",
                isLoading: false,
                media: null,
              },
              target,
            };
          }
        }),
      );

      if (!isActive) {
        return;
      }

      setMediaByTargetKey(
        Object.fromEntries(
          results.map((result) => [
            buildAdMediaTargetKey(result.target),
            result.state,
          ]),
        ),
      );
    }

    void loadMedia();

    return () => {
      isActive = false;
    };
  }, [adMediaApiUrl, mediaTargets]);

  return (
    <div
      aria-labelledby="ad-reuse-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6"
      role="dialog"
    >
      <div className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 sm:grid-cols-4">
            <AdReuseSummaryItem
              label="Placements"
              value={
                selectedMetaStatuses.length > 0
                  ? `${formatNumber(visiblePlacements.length)} / ${formatNumber(placements.length)}`
                  : formatNumber(placements.length)
              }
            />
            <AdReuseSummaryItem
              label="Spend"
              value={formatCurrency(totals.spend)}
            />
            <AdReuseSummaryItem
              label="Leads"
              value={formatNumber(totals.leads)}
            />
            <AdReuseSummaryItem
              label="SL"
              value={formatNumber(totals.signedLeads)}
            />
          </div>
          <AdMediaPreviewPanel
            isConfigured={Boolean(adMediaApiUrl)}
            mediaByTargetKey={mediaByTargetKey}
            platform={placementPlatform}
            targets={mediaTargets}
          />
          <AdReusePlacementList
            onClearMetaStatuses={() => setSelectedMetaStatuses([])}
            onToggleMetaStatus={(status) =>
              setSelectedMetaStatuses((current) =>
                current.includes(status)
                  ? current.filter((currentStatus) => currentStatus !== status)
                  : [...current, status],
              )
            }
            placements={visiblePlacements}
            platform={placementPlatform}
            selectedMetaStatuses={selectedMetaStatuses}
            totalPlacements={placements.length}
          />
        </div>
      </div>
    </div>
  );
}

function AdMediaPreviewPanel({
  isConfigured,
  mediaByTargetKey,
  platform,
  targets,
}: {
  isConfigured: boolean;
  mediaByTargetKey: Record<string, AdMediaState>;
  platform: CampaignPlatform;
  targets: AdMediaTarget[];
}) {
  const bestSelection = getBestAdMediaSelection(
    targets,
    mediaByTargetKey,
    platform,
  );
  const platformName = platformLabel(platform);

  if (targets.length === 0) {
    return (
      <div className="border-b border-slate-200 px-5 py-4 text-sm text-slate-500">
        No {platformName} ad ID is available for this ad name, so creative
        media cannot be loaded.
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="border-b border-slate-200 px-5 py-4 text-sm text-slate-500">
        Creative preview is unavailable because the dashboard media API URL is
        not configured.
      </div>
    );
  }

  return (
    <div className="border-b border-slate-200 px-5 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-950">
          Creative preview
        </h3>
      </div>
      <AdMediaPreviewCard
        mediaByTargetKey={mediaByTargetKey}
        selection={bestSelection}
        sourcePlatform={platform}
        targets={targets}
      />
    </div>
  );
}

function AdMediaPreviewCard({
  mediaByTargetKey,
  selection,
  sourcePlatform,
  targets,
}: {
  mediaByTargetKey: Record<string, AdMediaState>;
  selection: AdMediaSelection | null;
  sourcePlatform: CampaignPlatform;
  targets: AdMediaTarget[];
}) {
  const state =
    selection?.state ?? { error: null, isLoading: false, media: null };
  const media = state.media;
  const primaryTarget = selection?.target ?? targets[0];
  const watchUrl = getAdMediaWatchUrl(media, primaryTarget?.platform ?? "meta");
  const watchLabel = getAdMediaWatchLabel(
    media,
    primaryTarget?.platform ?? "meta",
  );
  const sourcePlatformName = platformLabel(sourcePlatform);
  const previewPlatformName = platformLabel(primaryTarget?.platform ?? "meta");
  const secondaryWatch = getSecondaryAdMediaWatchAction({
    mediaByTargetKey,
    primaryTarget,
    sourcePlatform,
    targets,
  });
  const isFallbackPreview =
    Boolean(primaryTarget) && primaryTarget.platform !== sourcePlatform;

  return (
    <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-3">
      <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-200">
        {state.isLoading ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            <LoadingSpinner
              className="h-4 w-4 text-teal-600"
              label="Loading creative"
            />
          </div>
        ) : state.error ? (
          <div className="flex h-full items-center justify-center px-2 text-center text-[0.65rem] font-medium text-rose-700">
            Error
          </div>
        ) : media?.thumbnailUrl ? (
          watchUrl ? (
            <a
              className="group relative block h-full w-full"
              href={watchUrl}
              rel="noreferrer"
              target="_blank"
            >
              <img
                alt={media.adName ?? "Ad creative thumbnail"}
                className="h-full w-full object-cover transition group-hover:brightness-90"
                src={media.thumbnailUrl}
              />
            </a>
          ) : (
            <img
              alt={media.adName ?? "Ad creative thumbnail"}
              className="h-full w-full object-cover"
              src={media.thumbnailUrl}
            />
          )
        ) : watchUrl ? (
          <div className="flex h-full items-center justify-center px-2 text-center">
            <a
              className="text-[0.65rem] font-semibold text-teal-700 transition hover:text-teal-900"
              href={watchUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open
            </a>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-[0.65rem] font-medium text-slate-500">
            No image
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div>
          <div className="truncate text-sm font-semibold text-slate-950">
            {media?.adName ?? primaryTarget?.campaignLabel ?? "Ad creative"}
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>{media?.mediaType ?? "unknown"}</span>
          <span>
            {formatNumber(targets.length)} creative candidate
            {targets.length === 1 ? "" : "s"} matched
          </span>
          <span>{previewPlatformName} preview</span>
          {isFallbackPreview ? (
            <span>Fallback for {sourcePlatformName}</span>
          ) : null}
          {primaryTarget ? (
            <span className="truncate">Ad ID: {primaryTarget.adId}</span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        {watchUrl ? (
          <a
            className="rounded-md border border-teal-200 px-3 py-2 text-xs font-semibold text-teal-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-900"
            href={watchUrl}
            rel="noreferrer"
            target="_blank"
          >
            {watchLabel}
          </a>
        ) : null}
        {secondaryWatch ? (
          <a
            className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            href={secondaryWatch.url}
            rel="noreferrer"
            target="_blank"
          >
            {secondaryWatch.label}
          </a>
        ) : null}
      </div>
    </div>
  );
}

function AdReusePlacementList({
  onClearMetaStatuses,
  onToggleMetaStatus,
  placements,
  platform,
  selectedMetaStatuses,
  totalPlacements,
}: {
  onClearMetaStatuses: () => void;
  onToggleMetaStatus: (status: CampaignMetaDeliveryStatus) => void;
  placements: AdNamePlacement[];
  platform: CampaignPlatform;
  selectedMetaStatuses: CampaignMetaDeliveryStatus[];
  totalPlacements: number;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const isMetaPlacement = platform === "meta";
  const columns = useMemo<ColumnDef<AdNamePlacement>[]>(
    () => {
      const nextColumns: ColumnDef<AdNamePlacement>[] = [
        {
          accessorFn: (row) =>
            `${row.campaign.brand} / ${row.campaign.campaignName}`,
          header: "Campaign",
          id: "campaign",
        },
        {
          accessorFn: (row) => row.ad.adId ?? "",
          header: "Ad ID",
          id: "adId",
        },
        {
          accessorFn: (row) => row.ad.grade,
          header: "Grade",
          id: "grade",
          sortDescFirst: true,
          sortingFn: placementGradeSortingFn,
        },
      ];

      if (isMetaPlacement) {
        nextColumns.push({
          accessorFn: (row) => getAdMetaStatus(row.ad).id,
          header: "Status",
          id: "meta",
          sortingFn: placementMetaStatusSortingFn,
        });
      }

      nextColumns.push(
        {
          accessorFn: (row) => row.ad.spend,
          header: "Spend",
          id: "spend",
          sortDescFirst: true,
          sortingFn: placementNumberSortingFn,
        },
        {
          accessorFn: (row) => row.ad.leads,
          header: "Leads",
          id: "leads",
          sortDescFirst: true,
          sortingFn: placementNumberSortingFn,
        },
        {
          accessorFn: (row) => row.ad.signedLeads,
          header: "SL",
          id: "signedLeads",
          sortDescFirst: true,
          sortingFn: placementNumberSortingFn,
        },
      );

      return nextColumns;
    },
    [isMetaPlacement],
  );
  const table = useReactTable({
    columns,
    data: placements,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  return (
    <div className="min-h-0 overflow-auto px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-950">Placements</h3>
        <span className="text-xs font-medium text-slate-500">
          {formatNumber(placements.length)} of{" "}
          {formatNumber(totalPlacements)} placement
          {totalPlacements === 1 ? "" : "s"}
        </span>
      </div>
      {isMetaPlacement ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Delivery status
          </span>
          {ALL_META_STATUSES.map(({ id, label }) => {
            const isActive = selectedMetaStatuses.includes(id);

            return (
              <button
                aria-pressed={isActive}
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${
                  isActive
                    ? metaStatusClasses[id]
                    : "border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-slate-900"
                }`}
                key={id}
                onClick={() => onToggleMetaStatus(id)}
                type="button"
              >
                {label}
              </button>
            );
          })}
          {selectedMetaStatuses.length > 0 ? (
            <button
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 transition hover:border-teal-300 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              onClick={onClearMetaStatuses}
              type="button"
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full table-fixed text-sm">
          {isMetaPlacement ? (
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[17%]" />
              <col className="w-[8%]" />
              <col className="w-[11%]" />
              <col className="w-[12%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
            </colgroup>
          ) : (
            <colgroup>
              <col className="w-[34%]" />
              <col className="w-[18%]" />
              <col className="w-[8%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
            </colgroup>
          )}
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    className={getPlacementHeaderClassName(header.column.id)}
                    key={header.id}
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        className={`flex w-full items-center gap-1 text-left font-semibold transition hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${getPlacementHeaderButtonClassName(
                          header.column.id,
                        )}`}
                        onClick={header.column.getToggleSortingHandler()}
                        type="button"
                      >
                        <span className="min-w-0 truncate">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                        </span>
                        <span
                          aria-hidden="true"
                          className="shrink-0 text-[0.65rem] text-slate-400"
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
          <tbody className="divide-y divide-slate-100 bg-white">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((tableRow) => {
                const placement = tableRow.original;

                return (
                  <tr
                    key={`${placement.campaign.id}::${placement.ad.id}`}
                  >
                    <td className="break-words px-3 py-2 font-medium text-slate-950">
                      <div className="truncate">
                        {placement.campaign.brand} /{" "}
                        {placement.campaign.campaignName}
                      </div>
                    </td>
                    <td className="break-words px-3 py-2 text-slate-500">
                      {placement.ad.adId ?? "No ad ID"}
                    </td>
                    <td className="px-3 py-2">
                      <GradeChip grade={placement.ad.grade} />
                    </td>
                    {isMetaPlacement ? (
                      <td className="px-3 py-2">
                        <MetaStatusChip status={getAdMetaStatus(placement.ad)} />
                      </td>
                    ) : null}
                    <td className="px-3 py-2 text-right">
                      {formatCurrency(placement.ad.spend)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatNumber(placement.ad.leads)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatNumber(placement.ad.signedLeads)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  className="px-4 py-10 text-center text-sm text-slate-500"
                  colSpan={isMetaPlacement ? 7 : 6}
                >
                  {totalPlacements === 0
                    ? "No matching ad names in the current audit data."
                    : "No placements match the selected delivery status filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
  formatValue,
  metric,
  variant,
}: {
  formatValue?: (value: number | null) => string;
  metric: CampaignHealthMetric;
  variant: "currency" | "percentage";
}) {
  const value = formatValue
    ? formatValue(metric.value)
    : variant === "currency"
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

function formatPositiveQualityValue(value: number | null): string {
  return formatPercentage(toPositiveQualityValue(value));
}

function toPositiveQualityValue(value: number | null): number | null {
  if (value == null) {
    return null;
  }

  return Math.max(0, Math.min(1, 1 - value));
}

function formatQualitySignalCount(signal: CampaignHealthQualitySignal): string {
  if (signal.count == null || signal.denominator == null) {
    return healthStatusLabels[signal.status];
  }

  return `${formatNumber(signal.count)} of ${formatNumber(
    signal.denominator,
  )} leads`;
}

function normalizeQualitySignals(
  signals: CampaignHealthRow["qualitySignals"],
): CampaignHealthRow["qualitySignals"] {
  return {
    callNotAnswered: signals.callNotAnswered,
    commercial:
      signals.commercial ??
      unavailableQualitySignal(
        "Commercial",
        'Source: CRM intake "Commercial? (Uber, Lyft, Utility Truck)" or Is Commercial flag.',
      ),
    noAccident: signals.noAccident,
    oldAccident: signals.oldAccident,
    previousAttorney: signals.previousAttorney,
    speedToLead: signals.speedToLead,
  };
}

function unavailableQualitySignal(
  label: string,
  reason: string,
): CampaignHealthQualitySignal {
  return {
    count: null,
    denominator: null,
    label,
    reason,
    status: "neutral",
    value: null,
  };
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

function formatActivePeriod(row: CampaignHealthRow): string {
  if (!row.activeStartDate || !row.activeEndDate) {
    return "-";
  }

  if (row.activeStartDate === row.activeEndDate) {
    return row.activeStartDate;
  }

  return `${row.activeStartDate} -> ${row.activeEndDate}`;
}

function MetaStatusChip({
  status,
  unknownLabel,
}: {
  status: CampaignMetaStatus;
  unknownLabel?: string;
}) {
  const rawStatus = [status.effectiveStatus, status.configuredStatus]
    .filter(Boolean)
    .join(" / ");
  const label = status.id === "unknown" && unknownLabel ? unknownLabel : status.label;

  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${metaStatusClasses[status.id]}`}
      title={
        rawStatus
          ? `Effective/configured status: ${rawStatus}`
          : "Delivery status is unavailable."
      }
    >
      {label}
    </span>
  );
}

function PlatformChip({ platform }: { platform: CampaignPlatform }) {
  const isTikTok = platform === "tiktok";

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${
        isTikTok
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-sky-200 bg-sky-50 text-sky-700"
      }`}
    >
      {platformLabel(platform)}
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

function ConfidenceChip({
  confidence,
}: {
  confidence: CampaignHealthConfidence;
}) {
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
      className={`inline-flex max-w-full rounded-md border px-2.5 py-1 text-left text-xs font-semibold leading-tight ${recommendationClasses[recommendation]}`}
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
        Audit formulas
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Campaign grades use CPSL, volume, quality, and Int. Conv. CPSL is the
        gating metric: if CPSL is not Good, the campaign grade is F. Ad grades
        use CPSL, volume, Int. Conv., and attribution quality with the same
        CPSL rule; source-backed quality stays at campaign level until it can be
        reliably tied to ad IDs.
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
              <th className="px-3 py-2">Good</th>
              <th className="px-3 py-2">Watch</th>
              <th className="px-3 py-2">Review</th>
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
              formula="1 - (no-accident leads / total leads); higher is better. CNA can downgrade the status."
              green={`> ${formatPercentage(
                1 - thresholds.quality.greenMax,
              )}; CNA <= ${formatPercentage(
                thresholds.quality.callNotAnsweredGreenMax,
              )}`}
              metric="Quality"
              neutral={`Fewer than ${formatNumber(
                thresholds.quality.minimumLeads,
              )} leads`}
              red={`< ${formatPercentage(
                1 - thresholds.quality.yellowMax,
              )}; or ${formatPercentage(
                1 - thresholds.quality.yellowMax,
              )} - ${formatPercentage(
                1 - thresholds.quality.greenMax,
              )} plus CNA > ${formatPercentage(
                thresholds.quality.callNotAnsweredGreenMax,
              )}`}
              yellow={`${formatPercentage(
                1 - thresholds.quality.yellowMax,
              )} - ${formatPercentage(
                1 - thresholds.quality.greenMax,
              )}; or > ${formatPercentage(
                1 - thresholds.quality.greenMax,
              )} with CNA > ${formatPercentage(
                thresholds.quality.callNotAnsweredGreenMax,
              )}`}
            />
            <ThresholdRow
              formula="Signed Leads / Leads"
              green={`>= ${formatPercentage(thresholds.intake.greenMin)}`}
              metric="Int. Conv."
              neutral={`Fewer than ${formatNumber(
                thresholds.intake.minimumLeads,
              )} leads`}
              red={`< ${formatPercentage(thresholds.intake.yellowMin)}`}
              yellow={`${formatPercentage(
                thresholds.intake.yellowMin,
              )} - ${formatPercentage(thresholds.intake.greenMin)}`}
            />
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs font-medium text-slate-500">
        Campaigns with fewer than{" "}
        {formatNumber(thresholds.rampUp.minimumCampaignAgeDays)} active days are
        in ramp-up: no-lead and no-signed-lead failures are not scored yet.
        Quality sources are exact CRM substatus/stage values, Turndown Reason,
        Date of Accident, and structured attorney answers. Previous attorney
        and old-accident signals are shown as quality context. Speed-to-lead
        needs call-log data before it can be scored.
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
  green: "Good",
  neutral: "Not scored",
  red: "Review",
  yellow: "Watch",
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
  "KEEP / WATCH": "border-sky-200 bg-sky-50 text-sky-800",
  "PAUSE / SHUTDOWN REVIEW": "border-rose-200 bg-rose-50 text-rose-800",
  "REDUCE / REBUILD REVIEW": "border-orange-200 bg-orange-50 text-orange-800",
  "WATCH / DIAGNOSE": "border-amber-200 bg-amber-50 text-amber-800",
  "WINNER / REPLICATE / SCALE REVIEW":
    "border-teal-200 bg-teal-50 text-teal-800",
};

const metaStatusClasses: Record<CampaignMetaDeliveryStatus, string> = {
  off: "border-slate-300 bg-slate-100 text-slate-700",
  on: "border-teal-200 bg-teal-50 text-teal-800",
  unknown: "border-amber-200 bg-amber-50 text-amber-800",
};

const gradeSortRanks: Record<CampaignHealthGrade, number> = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  F: 1,
};

const confidenceSortRanks: Record<CampaignHealthConfidence, number> = {
  High: 4,
  Medium: 3,
  Limited: 2,
  Learning: 1,
};

const recommendationSortRanks: Record<CampaignHealthRecommendation, number> = {
  "PAUSE / SHUTDOWN REVIEW": 5,
  "REDUCE / REBUILD REVIEW": 4,
  "WATCH / DIAGNOSE": 3,
  "KEEP / WATCH": 2,
  "WINNER / REPLICATE / SCALE REVIEW": 1,
};

const metaStatusSortRanks: Record<CampaignMetaDeliveryStatus, number> = {
  on: 3,
  off: 2,
  unknown: 1,
};

const gradeSortingFn: SortingFn<CampaignHealthRow> = (
  first,
  second,
  columnId,
) =>
  compareRankedValues(
    first.getValue<CampaignHealthGrade>(columnId),
    second.getValue<CampaignHealthGrade>(columnId),
    gradeSortRanks,
  );

const confidenceSortingFn: SortingFn<CampaignHealthRow> = (
  first,
  second,
  columnId,
) =>
  compareRankedValues(
    first.getValue<CampaignHealthConfidence>(columnId),
    second.getValue<CampaignHealthConfidence>(columnId),
    confidenceSortRanks,
  );

const recommendationSortingFn: SortingFn<CampaignHealthRow> = (
  first,
  second,
  columnId,
) =>
  compareRankedValues(
    first.getValue<CampaignHealthRecommendation>(columnId),
    second.getValue<CampaignHealthRecommendation>(columnId),
    recommendationSortRanks,
  );

const metaStatusSortingFn: SortingFn<CampaignHealthRow> = (
  first,
  second,
  columnId,
) =>
  compareRankedValues(
    first.getValue<CampaignMetaDeliveryStatus>(columnId),
    second.getValue<CampaignMetaDeliveryStatus>(columnId),
    metaStatusSortRanks,
  );

const nullableNumberSortingFn: SortingFn<CampaignHealthRow> = (
  first,
  second,
  columnId,
) => {
  const firstValue = first.getValue<number | null>(columnId);
  const secondValue = second.getValue<number | null>(columnId);

  return (
    normalizeSortableNumber(firstValue) - normalizeSortableNumber(secondValue)
  );
};

const adGradeSortingFn: SortingFn<CampaignHealthAdRow> = (
  first,
  second,
  columnId,
) =>
  compareRankedValues(
    first.getValue<CampaignHealthGrade>(columnId),
    second.getValue<CampaignHealthGrade>(columnId),
    gradeSortRanks,
  );

const adMetaStatusSortingFn: SortingFn<CampaignHealthAdRow> = (
  first,
  second,
  columnId,
) =>
  compareRankedValues(
    first.getValue<CampaignMetaDeliveryStatus>(columnId),
    second.getValue<CampaignMetaDeliveryStatus>(columnId),
    metaStatusSortRanks,
  );

const nullableAdNumberSortingFn: SortingFn<CampaignHealthAdRow> = (
  first,
  second,
  columnId,
) => {
  const firstValue = first.getValue<number | null>(columnId);
  const secondValue = second.getValue<number | null>(columnId);

  return (
    normalizeSortableNumber(firstValue) - normalizeSortableNumber(secondValue)
  );
};

const placementGradeSortingFn: SortingFn<AdNamePlacement> = (
  first,
  second,
  columnId,
) =>
  compareRankedValues(
    first.getValue<CampaignHealthGrade>(columnId),
    second.getValue<CampaignHealthGrade>(columnId),
    gradeSortRanks,
  );

const placementMetaStatusSortingFn: SortingFn<AdNamePlacement> = (
  first,
  second,
  columnId,
) =>
  compareRankedValues(
    first.getValue<CampaignMetaDeliveryStatus>(columnId),
    second.getValue<CampaignMetaDeliveryStatus>(columnId),
    metaStatusSortRanks,
  );

const placementNumberSortingFn: SortingFn<AdNamePlacement> = (
  first,
  second,
  columnId,
) => {
  const firstValue = first.getValue<number | null>(columnId);
  const secondValue = second.getValue<number | null>(columnId);

  return (
    normalizeSortableNumber(firstValue) - normalizeSortableNumber(secondValue)
  );
};

function getPlacementHeaderClassName(columnId: string): string {
  const rightAligned = new Set(["spend", "leads", "signedLeads"]);

  return rightAligned.has(columnId)
    ? "px-3 py-2 text-right"
    : "px-3 py-2 text-left";
}

function getPlacementHeaderButtonClassName(columnId: string): string {
  return ["spend", "leads", "signedLeads"].includes(columnId)
    ? "justify-end"
    : "";
}

function compareRankedValues<T extends string>(
  first: T,
  second: T,
  ranks: Record<T, number>,
): number {
  return (ranks[first] ?? 0) - (ranks[second] ?? 0);
}

function normalizeSortableNumber(value: number | null | undefined): number {
  return value == null || Number.isNaN(value)
    ? Number.NEGATIVE_INFINITY
    : value;
}

function getCampaignHeaderClassName(columnId: string): string {
  const rightAligned = new Set([
    "activeDays",
    "spend",
    "leads",
    "signedLeads",
  ]);
  const base = columnId === "expand" ? "w-12 px-4 py-3" : "px-4 py-3";

  return rightAligned.has(columnId) ? `${base} text-right` : base;
}

function getCampaignHeaderButtonClassName(columnId: string): string {
  return ["activeDays", "spend", "leads", "signedLeads"].includes(columnId)
    ? "justify-end"
    : "";
}

function getAdHeaderClassName(columnId: string): string {
  const rightAligned = new Set([
    "spend",
    "leads",
    "signedLeads",
    "cpl",
    "cpsl",
  ]);

  return rightAligned.has(columnId)
    ? "px-3 py-2 text-right"
    : "px-3 py-2 text-left";
}

function getAdHeaderButtonClassName(columnId: string): string {
  return [
    "spend",
    "leads",
    "signedLeads",
    "cpl",
    "cpsl",
  ].includes(columnId)
    ? "justify-end"
    : "";
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

function adMatchesSelectedMetaStatus(
  ad: CampaignHealthAdRow,
  selectedMetaStatuses: Set<CampaignMetaDeliveryStatus>,
  platform: CampaignPlatform = "meta",
): boolean {
  return (
    selectedMetaStatuses.size === 0 ||
    selectedMetaStatuses.has(getAdDeliveryStatus(ad, platform).id)
  );
}

function adMatchesSelectedGrade(
  ad: CampaignHealthAdRow,
  selectedAdGrades: Set<CampaignHealthGrade>,
): boolean {
  return selectedAdGrades.size === 0 || selectedAdGrades.has(ad.grade);
}

function adMatchesSelectedStates(
  ad: CampaignHealthAdRow,
  selectedStates: Set<string>,
): boolean {
  return (
    selectedStates.size === 0 ||
    ad.states.some((state) => selectedStates.has(state))
  );
}

function rowMatchesSelectedStates(
  row: CampaignHealthRow,
  selectedStates: Set<string>,
): boolean {
  return (
    selectedStates.size === 0 ||
    row.states.some((state) => selectedStates.has(state))
  );
}

function filterHealthRows(
  rows: CampaignHealthRow[],
  filters: {
    selectedAdIds: string[];
    selectedAdGrades: CampaignHealthGrade[];
    selectedAdMetaStatuses: CampaignMetaDeliveryStatus[];
    selectedCampaignIds: string[];
    selectedCampaignMetaStatuses: CampaignMetaDeliveryStatus[];
    selectedGrades: CampaignHealthGrade[];
    selectedRecommendations: CampaignHealthRecommendation[];
    selectedStates: string[];
  },
): CampaignHealthRow[] {
  const selectedCampaignIds = new Set(filters.selectedCampaignIds);
  const selectedAdIds = new Set(filters.selectedAdIds);
  const selectedAdGrades = new Set(filters.selectedAdGrades);
  const selectedAdMetaStatuses = new Set(filters.selectedAdMetaStatuses);
  const selectedCampaignMetaStatuses = new Set(
    filters.selectedCampaignMetaStatuses,
  );
  const selectedGrades = new Set(filters.selectedGrades);
  const selectedRecommendations = new Set(filters.selectedRecommendations);
  const selectedStates = new Set(filters.selectedStates);

  return rows.filter((row) => {
    if (selectedCampaignIds.size > 0 && !selectedCampaignIds.has(row.id)) {
      return false;
    }

    const hasAdScopedFilter =
      selectedAdIds.size > 0 ||
      selectedAdGrades.size > 0 ||
      selectedAdMetaStatuses.size > 0;
    let selectedRowAds = hasAdScopedFilter ? row.ads : [];

    if (selectedAdIds.size > 0) {
      selectedRowAds = selectedRowAds.filter((ad) =>
        selectedAdIds.has(toAdFilterId(row, ad)),
      );
    }

    if (selectedAdGrades.size > 0) {
      selectedRowAds = selectedRowAds.filter((ad) =>
        adMatchesSelectedGrade(ad, selectedAdGrades),
      );
    }

    if (selectedAdMetaStatuses.size > 0) {
      selectedRowAds = selectedRowAds.filter((ad) =>
        adMatchesSelectedMetaStatus(
          ad,
          selectedAdMetaStatuses,
          row.platform ?? "meta",
        ),
      );
    }

    if (hasAdScopedFilter && selectedRowAds.length === 0) {
      return false;
    }

    if (
      selectedCampaignMetaStatuses.size > 0 &&
      !selectedCampaignMetaStatuses.has(getRowMetaStatus(row).id)
    ) {
      return false;
    }

    if (
      selectedStates.size > 0 &&
      !rowMatchesSelectedStates(row, selectedStates)
    ) {
      return false;
    }

    if (selectedGrades.size > 0 && !selectedGrades.has(row.grade)) {
      return false;
    }

    if (
      selectedRecommendations.size > 0 &&
      !selectedRecommendations.has(row.recommendation)
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
      const key = buildAdNamePlacementKey(campaign, ad);

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
        second.ad.spend - first.ad.spend ||
        first.ad.id.localeCompare(second.ad.id),
    );
  }

  return placements;
}

function buildCreativePlacementMap(
  rows: CampaignHealthRow[],
): Map<string, AdNamePlacement[]> {
  const placements = new Map<string, AdNamePlacement[]>();

  for (const campaign of rows) {
    for (const ad of campaign.ads) {
      for (const key of buildCreativePlacementKeys(ad.adName)) {
        const current = placements.get(key) ?? [];

        current.push({ ad, campaign });
        placements.set(key, current);
      }
    }
  }

  for (const current of placements.values()) {
    current.sort(
      (first, second) =>
        Number(isMetaFallbackCandidate(first)) -
          Number(isMetaFallbackCandidate(second)) ||
        second.ad.spend - first.ad.spend ||
        first.campaign.brand.localeCompare(second.campaign.brand) ||
        first.campaign.campaignName.localeCompare(
          second.campaign.campaignName,
        ) ||
        first.ad.id.localeCompare(second.ad.id),
    );
  }

  return placements;
}

function buildAdReuseMediaPlacements({
  creativePlacements,
  placements,
  source,
}: {
  creativePlacements: Map<string, AdNamePlacement[]>;
  placements: AdNamePlacement[];
  source: AdNamePlacement;
}): AdNamePlacement[] {
  if ((source.campaign.platform ?? "meta") !== "tiktok") {
    return placements;
  }

  const fallbackPlacements = dedupeAdNamePlacements(
    buildCreativePlacementKeys(source.ad.adName)
      .flatMap((key) => creativePlacements.get(key) ?? [])
      .filter((placement) =>
        isMetaCreativeFallbackPlacement(source, placement),
      ),
  )
    .sort((first, second) =>
      sortCreativeFallbackPlacements(source, first, second),
    )
    .slice(0, MAX_META_CREATIVE_FALLBACK_TARGETS);

  return dedupeAdNamePlacements([...placements, ...fallbackPlacements]);
}

function sortCreativeFallbackPlacements(
  source: AdNamePlacement,
  first: AdNamePlacement,
  second: AdNamePlacement,
): number {
  return (
    Number(isBrandCompatibleCreativeFallback(source, second)) -
      Number(isBrandCompatibleCreativeFallback(source, first)) ||
    second.ad.spend - first.ad.spend ||
    second.ad.leads - first.ad.leads ||
    first.campaign.brand.localeCompare(second.campaign.brand) ||
    first.campaign.campaignName.localeCompare(second.campaign.campaignName) ||
    first.ad.id.localeCompare(second.ad.id)
  );
}

function isMetaCreativeFallbackPlacement(
  source: AdNamePlacement,
  placement: AdNamePlacement,
): boolean {
  if ((placement.campaign.platform ?? "meta") !== "meta") {
    return false;
  }

  if (!placement.ad.adId?.trim()) {
    return false;
  }

  if (!hasSharedCreativePlacementKey(source.ad.adName, placement.ad.adName)) {
    return false;
  }

  return isBrandCompatibleCreativeFallback(source, placement);
}

function isBrandCompatibleCreativeFallback(
  source: AdNamePlacement,
  placement: AdNamePlacement,
): boolean {
  const sourceBrand = normalizeCreativeBrand(source.campaign.brand);
  const placementBrand = normalizeCreativeBrand(placement.campaign.brand);

  if (!sourceBrand || sourceBrand === "unattributed" || !placementBrand) {
    return true;
  }

  return (
    sourceBrand === placementBrand ||
    sourceBrand.includes(placementBrand) ||
    placementBrand.includes(sourceBrand)
  );
}

function dedupeAdNamePlacements(
  placements: AdNamePlacement[],
): AdNamePlacement[] {
  const seen = new Set<string>();
  const deduped: AdNamePlacement[] = [];

  for (const placement of placements) {
    const key = `${placement.campaign.platform ?? "meta"}:${
      placement.ad.adId ?? placement.ad.id
    }`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(placement);
  }

  return deduped;
}

function hasSharedCreativePlacementKey(
  first: string | null | undefined,
  second: string | null | undefined,
): boolean {
  const secondKeys = new Set(buildCreativePlacementKeys(second));

  return buildCreativePlacementKeys(first).some((key) => secondKeys.has(key));
}

function buildCreativePlacementKeys(
  value: string | null | undefined,
): string[] {
  const normalized = normalizeAdName(value);

  if (!normalized) {
    return [];
  }

  const keys = new Set<string>([normalized]);
  const extensionSuffix = normalized.match(/\.(?:mp4|mov|m4v|avi|webm)_(.+)$/);
  const creativeCode = normalized.match(/\b(veo_[a-z0-9]+_[a-z0-9]+)\b/);

  if (extensionSuffix?.[1]) {
    keys.add(extensionSuffix[1].trim());
  }

  if (creativeCode?.[1]) {
    keys.add(creativeCode[1]);
  }

  return [...keys].filter(Boolean);
}

function normalizeCreativeBrand(value: string | null | undefined): string {
  return (
    value
      ?.trim()
      .toLowerCase()
      .replace(/\b\d+(?:\.\d+)?\b/g, "")
      .replace(/[^a-z0-9]+/g, "") ?? ""
  );
}

function isMetaFallbackCandidate(placement: AdNamePlacement): boolean {
  return (placement.campaign.platform ?? "meta") === "meta";
}

function getAdNamePlacementCount(
  placements: Map<string, AdNamePlacement[]>,
  ad: CampaignHealthAdRow,
  campaign: CampaignHealthRow,
): number {
  return placements.get(buildAdNamePlacementKey(campaign, ad))?.length ?? 0;
}

function buildAdNamePlacementKey(
  campaign: CampaignHealthRow,
  ad: CampaignHealthAdRow,
): string {
  const normalizedAdName = normalizeAdName(ad.adName);

  if (!normalizedAdName) {
    return "";
  }

  return `${campaign.platform ?? "meta"}::${normalizedAdName}`;
}

function getAdReusePlacementPlatform(
  placements: AdNamePlacement[],
): CampaignPlatform {
  return placements[0]?.campaign.platform ?? "meta";
}

function buildAdMediaTargets(placements: AdNamePlacement[]): AdMediaTarget[] {
  const targets = new Map<string, AdMediaTarget>();

  for (const placement of placements) {
    const adId = placement.ad.adId?.trim();
    const platform = placement.campaign.platform ?? "meta";
    const targetKey = `${platform}:${adId}`;

    if (!adId || targets.has(targetKey)) {
      continue;
    }

    targets.set(targetKey, {
      adId,
      campaignLabel: `${placement.campaign.brand} / ${placement.campaign.campaignName}`,
      platform,
    });
  }

  return Array.from(targets.values());
}

function buildAdMediaTargetKey(target: AdMediaTarget): string {
  return `${target.platform}:${target.adId}`;
}

function getBestAdMediaSelection(
  targets: AdMediaTarget[],
  mediaByTargetKey: Record<string, AdMediaState>,
  sourcePlatform: CampaignPlatform,
): AdMediaSelection | null {
  let bestSelection: AdMediaSelection | null = null;

  for (const target of targets) {
    const state = mediaByTargetKey[buildAdMediaTargetKey(target)] ?? {
      error: null,
      isLoading: true,
      media: null,
    };
    const selection = { state, target };

    if (
      !bestSelection ||
      isBetterAdMediaSelection(selection, bestSelection, sourcePlatform)
    ) {
      bestSelection = selection;
      continue;
    }
  }

  return bestSelection;
}

function isBetterAdMediaSelection(
  candidate: AdMediaSelection,
  current: AdMediaSelection,
  sourcePlatform: CampaignPlatform,
): boolean {
  const candidateRank = getAdMediaAvailabilityRank(
    candidate.state,
    candidate.target.platform,
  );
  const currentRank = getAdMediaAvailabilityRank(
    current.state,
    current.target.platform,
  );

  if (candidateRank !== currentRank) {
    return candidateRank > currentRank;
  }

  if (
    sourcePlatform === "tiktok" &&
    candidate.target.platform === "meta" &&
    current.target.platform === "tiktok" &&
    currentRank <= 3 &&
    getAdMediaWatchUrl(candidate.state.media, candidate.target.platform)
  ) {
    return true;
  }

  if (
    candidate.target.platform === sourcePlatform &&
    current.target.platform !== sourcePlatform
  ) {
    return true;
  }

  return false;
}

function getAdMediaAvailabilityRank(
  state: AdMediaState,
  platform: CampaignPlatform,
): number {
  const media = state.media;
  const watchUrl = getAdMediaWatchUrl(media, platform);

  if (media?.thumbnailUrl && watchUrl) {
    return 5;
  }

  if (media?.thumbnailUrl) {
    return 4;
  }

  if (watchUrl) {
    return 3;
  }

  if (state.isLoading) {
    return 2;
  }

  if (media) {
    return 1;
  }

  return 0;
}

function getSecondaryAdMediaWatchAction({
  mediaByTargetKey,
  primaryTarget,
  sourcePlatform,
  targets,
}: {
  mediaByTargetKey: Record<string, AdMediaState>;
  primaryTarget: AdMediaTarget | undefined;
  sourcePlatform: CampaignPlatform;
  targets: AdMediaTarget[];
}): { label: string; url: string } | null {
  if (!primaryTarget || primaryTarget.platform === sourcePlatform) {
    return null;
  }

  for (const target of targets) {
    if (
      target.platform !== sourcePlatform ||
      buildAdMediaTargetKey(target) === buildAdMediaTargetKey(primaryTarget)
    ) {
      continue;
    }

    const media = mediaByTargetKey[buildAdMediaTargetKey(target)]?.media;
    const url = getAdMediaWatchUrl(media, target.platform);

    if (url) {
      return {
        label: getAdMediaWatchLabel(media, target.platform),
        url,
      };
    }
  }

  return null;
}

function getAdMediaWatchUrl(
  media: CampaignHealthAdMedia | null | undefined,
  platform: CampaignPlatform,
): string | null {
  if (!media) {
    return null;
  }

  if (platform === "tiktok") {
    return media.permalinkUrl ?? media.videoUrl;
  }

  const metaPermalinkUrl = normalizeFacebookUrl(media.permalinkUrl);

  if (metaPermalinkUrl) {
    return metaPermalinkUrl;
  }

  if (media.videoId) {
    return `https://www.facebook.com/watch/?v=${encodeURIComponent(
      media.videoId,
    )}`;
  }

  if (media.objectStoryId) {
    return `https://www.facebook.com/${encodeURIComponent(media.objectStoryId)}`;
  }

  if (media.embedUrl) {
    try {
      return normalizeFacebookUrl(
        new URL(media.embedUrl).searchParams.get("href"),
      );
    } catch {
      return null;
    }
  }

  return media.videoUrl;
}

function normalizeFacebookUrl(value: string | null | undefined): string | null {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized).toString();
  } catch {
    return new URL(
      normalized.replace(/^\/+/, ""),
      "https://www.facebook.com/",
    ).toString();
  }
}

function getAdMediaWatchLabel(
  media: CampaignHealthAdMedia | null | undefined,
  platform: CampaignPlatform,
): string {
  if (platform === "meta") {
    return "Watch on Meta";
  }

  return media?.permalinkUrl ? "Open in TikTok" : "Open video";
}

async function fetchAdMedia(
  adMediaApiUrl: string,
  target: AdMediaTarget,
): Promise<CampaignHealthAdMedia> {
  const separator = adMediaApiUrl.includes("?") ? "&" : "?";
  const params = new URLSearchParams({
    adId: target.adId,
    platform: target.platform,
  });
  const response = await fetch(
    `${adMediaApiUrl}${separator}${params.toString()}`,
    {
      cache: "no-store",
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error("Unable to load ad creative media.");
  }

  return (await response.json()) as CampaignHealthAdMedia;
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

function filterPlacementsByMetaStatus(
  placements: AdNamePlacement[],
  selectedMetaStatuses: CampaignMetaDeliveryStatus[],
): AdNamePlacement[] {
  if (selectedMetaStatuses.length === 0) {
    return placements;
  }

  const selectedMetaStatusSet = new Set(selectedMetaStatuses);

  return placements.filter((placement) =>
    selectedMetaStatusSet.has(getAdMetaStatus(placement.ad).id),
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

function getAdDeliveryStatus(
  ad: CampaignHealthAdRow,
  platform: CampaignPlatform,
): CampaignMetaStatus {
  return platform === "tiktok" ? getAdsetMetaStatus(ad) : getAdMetaStatus(ad);
}

function getAdsetMetaStatus(ad: CampaignHealthAdRow): CampaignMetaStatus {
  return (
    ad.adsetStatus ?? {
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

function summarizePlatformSelection(platforms: CampaignPlatform[]): string {
  if (platforms.length !== 1) {
    return "All platforms";
  }

  return platformLabel(platforms[0]);
}

function platformLabel(platform: CampaignPlatform): string {
  return platform === "tiktok" ? "TikTok" : "Meta";
}

function mergePlatformOptions(
  backendOptions: Array<{ id: string; label: string }> | undefined,
): Array<{ id: CampaignPlatform; label: string }> {
  const optionIds = new Set(
    backendOptions
      ?.map((option) => normalizePlatformParam(option.id))
      .filter((id): id is CampaignPlatform => id !== "all") ?? [],
  );

  return ALL_PLATFORM_OPTIONS.filter(
    (option) => optionIds.size === 0 || optionIds.has(option.id),
  );
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

function setRepeatedQueryValues(
  params: URLSearchParams,
  key: string,
  values: string[],
): void {
  params.delete(key);

  for (const value of values) {
    const normalized = value.trim();

    if (normalized) {
      params.append(key, normalized);
    }
  }
}

function normalizeGradeParams(values: string[]): CampaignHealthGrade[] {
  const selected = new Set<CampaignHealthGrade>();

  for (const value of values) {
    const normalized = value.trim().toUpperCase();

    if (isCampaignHealthGrade(normalized)) {
      selected.add(normalized);
    }
  }

  return ALL_GRADES.filter((grade) => selected.has(grade));
}

function normalizeMetaStatusParams(
  values: string[],
): CampaignMetaDeliveryStatus[] {
  const allowedStatuses = new Set<CampaignMetaDeliveryStatus>(
    ALL_META_STATUSES.map((status) => status.id),
  );
  const selected = new Set<CampaignMetaDeliveryStatus>();

  for (const value of values) {
    const normalized = value.trim().toLowerCase();

    if (allowedStatuses.has(normalized as CampaignMetaDeliveryStatus)) {
      selected.add(normalized as CampaignMetaDeliveryStatus);
    }
  }

  return ALL_META_STATUSES.map((status) => status.id).filter((status) =>
    selected.has(status),
  );
}

function normalizePlatformParam(
  value: string | null | undefined,
): HealthDashboardPlatform {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, " ");

  if (!normalized || normalized === "all" || normalized === "all platforms") {
    return "all";
  }

  if (normalized === "meta" || normalized === "facebook") {
    return "meta";
  }

  if (normalized === "tiktok" || normalized === "tik tok") {
    return "tiktok";
  }

  return "all";
}

function normalizePlatformIds(values: string[]): CampaignPlatform[] {
  const selected = new Set<CampaignPlatform>();

  for (const value of values) {
    const normalized = normalizePlatformParam(value);

    if (normalized !== "all") {
      selected.add(normalized);
    }
  }

  return ALL_PLATFORM_OPTIONS.map((option) => option.id).filter((platform) =>
    selected.has(platform),
  );
}

function isCampaignHealthGrade(value: string): value is CampaignHealthGrade {
  return (ALL_GRADES as string[]).includes(value);
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
