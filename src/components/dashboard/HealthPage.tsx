"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
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
import {
  constrainDateRangeDays,
  getCurrentMonthDateRange,
  isSameDateRange,
} from "@/src/utils/dateRangeDefaults";
import {
  appendHardRefreshQueryParam,
  appendHealthDashboardQueryParams,
  resolveDashboardAdMediaApiUrl,
  resolveHealthDashboardApiUrl,
  resolveSlackGradeMessageApiUrl,
} from "@/src/utils/runtimeApiUrls";
import { DashboardHeader } from "./DashboardHeader";
import { useDashboardHardRefresh } from "./DashboardHardRefresh";
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
    id: "Learning",
    label: "Learning",
  },
  {
    id: "Scale",
    label: "Scale",
  },
  {
    id: "Review",
    label: "Review",
  },
  {
    id: "Shut off",
    label: "Shut off",
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
const AUDIT_MAX_RANGE_DAYS = 30;
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

interface SlackGradeMessageRequest {
  grade: string;
  message: string;
  priority: SlackPriorityLevel;
  title?: string;
  videoReference: string;
}

type SlackPriorityLevel = "Normal" | "High" | "Urgent";

const SLACK_PRIORITY_OPTIONS: SlackPriorityLevel[] = [
  "Normal",
  "High",
  "Urgent",
];
const CAMPAIGN_START_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

interface ToggleExpandedRowOptions {
  autoExpanded?: boolean;
}

interface ActiveFilterChip {
  group: string;
  id: string;
  label: string;
  onRemove: () => void;
}

interface AdSummaryFilters {
  selectedAdGrades: CampaignHealthGrade[];
  selectedAdIds: string[];
  selectedAdMetaStatuses: CampaignMetaDeliveryStatus[];
  selectedAdRecommendations: CampaignHealthRecommendation[];
  selectedStates: string[];
}

export function HealthPage({ apiUrl }: HealthPageProps) {
  const { hardRefreshToken, trackHardRefresh } = useDashboardHardRefresh();
  const observedHardRefreshTokenRef = useRef(hardRefreshToken);
  const pendingHardRefreshTokenRef = useRef(0);
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
  const [hardRefreshReloadKey, setHardRefreshReloadKey] = useState(0);
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
  const [selectedAdRecommendations, setSelectedAdRecommendations] = useState<
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
  const [collapsedRows, setCollapsedRows] = useState<string[]>([]);
  const [selectedAdReuse, setSelectedAdReuse] =
    useState<SelectedAdReuse | null>(null);
  const adMediaApiUrl = useMemo(
    () => resolveDashboardAdMediaApiUrl(apiUrl),
    [apiUrl],
  );
  const slackMessageApiUrl = useMemo(
    () => resolveSlackGradeMessageApiUrl(apiUrl),
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
        selectedAdRecommendations,
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
      selectedAdRecommendations,
      selectedCampaignIds,
      selectedCampaignMetaStatuses,
      selectedRecommendations,
      selectedStates,
    ],
  );
  const rowsBeforeAdGradeFilter = useMemo(
    () =>
      filterHealthRows(data?.campaignRows ?? [], {
        selectedAdIds,
        selectedAdGrades: [],
        selectedAdMetaStatuses,
        selectedAdRecommendations,
        selectedCampaignIds,
        selectedGrades,
        selectedCampaignMetaStatuses,
        selectedRecommendations,
        selectedStates,
      }),
    [
      data,
      selectedAdIds,
      selectedAdMetaStatuses,
      selectedAdRecommendations,
      selectedCampaignIds,
      selectedCampaignMetaStatuses,
      selectedGrades,
      selectedRecommendations,
      selectedStates,
    ],
  );
  const rowsBeforeRecommendationFilter = useMemo(
    () =>
      filterHealthRows(data?.campaignRows ?? [], {
        selectedAdIds,
        selectedAdGrades,
        selectedAdMetaStatuses,
        selectedAdRecommendations,
        selectedCampaignIds,
        selectedGrades,
        selectedCampaignMetaStatuses,
        selectedRecommendations: [],
        selectedStates,
      }),
    [
      data,
      selectedAdIds,
      selectedAdGrades,
      selectedAdMetaStatuses,
      selectedAdRecommendations,
      selectedCampaignIds,
      selectedCampaignMetaStatuses,
      selectedGrades,
      selectedStates,
    ],
  );
  const rowsBeforeAdRecommendationFilter = useMemo(
    () =>
      filterHealthRows(data?.campaignRows ?? [], {
        selectedAdIds,
        selectedAdGrades,
        selectedAdMetaStatuses,
        selectedAdRecommendations: [],
        selectedCampaignIds,
        selectedGrades,
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
      selectedGrades,
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
        selectedAdRecommendations,
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
      selectedAdRecommendations,
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
    if (
      hardRefreshToken > 0 &&
      hardRefreshToken !== observedHardRefreshTokenRef.current
    ) {
      pendingHardRefreshTokenRef.current = hardRefreshToken;
      observedHardRefreshTokenRef.current = hardRefreshToken;
      setHardRefreshReloadKey((current) => current + 1);
      return;
    }

    observedHardRefreshTokenRef.current = hardRefreshToken;
  }, [hardRefreshToken]);

  useEffect(() => {
    if (!healthUrl) {
      setData(null);
      setError("Dashboard API URL is not configured.");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const forceRefreshToken = pendingHardRefreshTokenRef.current;
    const requestUrl = forceRefreshToken
      ? appendHardRefreshQueryParam(healthUrl)
      : healthUrl;
    const completeHardRefresh = forceRefreshToken
      ? trackHardRefresh(forceRefreshToken)
      : () => undefined;

    pendingHardRefreshTokenRef.current = 0;

    setIsLoading(true);
    setError(null);

    async function loadHealth() {
      try {
        const response = await fetch(requestUrl as string, {
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
        completeHardRefresh();
      }
    }

    void loadHealth();

    return () => controller.abort();
  }, [hardRefreshReloadKey, healthUrl, trackHardRefresh]);

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
      setSelectedAdRecommendations([]);
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
      setSelectedAdRecommendations([]);
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
      setSelectedAdRecommendations([]);
      setSelectedAdReuse(null);
    },
    [replaceParams],
  );
  const handleClearAllFilters = useCallback(() => {
    replaceParams((nextParams) => {
      nextParams.delete("brand");
      nextParams.delete("brands");
      nextParams.delete("platform");
      nextParams.delete("from");
      nextParams.delete("to");
      nextParams.delete("states");
      nextParams.delete("grades");
      nextParams.delete("adGrades");
      nextParams.delete("campaignStatuses");
      nextParams.delete("adStatuses");
    });
    setSelectedCampaignIds([]);
    setSelectedAdIds([]);
    setSelectedRecommendations([]);
    setSelectedAdRecommendations([]);
    setSelectedAdReuse(null);
  }, [replaceParams]);
  const activeFilterChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    const currentDefaultRange = constrainDateRangeDays(
      getCurrentMonthDateRange(),
      AUDIT_MAX_RANGE_DAYS,
    );

    if (!isSameDateRange(dateRange, currentDefaultRange)) {
      chips.push({
        group: "Date",
        id: "date-range",
        label: formatDateRangeChip(dateRange),
        onRemove: () => handleDateRangeChange({ from: null, to: null }),
      });
    }

    for (const platform of selectedPlatformIds) {
      chips.push({
        group: "Platform",
        id: `platform:${platform}`,
        label: getOptionLabel(platformOptions, platform),
        onRemove: () => handlePlatformChange([]),
      });
    }

    for (const brand of selectedBrands) {
      chips.push({
        group: "Brand",
        id: `brand:${brand}`,
        label: brand,
        onRemove: () =>
          handleBrandChange(selectedBrands.filter((value) => value !== brand)),
      });
    }

    appendSelectionChips({
      chips,
      group: "Campaign",
      onChange: setSelectedCampaignIds,
      options: campaignOptions,
      selectedIds: selectedCampaignIds,
    });
    appendSelectionChips({
      chips,
      group: "Ad",
      onChange: setSelectedAdIds,
      options: adOptions,
      selectedIds: selectedAdIds,
    });
    appendSelectionChips({
      chips,
      group: "Campaign grade",
      onChange: handleGradesChange,
      options: gradeOptions,
      selectedIds: selectedGrades,
    });
    appendSelectionChips({
      chips,
      group: "Ad grade",
      onChange: handleAdGradesChange,
      options: gradeOptions,
      selectedIds: selectedAdGrades,
    });
    appendSelectionChips({
      chips,
      group: "Campaign recommendation",
      onChange: (values) =>
        setSelectedRecommendations(values as CampaignHealthRecommendation[]),
      options: recommendationOptions,
      selectedIds: selectedRecommendations,
    });
    appendSelectionChips({
      chips,
      group: "Ad recommendation",
      onChange: (values) =>
        setSelectedAdRecommendations(
          values as CampaignHealthRecommendation[],
        ),
      options: recommendationOptions,
      selectedIds: selectedAdRecommendations,
    });
    appendSelectionChips({
      chips,
      group: "Campaign status",
      onChange: handleCampaignMetaStatusesChange,
      options: metaStatusOptions,
      selectedIds: selectedCampaignMetaStatuses,
    });
    appendSelectionChips({
      chips,
      group: "Ad status",
      onChange: handleAdMetaStatusesChange,
      options: metaStatusOptions,
      selectedIds: selectedAdMetaStatuses,
    });
    appendSelectionChips({
      chips,
      group: "State",
      onChange: handleStatesChange,
      options: stateOptions,
      selectedIds: selectedStates,
    });

    return chips;
  }, [
    adOptions,
    campaignOptions,
    dateRange,
    gradeOptions,
    handleAdGradesChange,
    handleAdMetaStatusesChange,
    handleBrandChange,
    handleCampaignMetaStatusesChange,
    handleDateRangeChange,
    handleGradesChange,
    handlePlatformChange,
    handleStatesChange,
    metaStatusOptions,
    platformOptions,
    recommendationOptions,
    selectedAdGrades,
    selectedAdIds,
    selectedAdMetaStatuses,
    selectedAdRecommendations,
    selectedBrands,
    selectedCampaignIds,
    selectedCampaignMetaStatuses,
    selectedGrades,
    selectedPlatformIds,
    selectedRecommendations,
    selectedStates,
    stateOptions,
  ]);
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
      selectedAdRecommendations,
      ALL_RECOMMENDATIONS.map((option) => option.id),
      (values) =>
        setSelectedAdRecommendations(
          values as CampaignHealthRecommendation[],
        ),
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
    selectedAdRecommendations,
    selectedCampaignIds,
    selectedCampaignMetaStatuses,
    selectedGrades,
    selectedRecommendations,
    selectedStates,
  ]);
  useEffect(() => {
    const visibleRowIds = new Set(filteredRows.map((row) => row.id));

    setExpandedRows((current) =>
      current.filter((id) => visibleRowIds.has(id)),
    );
    setCollapsedRows((current) =>
      current.filter((id) => visibleRowIds.has(id)),
    );
  }, [filteredRows]);
  const toggleExpandedRow = useCallback(
    (id: string, options: ToggleExpandedRowOptions = {}) => {
      if (options.autoExpanded) {
        setExpandedRows((current) =>
          current.filter((currentId) => currentId !== id),
        );
        setCollapsedRows((current) =>
          current.includes(id)
            ? current.filter((currentId) => currentId !== id)
            : [...current, id],
        );
        return;
      }

      setCollapsedRows((current) =>
        current.filter((currentId) => currentId !== id),
      );
      setExpandedRows((current) =>
        current.includes(id)
          ? current.filter((currentId) => currentId !== id)
          : [...current, id],
      );
    },
    [],
  );
  const openCampaignRows = useCallback((ids: string[]) => {
    if (ids.length === 0) {
      return;
    }

    const idsToOpen = new Set(ids);

    setCollapsedRows((current) =>
      current.filter((currentId) => !idsToOpen.has(currentId)),
    );
    setExpandedRows((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.add(id));

      return Array.from(next);
    });
  }, []);
  const collapseCampaignRows = useCallback(
    (ids: string[], autoExpandedIds: string[]) => {
      if (ids.length === 0) {
        return;
      }

      const idsToCollapse = new Set(ids);

      setExpandedRows((current) =>
        current.filter((currentId) => !idsToCollapse.has(currentId)),
      );
      setCollapsedRows((current) => {
        if (autoExpandedIds.length === 0) {
          return current;
        }

        const next = new Set(current);
        autoExpandedIds.forEach((id) => next.add(id));

        return Array.from(next);
      });
    },
    [],
  );
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
  const handleSummaryAdGradeToggle = useCallback(
    (grade: CampaignHealthGrade) => {
      handleAdGradesChange(
        selectedAdGrades.includes(grade)
          ? selectedAdGrades.filter((currentGrade) => currentGrade !== grade)
          : [...selectedAdGrades, grade],
      );
    },
    [handleAdGradesChange, selectedAdGrades],
  );
  const handleSummaryRecommendationToggle = useCallback(
    (recommendation: CampaignHealthRecommendation) => {
      setSelectedRecommendations(
        selectedRecommendations.includes(recommendation)
          ? selectedRecommendations.filter(
              (currentRecommendation) =>
                currentRecommendation !== recommendation,
            )
          : [...selectedRecommendations, recommendation],
      );
    },
    [selectedRecommendations],
  );
  const handleSummaryAdRecommendationToggle = useCallback(
    (recommendation: CampaignHealthRecommendation) => {
      setSelectedAdRecommendations(
        selectedAdRecommendations.includes(recommendation)
          ? selectedAdRecommendations.filter(
              (currentRecommendation) =>
                currentRecommendation !== recommendation,
            )
          : [...selectedAdRecommendations, recommendation],
      );
    },
    [selectedAdRecommendations],
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
      <div className="mx-auto flex w-full max-w-none flex-col gap-5">
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
            <div className="grid min-w-0 grid-cols-2 gap-2">
              <MultiSelectFilter
                disabled={dependentFiltersDisabled}
                label="Campaign recommendations"
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
                  "All campaign recommendations",
                  "campaign recommendations selected",
                )}
                withSearch={false}
              />
              <MultiSelectFilter
                disabled={dependentFiltersDisabled}
                label="Ad recommendations"
                loading={isRefreshingHealth}
                onChange={(values) =>
                  setSelectedAdRecommendations(
                    values as CampaignHealthRecommendation[],
                  )
                }
                options={recommendationOptions}
                selectedIds={selectedAdRecommendations}
                summary={summarizeSelection(
                  selectedAdRecommendations,
                  "All ad recommendations",
                  "ad recommendations selected",
                )}
                withSearch={false}
              />
            </div>
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
              maxRangeDays={AUDIT_MAX_RANGE_DAYS}
              onDateRangeChange={handleDateRangeChange}
            />
          </div>
          <ActiveFiltersBar
            chips={activeFilterChips}
            disabled={isLoading && !data}
            onClearAll={handleClearAllFilters}
          />
        </section>

        {isLoading && !data ? (
          <HealthLoadingPanel />
        ) : error && !data ? (
          <HealthErrorPanel message={error} />
        ) : data ? (
          <>
            {isRefreshingHealth ? <HealthRefreshNotice /> : null}
            {error ? <HealthInlineErrorNotice message={error} /> : null}
            <RefreshingRegion isRefreshing={isRefreshingHealth}>
              <HealthSummary
                adGradeCountRows={rowsBeforeAdGradeFilter}
                adRecommendationCountRows={rowsBeforeAdRecommendationFilter}
                campaignRecommendationCountRows={
                  rowsBeforeRecommendationFilter
                }
                disabled={dependentFiltersDisabled}
                gradeCountRows={rowsBeforeGradeFilter}
                onClearAdGrades={() => handleAdGradesChange([])}
                onClearAdRecommendations={() =>
                  setSelectedAdRecommendations([])
                }
                onClearGrades={() => handleGradesChange([])}
                onClearRecommendations={() => setSelectedRecommendations([])}
                onToggleAdRecommendation={handleSummaryAdRecommendationToggle}
                onToggleAdGrade={handleSummaryAdGradeToggle}
                onToggleGrade={handleSummaryGradeToggle}
                onToggleRecommendation={handleSummaryRecommendationToggle}
                rows={filteredRows}
                selectedAdGrades={selectedAdGrades}
                selectedAdIds={selectedAdIds}
                selectedAdMetaStatuses={selectedAdMetaStatuses}
                selectedAdRecommendations={selectedAdRecommendations}
                selectedGrades={selectedGrades}
                selectedRecommendations={selectedRecommendations}
                selectedStates={selectedStates}
                totalRows={rowsBeforeGradeFilter.length}
              />
            </RefreshingRegion>
            <RefreshingRegion isRefreshing={isRefreshingHealth}>
              <HealthTable
                adMediaApiUrl={adMediaApiUrl}
                adNamePlacements={adNamePlacements}
                collapsedRows={collapsedRows}
                dateRange={dateRange}
                expandedRows={expandedRows}
                isRefreshing={isRefreshingHealth}
                onCollapseAllRows={collapseCampaignRows}
                onOpenAdReuse={handleOpenAdReuse}
                onOpenAllRows={openCampaignRows}
                onToggleExpandedRow={toggleExpandedRow}
                rampUpDays={data.thresholds.rampUp.minimumCampaignAgeDays}
                rows={filteredRows}
                selectedAdIds={selectedAdIds}
                selectedAdGrades={selectedAdGrades}
                selectedAdMetaStatuses={selectedAdMetaStatuses}
                selectedAdRecommendations={selectedAdRecommendations}
                selectedStates={selectedStates}
                slackMessageApiUrl={slackMessageApiUrl}
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

function ActiveFiltersBar({
  chips,
  disabled,
  onClearAll,
}: {
  chips: ActiveFilterChip[];
  disabled: boolean;
  onClearAll: () => void;
}) {
  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-800">
            Active filters
          </h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
            {chips.length}
          </span>
        </div>
        <button
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled || chips.length === 0}
          onClick={onClearAll}
          type="button"
        >
          Clear all
        </button>
      </div>
      {chips.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              className="inline-flex max-w-full overflow-hidden rounded-md border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-700"
              key={chip.id}
            >
              <span className="shrink-0 border-r border-slate-200 bg-white/70 px-2 py-1 uppercase tracking-wide text-slate-500">
                {chip.group}
              </span>
              <span className="min-w-0 truncate px-2 py-1" title={chip.label}>
                {chip.label}
              </span>
              <button
                aria-label={`Remove ${chip.group} filter ${chip.label}`}
                className="shrink-0 border-l border-slate-200 px-2 py-1 text-slate-500 transition hover:bg-white hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={disabled}
                onClick={chip.onRemove}
                type="button"
              >
                x
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm font-medium text-slate-500">
          No active filters
        </p>
      )}
    </div>
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
  adGradeCountRows,
  adRecommendationCountRows,
  campaignRecommendationCountRows,
  disabled,
  gradeCountRows,
  onClearAdGrades,
  onClearAdRecommendations,
  onClearGrades,
  onClearRecommendations,
  onToggleAdGrade,
  onToggleAdRecommendation,
  onToggleGrade,
  onToggleRecommendation,
  rows,
  selectedAdGrades,
  selectedAdIds,
  selectedAdMetaStatuses,
  selectedAdRecommendations,
  selectedGrades,
  selectedRecommendations,
  selectedStates,
  totalRows,
}: {
  adGradeCountRows: CampaignHealthRow[];
  adRecommendationCountRows: CampaignHealthRow[];
  campaignRecommendationCountRows: CampaignHealthRow[];
  disabled: boolean;
  gradeCountRows: CampaignHealthRow[];
  onClearAdGrades: () => void;
  onClearAdRecommendations: () => void;
  onClearGrades: () => void;
  onClearRecommendations: () => void;
  onToggleAdGrade: (grade: CampaignHealthGrade) => void;
  onToggleAdRecommendation: (
    recommendation: CampaignHealthRecommendation,
  ) => void;
  onToggleGrade: (grade: CampaignHealthGrade) => void;
  onToggleRecommendation: (
    recommendation: CampaignHealthRecommendation,
  ) => void;
  rows: CampaignHealthRow[];
  selectedAdGrades: CampaignHealthGrade[];
  selectedAdIds: string[];
  selectedAdMetaStatuses: CampaignMetaDeliveryStatus[];
  selectedAdRecommendations: CampaignHealthRecommendation[];
  selectedGrades: CampaignHealthGrade[];
  selectedRecommendations: CampaignHealthRecommendation[];
  selectedStates: string[];
  totalRows: number;
}) {
  const counts = countGrades(gradeCountRows);
  const adCounts = countAdGrades(adGradeCountRows, {
    selectedAdIds,
    selectedAdGrades: [],
    selectedAdMetaStatuses,
    selectedAdRecommendations,
    selectedStates,
  });
  const recommendationCounts = countRecommendations(
    campaignRecommendationCountRows,
  );
  const adRecommendationCounts = countAdRecommendations(
    adRecommendationCountRows,
    {
      selectedAdIds,
      selectedAdGrades,
      selectedAdMetaStatuses,
      selectedAdRecommendations: [],
      selectedStates,
    },
  );
  const visibleAdCount = countMatchingAds(rows, {
    selectedAdIds,
    selectedAdGrades,
    selectedAdMetaStatuses,
    selectedAdRecommendations,
    selectedStates,
  });
  const totalAdCount = countMatchingAds(adGradeCountRows, {
    selectedAdIds,
    selectedAdGrades: [],
    selectedAdMetaStatuses,
    selectedAdRecommendations,
    selectedStates,
  });
  const visibleAdRecommendationCount = countMatchingAds(rows, {
    selectedAdIds,
    selectedAdGrades,
    selectedAdMetaStatuses,
    selectedAdRecommendations,
    selectedStates,
  });
  const totalAdRecommendationCount = countMatchingAds(
    adRecommendationCountRows,
    {
      selectedAdIds,
      selectedAdGrades,
      selectedAdMetaStatuses,
      selectedAdRecommendations: [],
      selectedStates,
    },
  );
  const selectedGradeSet = new Set(selectedGrades);
  const selectedAdGradeSet = new Set(selectedAdGrades);
  const selectedRecommendationSet = new Set(selectedRecommendations);
  const selectedAdRecommendationSet = new Set(selectedAdRecommendations);

  return (
    <section className="space-y-3">
      <SummaryGradeRow
        counts={counts}
        disabled={disabled}
        onClearGrades={onClearGrades}
        onToggleGrade={onToggleGrade}
        selectedGradeSet={selectedGradeSet}
        title="Campaign grades"
        visibleIsActive={selectedGrades.length === 0}
        visibleValue={`${rows.length}/${totalRows}`}
      />
      <SummaryGradeRow
        counts={adCounts}
        disabled={disabled}
        onClearGrades={onClearAdGrades}
        onToggleGrade={onToggleAdGrade}
        selectedGradeSet={selectedAdGradeSet}
        title="Ad grades"
        visibleIsActive={selectedAdGrades.length === 0}
        visibleValue={`${visibleAdCount}/${totalAdCount}`}
      />
      <SummaryRecommendationRow
        counts={recommendationCounts}
        disabled={disabled}
        onClearRecommendations={onClearRecommendations}
        onToggleRecommendation={onToggleRecommendation}
        selectedRecommendationSet={selectedRecommendationSet}
        title="Campaign recommendations"
        visibleIsActive={selectedRecommendations.length === 0}
        visibleValue={`${rows.length}/${campaignRecommendationCountRows.length}`}
      />
      <SummaryRecommendationRow
        counts={adRecommendationCounts}
        disabled={disabled}
        onClearRecommendations={onClearAdRecommendations}
        onToggleRecommendation={onToggleAdRecommendation}
        selectedRecommendationSet={selectedAdRecommendationSet}
        title="Ad recommendations"
        visibleIsActive={selectedAdRecommendations.length === 0}
        visibleValue={`${visibleAdRecommendationCount}/${totalAdRecommendationCount}`}
      />
    </section>
  );
}

function SummaryGradeRow({
  counts,
  disabled,
  onClearGrades,
  onToggleGrade,
  selectedGradeSet,
  title,
  visibleIsActive,
  visibleValue,
}: {
  counts: Partial<Record<CampaignHealthGrade, number>>;
  disabled: boolean;
  onClearGrades: () => void;
  onToggleGrade: (grade: CampaignHealthGrade) => void;
  selectedGradeSet: Set<CampaignHealthGrade>;
  title: string;
  visibleIsActive: boolean;
  visibleValue: string;
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      <div className="grid gap-3 md:grid-cols-6">
        <SummaryTile
          active={visibleIsActive}
          disabled={disabled}
          label="Visible"
          onClick={onClearGrades}
          value={visibleValue}
        />
        {ALL_GRADES.map((grade) => (
          <SummaryTile
            active={selectedGradeSet.has(grade)}
            disabled={
              disabled ||
              ((counts[grade] ?? 0) === 0 && !selectedGradeSet.has(grade))
            }
            grade={grade}
            key={grade}
            label={grade}
            onClick={() => onToggleGrade(grade)}
            value={String(counts[grade] ?? 0)}
          />
        ))}
      </div>
    </div>
  );
}

function SummaryRecommendationRow({
  counts,
  disabled,
  onClearRecommendations,
  onToggleRecommendation,
  selectedRecommendationSet,
  title,
  visibleIsActive,
  visibleValue,
}: {
  counts: Partial<Record<CampaignHealthRecommendation, number>>;
  disabled: boolean;
  onClearRecommendations: () => void;
  onToggleRecommendation: (
    recommendation: CampaignHealthRecommendation,
  ) => void;
  selectedRecommendationSet: Set<CampaignHealthRecommendation>;
  title: string;
  visibleIsActive: boolean;
  visibleValue: string;
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      <div className="grid gap-3 md:grid-cols-5">
        <SummaryTile
          active={visibleIsActive}
          disabled={disabled}
          label="Visible"
          onClick={onClearRecommendations}
          value={visibleValue}
        />
        {ALL_RECOMMENDATIONS.map((recommendation) => (
          <SummaryTile
            active={selectedRecommendationSet.has(recommendation.id)}
            disabled={
              disabled ||
              ((counts[recommendation.id] ?? 0) === 0 &&
                !selectedRecommendationSet.has(recommendation.id))
            }
            key={recommendation.id}
            label={recommendation.label}
            onClick={() => onToggleRecommendation(recommendation.id)}
            recommendation={recommendation.id}
            value={String(counts[recommendation.id] ?? 0)}
          />
        ))}
      </div>
    </div>
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
  grade,
  label,
  onClick,
  recommendation,
  value,
}: {
  active?: boolean;
  disabled?: boolean;
  grade?: CampaignHealthGrade;
  label: ReactNode;
  onClick?: () => void;
  recommendation?: CampaignHealthRecommendation;
  value: string;
}) {
  const isInteractive = Boolean(onClick);
  const colorClasses = grade
    ? gradeClasses[grade]
    : recommendation
      ? recommendationClasses[recommendation]
      : null;
  const buttonClasses = colorClasses
    ? `${colorClasses} ${
        active
          ? "ring-2 ring-offset-1 ring-current/20"
          : "hover:border-current hover:shadow-md"
      }`
    : `bg-white ${
        active
          ? "border-teal-300 ring-1 ring-teal-200"
          : "border-slate-200 hover:border-teal-300 hover:shadow-md"
      }`;
  const disabledClasses = disabled
    ? "cursor-not-allowed opacity-50 hover:border-slate-200 hover:shadow-sm"
    : "";

  return (
    <button
      aria-pressed={isInteractive ? active : undefined}
      className={`rounded-lg border p-3 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${buttonClasses} ${disabledClasses}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${
          grade || recommendation ? "text-current opacity-80" : "text-slate-500"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold ${
          grade || recommendation ? "text-current" : "text-slate-950"
        }`}
      >
        {value}
      </p>
    </button>
  );
}

function HealthTable({
  adMediaApiUrl,
  adNamePlacements,
  collapsedRows,
  dateRange,
  expandedRows,
  isRefreshing,
  onCollapseAllRows,
  onOpenAdReuse,
  onOpenAllRows,
  onToggleExpandedRow,
  rampUpDays,
  rows,
  selectedAdIds,
  selectedAdGrades,
  selectedAdMetaStatuses,
  selectedAdRecommendations,
  selectedStates,
  slackMessageApiUrl,
}: {
  adMediaApiUrl?: string;
  adNamePlacements: Map<string, AdNamePlacement[]>;
  collapsedRows: string[];
  dateRange: DashboardDateRange;
  expandedRows: string[];
  isRefreshing: boolean;
  onCollapseAllRows: (ids: string[], autoExpandedIds: string[]) => void;
  onOpenAdReuse: (ad: CampaignHealthAdRow, campaign: CampaignHealthRow) => void;
  onOpenAllRows: (ids: string[]) => void;
  onToggleExpandedRow: (id: string, options?: ToggleExpandedRowOptions) => void;
  rampUpDays: number;
  rows: CampaignHealthRow[];
  selectedAdIds: string[];
  selectedAdGrades: CampaignHealthGrade[];
  selectedAdMetaStatuses: CampaignMetaDeliveryStatus[];
  selectedAdRecommendations: CampaignHealthRecommendation[];
  selectedStates: string[];
  slackMessageApiUrl?: string;
}) {
  const expandedSet = new Set(expandedRows);
  const collapsedSet = new Set(collapsedRows);
  const selectedAdSet = new Set(selectedAdIds);
  const selectedAdGradeSet = new Set(selectedAdGrades);
  const selectedAdMetaStatusSet = new Set(selectedAdMetaStatuses);
  const selectedAdRecommendationSet = new Set(selectedAdRecommendations);
  const selectedStateSet = new Set(selectedStates);
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
        accessorKey: "cpsl",
        header: "Overall CPSL",
        id: "overallCpsl",
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "inStateSignedLeads",
        header: "In-State SL",
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "oosSignedLeads",
        header: "OOS SL",
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "oosCpsl",
        header: "OOS CPSL",
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorFn: (row) => row.metricHealth.cpsl.value,
        header: "In-State CPSL",
        id: "inStateCpsl",
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
      {
        accessorKey: "droppedLeads",
        header: "Drop",
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "averageLeadAgeDays",
        header: "Lead Age",
        id: "leadAgeDays",
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        accessorKey: "averageLeadActualAge",
        header: "Age avg",
        id: "actualAge",
        sortDescFirst: true,
        sortingFn: nullableNumberSortingFn,
      },
      {
        enableSorting: false,
        header: "Genders",
        id: "genders",
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
  const tableRows = table.getRowModel().rows;
  const hasAdScopedFilter =
    selectedAdSet.size > 0 ||
    selectedAdGradeSet.size > 0 ||
    selectedAdMetaStatusSet.size > 0 ||
    selectedAdRecommendationSet.size > 0 ||
    selectedStateSet.size > 0;
  const getRowExpansionState = (row: CampaignHealthRow) => {
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
          ) &&
          adMatchesSelectedRecommendation(ad, selectedAdRecommendationSet) &&
          adMatchesSelectedStates(ad, selectedStateSet),
      );
    const isAutoExpanded = autoExpanded && !collapsedSet.has(row.id);

    return {
      autoExpanded,
      isExpanded: expandedSet.has(row.id) || isAutoExpanded,
    };
  };
  const visibleCampaignExpansion = tableRows.map((tableRow) => {
    const row = tableRow.original;
    const { autoExpanded, isExpanded } = getRowExpansionState(row);

    return {
      autoExpanded,
      id: row.id,
      isExpanded,
      row,
    };
  });
  const visibleCampaignIds = visibleCampaignExpansion.map(({ id }) => id);
  const visibleAutoExpandedCampaignIds = visibleCampaignExpansion
    .filter(({ autoExpanded }) => autoExpanded)
    .map(({ id }) => id);
  const allVisibleRowsExpanded =
    visibleCampaignExpansion.length > 0 &&
    visibleCampaignExpansion.every(({ isExpanded }) => isExpanded);
  const bulkExpansionLabel = allVisibleRowsExpanded
    ? "Collapse all"
    : "Open all";
  const bulkExpansionTitle = allVisibleRowsExpanded
    ? "Collapse all visible campaigns"
    : "Open all visible campaigns";

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-950">
            Campaign audit
          </h2>
          <button
            aria-label={bulkExpansionTitle}
            className="ml-auto inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isRefreshing || visibleCampaignIds.length === 0}
            onClick={() =>
              allVisibleRowsExpanded
                ? onCollapseAllRows(
                    visibleCampaignIds,
                    visibleAutoExpandedCampaignIds,
                  )
                : onOpenAllRows(visibleCampaignIds)
            }
            title={bulkExpansionTitle}
            type="button"
          >
            {bulkExpansionLabel}
          </button>
        </div>
      </div>
      <div className="max-w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-[0.8125rem]">
          <colgroup>
            <col className="w-[2.5%]" />
            <col className="w-[4.5%]" />
            <col className="w-[3.5%]" />
            <col className="w-[7%]" />
            <col className="w-[3.5%]" />
            <col className="w-[3.8%]" />
            <col className="w-[3%]" />
            <col className="w-[4.5%]" />
            <col className="w-[6%]" />
            <col className="w-[4%]" />
            <col className="w-[3.4%]" />
            <col className="w-[3.4%]" />
            <col className="w-[5%]" />
            <col className="w-[3.8%]" />
            <col className="w-[3.4%]" />
            <col className="w-[4.2%]" />
            <col className="w-[4.2%]" />
            <col className="w-[3.8%]" />
            <col className="w-[3.8%]" />
            <col className="w-[3.8%]" />
            <col className="w-[3.4%]" />
            <col className="w-[3.7%]" />
            <col className="w-[3.7%]" />
            <col className="w-[5.8%]" />
          </colgroup>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const headerTitle = getCampaignHeaderTitle(header.column.id);

                  return (
                    <th
                      className={getCampaignHeaderClassName(header.column.id)}
                      key={header.id}
                      title={headerTitle}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          className={`flex w-full items-center gap-1 text-left font-semibold transition hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${getCampaignHeaderButtonClassName(
                            header.column.id,
                          )}`}
                          onClick={header.column.getToggleSortingHandler()}
                          title={headerTitle}
                          type="button"
                        >
                          <span className="min-w-0 whitespace-normal break-words leading-tight">
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
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleCampaignExpansion.length > 0 ? (
              visibleCampaignExpansion.map(
                ({ autoExpanded, isExpanded, row }) => (
                  <HealthTableRow
                    adMediaApiUrl={adMediaApiUrl}
                    adNamePlacements={adNamePlacements}
                    columnCount={columns.length}
                    dateRange={dateRange}
                    isExpanded={isExpanded}
                    isAutoExpanded={autoExpanded}
                    isRefreshing={isRefreshing}
                    key={row.id}
                    onOpenAdReuse={onOpenAdReuse}
                    onToggleExpandedRow={onToggleExpandedRow}
                    rampUpDays={rampUpDays}
                    row={row}
                    selectedAdIds={selectedAdIds}
                    selectedAdGrades={selectedAdGrades}
                    selectedAdMetaStatuses={selectedAdMetaStatuses}
                    selectedAdRecommendations={selectedAdRecommendations}
                    selectedStates={selectedStates}
                    slackMessageApiUrl={slackMessageApiUrl}
                  />
                ),
              )
            ) : (
              <tr>
                <td
                  className="px-4 py-10 text-center text-slate-500"
                  colSpan={columns.length}
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
  adMediaApiUrl,
  adNamePlacements,
  columnCount,
  dateRange,
  isExpanded,
  isAutoExpanded,
  isRefreshing,
  onOpenAdReuse,
  onToggleExpandedRow,
  rampUpDays,
  row,
  selectedAdIds,
  selectedAdGrades,
  selectedAdMetaStatuses,
  selectedAdRecommendations,
  selectedStates,
  slackMessageApiUrl,
}: {
  adMediaApiUrl?: string;
  adNamePlacements: Map<string, AdNamePlacement[]>;
  columnCount: number;
  dateRange: DashboardDateRange;
  isExpanded: boolean;
  isAutoExpanded: boolean;
  isRefreshing: boolean;
  onOpenAdReuse: (ad: CampaignHealthAdRow, campaign: CampaignHealthRow) => void;
  onToggleExpandedRow: (id: string, options?: ToggleExpandedRowOptions) => void;
  rampUpDays: number;
  row: CampaignHealthRow;
  selectedAdIds: string[];
  selectedAdGrades: CampaignHealthGrade[];
  selectedAdMetaStatuses: CampaignMetaDeliveryStatus[];
  selectedAdRecommendations: CampaignHealthRecommendation[];
  selectedStates: string[];
  slackMessageApiUrl?: string;
}) {
  const activePeriod = formatActivePeriod(row);
  const activePeriodTitle = activePeriod === "-" ? undefined : activePeriod;
  const campaignMetaStatus = getRowMetaStatus(row);
  const showRampUpBadge = row.isRampUp && campaignMetaStatus.id === "on";

  return (
    <>
      <tr className="align-top transition hover:bg-slate-50">
        <td className="px-2 py-3">
          <button
            aria-expanded={isExpanded}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-sm font-bold text-slate-600 transition hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() =>
              onToggleExpandedRow(row.id, { autoExpanded: isAutoExpanded })
            }
            disabled={isRefreshing}
            title={isExpanded ? "Hide ads" : "Show ads"}
            type="button"
          >
            {isExpanded ? "−" : "+"}
          </button>
        </td>
        <td className="break-words px-2 py-3 font-medium text-slate-900">
          {row.brand}
        </td>
        <td className="px-2 py-3">
          <PlatformChip platform={row.platform ?? "meta"} />
        </td>
        <td className="min-w-0 px-2 py-3">
          <div
            className="line-clamp-2 font-semibold text-slate-950 [overflow-wrap:anywhere]"
            title={row.campaignName}
          >
            {row.campaignName}
          </div>
          <div
            className="mt-1 truncate text-xs text-slate-500"
            title={row.campaignId ?? "CRM-only campaign"}
          >
            {row.campaignId ?? "CRM-only campaign"}
          </div>
          {showRampUpBadge ? (
            <div className="mt-2 inline-flex max-w-full rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800">
              Ramp-up active day {formatNumber(row.activeDays)} of{" "}
              {formatNumber(rampUpDays)}
            </div>
          ) : null}
        </td>
        <td className="px-2 py-3 text-right">
          <span
            className="inline-block font-medium text-slate-900"
            title={activePeriodTitle}
          >
            {formatNumber(row.activeDays)}
          </span>
        </td>
        <td className="px-2 py-3">
          <MetaStatusChip status={campaignMetaStatus} />
        </td>
        <td className="px-2 py-3">
          <GradeChip grade={row.grade} />
        </td>
        <td className="px-2 py-3">
          <ConfidenceChip confidence={row.confidence} />
        </td>
        <td className="break-words px-2 py-3">
          <RecommendationChip recommendation={row.recommendation} />
        </td>
        <td className="px-2 py-3 text-right font-semibold text-slate-950">
          {formatCurrency(row.spend)}
        </td>
        <td className="px-2 py-3 text-right font-semibold text-slate-950">
          {formatNumber(row.leads)}
        </td>
        <td className="px-2 py-3 text-right font-semibold text-slate-950">
          {formatNumber(row.signedLeads)}
        </td>
        <td className="px-2 py-3 text-right font-semibold text-slate-950">
          {formatCurrency(row.cpsl)}
        </td>
        <td className="px-2 py-3 text-right font-semibold text-slate-950">
          {formatNumber(row.inStateSignedLeads)}
        </td>
        <td className="px-2 py-3 text-right font-semibold text-slate-950">
          {formatNumber(row.oosSignedLeads)}
        </td>
        <td className="px-2 py-3 text-right font-semibold text-slate-950">
          {formatCurrency(row.oosCpsl)}
        </td>
        <td className="px-2 py-3">
          <MetricChip metric={row.metricHealth.cpsl} variant="currency" />
        </td>
        <td className="px-2 py-3">
          <MetricChip metric={row.metricHealth.volume} variant="currency" />
        </td>
        <td className="px-2 py-3">
          <MetricChip
            formatValue={formatPositiveQualityValue}
            metric={row.metricHealth.quality}
            variant="percentage"
          />
        </td>
        <td className="px-2 py-3">
          <MetricChip metric={row.metricHealth.intake} variant="percentage" />
        </td>
        <td className="px-2 py-3 text-right font-semibold text-slate-950">
          {formatNumber(row.droppedLeads)}
        </td>
        <td className="px-2 py-3 text-right font-semibold text-slate-950">
          {formatAverageDays(row.averageLeadAgeDays)}
        </td>
        <td className="px-2 py-3 text-right font-semibold text-slate-950">
          {formatAverageYears(row.averageLeadActualAge)}
        </td>
        <td
          className="px-2 py-3 text-left font-medium text-slate-700"
          title={formatGenderCounts(row.genderCounts, { compact: false })}
        >
          <GenderCountsStack counts={row.genderCounts} />
        </td>
      </tr>
      {isExpanded ? (
        <tr className="bg-slate-50/70">
          <td className="px-4 py-3" />
          <td className="px-4 py-3" colSpan={columnCount - 1}>
            <div className="space-y-3">
              <QualitySignalsPanel signals={row.qualitySignals} />
              <AdDetailTable
                adMediaApiUrl={adMediaApiUrl}
                adNamePlacements={adNamePlacements}
                ads={row.ads}
                campaign={row}
                dateRange={dateRange}
                onOpenAdReuse={onOpenAdReuse}
                selectedAdIds={selectedAdIds}
                selectedAdGrades={selectedAdGrades}
                selectedAdMetaStatuses={selectedAdMetaStatuses}
                selectedAdRecommendations={selectedAdRecommendations}
                selectedStates={selectedStates}
                slackMessageApiUrl={slackMessageApiUrl}
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
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide opacity-80">
            <span>{signal.label}</span>
            <QualitySignalInfoIcon formula={getQualitySignalFormula(signal)} />
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

function QualitySignalInfoIcon({ formula }: { formula: string }) {
  return (
    <span
      aria-label={formula}
      className="inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full border border-current text-[0.6rem] font-bold normal-case leading-none opacity-80"
      role="img"
      title={formula}
    >
      i
    </span>
  );
}

function AdDetailTable({
  adMediaApiUrl,
  adNamePlacements,
  ads,
  campaign,
  dateRange,
  onOpenAdReuse,
  selectedAdIds,
  selectedAdGrades,
  selectedAdMetaStatuses,
  selectedAdRecommendations,
  selectedStates,
  slackMessageApiUrl,
}: {
  adMediaApiUrl?: string;
  adNamePlacements: Map<string, AdNamePlacement[]>;
  ads: CampaignHealthAdRow[];
  campaign: CampaignHealthRow;
  dateRange: DashboardDateRange;
  onOpenAdReuse: (ad: CampaignHealthAdRow, campaign: CampaignHealthRow) => void;
  selectedAdIds: string[];
  selectedAdGrades: CampaignHealthGrade[];
  selectedAdMetaStatuses: CampaignMetaDeliveryStatus[];
  selectedAdRecommendations: CampaignHealthRecommendation[];
  selectedStates: string[];
  slackMessageApiUrl?: string;
}) {
  const visibleAds = useMemo(() => {
    const selectedAdIdSet = new Set(selectedAdIds);
    const selectedAdGradeSet = new Set(selectedAdGrades);
    const selectedAdMetaStatusSet = new Set(selectedAdMetaStatuses);
    const selectedAdRecommendationSet = new Set(selectedAdRecommendations);
    const selectedStateSet = new Set(selectedStates);

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

      if (!adMatchesSelectedRecommendation(ad, selectedAdRecommendationSet)) {
        return false;
      }

      if (!adMatchesSelectedStates(ad, selectedStateSet)) {
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
    selectedAdRecommendations,
    selectedStates,
  ]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedSlackAd, setSelectedSlackAd] =
    useState<CampaignHealthAdRow | null>(null);
  const isTikTokCampaign = campaign.platform === "tiktok";
  const showAdGroupColumn = isTikTokCampaign;
  const showAdStatusColumn = !isTikTokCampaign;
  const showSlackColumn = visibleAds.length > 0;
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
        {
          accessorKey: "recommendation",
          header: "Recommendation",
          sortDescFirst: true,
          sortingFn: adRecommendationSortingFn,
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
          accessorKey: "activeDays",
          header: "Age days",
          sortDescFirst: true,
          sortingFn: nullableAdNumberSortingFn,
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
          header: "Overall CPSL",
          id: "overallCpsl",
          sortingFn: nullableAdNumberSortingFn,
        },
        {
          accessorKey: "inStateSignedLeads",
          header: "In-State SL",
          sortDescFirst: true,
          sortingFn: nullableAdNumberSortingFn,
        },
        {
          accessorKey: "oosSignedLeads",
          header: "OOS SL",
          sortDescFirst: true,
          sortingFn: nullableAdNumberSortingFn,
        },
        {
          accessorKey: "oosCpsl",
          header: "OOS CPSL",
          sortingFn: nullableAdNumberSortingFn,
        },
        {
          accessorFn: (row) => row.metricHealth.cpsl.value,
          header: "In-State CPSL",
          id: "inStateCpsl",
          sortingFn: nullableAdNumberSortingFn,
        },
        {
          accessorFn: (row) => row.metricHealth.volume.value,
          header: "Volume",
          id: "volume",
          sortingFn: nullableAdNumberSortingFn,
        },
        {
          accessorFn: (row) => row.metricHealth.attribution.value,
          header: "Quality",
          id: "quality",
          sortDescFirst: true,
          sortingFn: nullableAdNumberSortingFn,
        },
        {
          accessorFn: (row) => row.metricHealth.intake.value,
          header: "Int. Conv.",
          id: "intake",
          sortDescFirst: true,
          sortingFn: nullableAdNumberSortingFn,
        },
        {
          accessorKey: "droppedLeads",
          header: "Drop",
          sortDescFirst: true,
          sortingFn: nullableAdNumberSortingFn,
        },
      );

      if (showSlackColumn) {
        nextColumns.push({
          enableSorting: false,
          header: "Slack",
          id: "slack",
        });
      }

      return nextColumns;
    },
    [showAdGroupColumn, showAdStatusColumn, showSlackColumn],
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
    <>
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <table className="w-full table-fixed text-xs">
        {showSlackColumn ? (
          <colgroup>
            <col className="w-[8.5%]" />
            <col className="w-[3.8%]" />
            <col className="w-[6.5%]" />
            <col className="w-[4.8%]" />
            <col className="w-[6.3%]" />
            <col className="w-[3.6%]" />
            <col className="w-[5%]" />
            <col className="w-[3.8%]" />
            <col className="w-[3.4%]" />
            <col className="w-[4.3%]" />
            <col className="w-[5%]" />
            <col className="w-[4.8%]" />
            <col className="w-[4.3%]" />
            <col className="w-[5%]" />
            <col className="w-[5.3%]" />
            <col className="w-[4.8%]" />
            <col className="w-[4.8%]" />
            <col className="w-[4.8%]" />
            <col className="w-[5.4%]" />
            <col className="w-[5.3%]" />
          </colgroup>
        ) : (
          <colgroup>
            <col className="w-[8.5%]" />
            <col className="w-[4.3%]" />
            <col className="w-[6.5%]" />
            <col className="w-[5.5%]" />
            <col className="w-[6%]" />
            <col className="w-[3.8%]" />
            <col className="w-[5%]" />
            <col className="w-[4.2%]" />
            <col className="w-[3.8%]" />
            <col className="w-[4.8%]" />
            <col className="w-[5.2%]" />
            <col className="w-[5.2%]" />
            <col className="w-[4.8%]" />
            <col className="w-[5.2%]" />
            <col className="w-[5.2%]" />
            <col className="w-[5.2%]" />
            <col className="w-[5.2%]" />
            <col className="w-[5%]" />
            <col className="w-[5.8%]" />
          </colgroup>
        )}
        <thead className="bg-white text-xs uppercase tracking-wide text-slate-500">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const headerTitle = getAdHeaderTitle(header.column.id);

                return (
                  <th
                    className={getAdHeaderClassName(header.column.id)}
                    key={header.id}
                    title={headerTitle}
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        className={`flex w-full items-center gap-1 text-left font-semibold transition hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${getAdHeaderButtonClassName(
                          header.column.id,
                        )}`}
                        onClick={header.column.getToggleSortingHandler()}
                        title={headerTitle}
                        type="button"
                      >
                        <span className="min-w-0 whitespace-normal break-words leading-tight">
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
                );
              })}
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
                  <td className="min-w-0 px-2 py-2 font-medium text-slate-900">
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
                  <td className="px-2 py-2" title={formatAdGradeTitle(ad)}>
                    <GradeChip grade={ad.grade} />
                  </td>
                  <td className="break-words px-2 py-2">
                    <RecommendationChip
                      compact
                      recommendation={ad.recommendation}
                    />
                  </td>
                  {showAdGroupColumn ? (
                    <td className="px-2 py-2">
                      <MetaStatusChip
                        status={getAdsetMetaStatus(ad)}
                        unknownLabel="-"
                      />
                    </td>
                  ) : null}
                  {showAdStatusColumn ? (
                    <td className="px-2 py-2">
                      <MetaStatusChip status={getAdMetaStatus(ad)} />
                    </td>
                  ) : null}
                  <td className="break-words px-2 py-2 text-slate-500 [overflow-wrap:anywhere]">
                    {ad.adId ?? "-"}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {formatNumber(ad.activeDays)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {formatCurrency(ad.spend)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {formatNumber(ad.leads)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {formatNumber(ad.signedLeads)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {formatCurrency(ad.cpl)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {formatCurrency(ad.cpsl)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {formatNumber(ad.inStateSignedLeads)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {formatNumber(ad.oosSignedLeads)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {formatCurrency(ad.oosCpsl)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <MetricChip
                      metric={ad.metricHealth.cpsl}
                      variant="currency"
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <MetricChip
                      metric={ad.metricHealth.volume}
                      variant="currency"
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <MetricChip
                      metric={ad.metricHealth.attribution}
                      variant="percentage"
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <MetricChip
                      metric={ad.metricHealth.intake}
                      variant="percentage"
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    {formatNumber(ad.droppedLeads)}
                  </td>
                  {showSlackColumn ? (
                    <td className="px-2 py-2 text-center align-middle">
                      <button
                        className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                        onClick={() => setSelectedSlackAd(ad)}
                        type="button"
                      >
                        Compose
                      </button>
                    </td>
                  ) : null}
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
      {selectedSlackAd ? (
        <AdSlackModal
          ad={selectedSlackAd}
          adMediaApiUrl={adMediaApiUrl}
          campaign={campaign}
          dateRange={dateRange}
          onClose={() => setSelectedSlackAd(null)}
          slackMessageApiUrl={slackMessageApiUrl}
        />
      ) : null}
    </>
  );
}

function AdSlackModal({
  ad,
  adMediaApiUrl,
  campaign,
  dateRange,
  onClose,
  slackMessageApiUrl,
}: {
  ad: CampaignHealthAdRow;
  adMediaApiUrl?: string;
  campaign: CampaignHealthRow;
  dateRange: DashboardDateRange;
  onClose: () => void;
  slackMessageApiUrl?: string;
}) {
  const platform = campaign.platform ?? "meta";
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<SlackPriorityLevel>(
    getDefaultSlackPriority(ad),
  );
  const [videoReference, setVideoReference] = useState(
    buildFallbackAdVideoReference(ad),
  );
  const [isLoadingReference, setIsLoadingReference] = useState(false);
  const [sendState, setSendState] = useState<{
    error: string | null;
    isSending: boolean;
    sent: boolean;
  }>({
    error: null,
    isSending: false,
    sent: false,
  });
  const contextRows = buildAdSlackContextRows({
    ad,
    campaign,
    dateRange,
    platform,
    priority,
  });
  const trimmedMessage = message.trim();
  const canSend =
    Boolean(trimmedMessage) && !sendState.isSending && !isLoadingReference;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    setPriority(getDefaultSlackPriority(ad));
    setVideoReference(buildFallbackAdVideoReference(ad));

    if (!adMediaApiUrl || !ad.adId?.trim()) {
      setIsLoadingReference(false);
      return;
    }

    setIsLoadingReference(true);

    async function loadReference() {
      const reference = await resolveAdSlackVideoReference({
        ad,
        adMediaApiUrl,
        campaign,
        platform,
      });

      if (!isActive) {
        return;
      }

      setVideoReference(reference);
      setIsLoadingReference(false);
    }

    void loadReference();

    return () => {
      isActive = false;
    };
  }, [ad, adMediaApiUrl, campaign, platform]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSend) {
      return;
    }

    if (!slackMessageApiUrl) {
      setSendState({
        error: "Slack message endpoint is not configured.",
        isSending: false,
        sent: false,
      });
      return;
    }

    setSendState({ error: null, isSending: true, sent: false });

    try {
      const payload = await buildAdSlackPayload({
        ad,
        adMediaApiUrl,
        campaign,
        dateRange,
        message: trimmedMessage,
        priority,
        videoReference,
      });

      await sendSlackGradeMessage(slackMessageApiUrl, payload);
      setMessage("");
      setSendState({ error: null, isSending: false, sent: true });
    } catch (caughtError) {
      setSendState({
        error:
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to send Slack message.",
        isSending: false,
        sent: false,
      });
    }
  }

  return (
    <div
      aria-labelledby="ad-slack-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 px-4 py-6"
      role="dialog"
    >
      <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Slack review
            </p>
            <h2
              className="mt-1 truncate text-xl font-bold text-slate-950"
              id="ad-slack-modal-title"
              title={ad.adName}
            >
              {ad.adName || "Unnamed ad"}
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
        <form
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:grid-cols-3">
            <AdSlackSummaryItem label="Grade" value={ad.grade} />
            <AdSlackSummaryItem
              label="Ad reference"
              value={isLoadingReference ? "Loading..." : videoReference}
            />
            <AdSlackSummaryItem
              label="Recommendation"
              value={ad.recommendation}
            />
          </div>
          <div className="space-y-4 px-5 py-4">
            <div className="max-w-xs">
              <label
                className="text-sm font-semibold text-slate-950"
                htmlFor="ad-slack-priority"
              >
                Priority
              </label>
              <select
                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
                disabled={sendState.isSending}
                id="ad-slack-priority"
                onChange={(event) =>
                  setPriority(event.target.value as SlackPriorityLevel)
                }
                value={priority}
              >
                {SLACK_PRIORITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="text-sm font-semibold text-slate-950"
                htmlFor="ad-slack-message"
              >
                Message
              </label>
              <textarea
                className="mt-2 min-h-[132px] w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
                disabled={sendState.isSending}
                id="ad-slack-message"
                maxLength={1800}
                onChange={(event) => {
                  setMessage(event.target.value);

                  if (sendState.error || sendState.sent) {
                    setSendState({
                      error: null,
                      isSending: false,
                      sent: false,
                    });
                  }
                }}
                placeholder="Add the note for Slack..."
                value={message}
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-950">
                Included context
              </h3>
              <dl className="mt-2 grid gap-2 rounded-md border border-slate-200 bg-white p-3 sm:grid-cols-2">
                {contextRows.map((row) => (
                  <div className="min-w-0" key={row.label}>
                    <dt className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
                      {row.label}
                    </dt>
                    <dd
                      className="mt-0.5 truncate text-sm font-medium text-slate-950"
                      title={row.value}
                    >
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            {sendState.error ? (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                {sendState.error}
              </p>
            ) : null}
            {sendState.sent ? (
              <p className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700">
                Sent to Slack.
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
            <button
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!canSend}
              type="submit"
            >
              {sendState.isSending ? "Posting..." : "Post to Slack"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdSlackSummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className="mt-1 truncate text-sm font-bold text-slate-950"
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

async function buildAdSlackPayload({
  ad,
  adMediaApiUrl,
  campaign,
  dateRange,
  message,
  priority,
  videoReference,
}: {
  ad: CampaignHealthAdRow;
  adMediaApiUrl?: string;
  campaign: CampaignHealthRow;
  dateRange: DashboardDateRange;
  message: string;
  priority: SlackPriorityLevel;
  videoReference?: string;
}): Promise<SlackGradeMessageRequest> {
  const platform = campaign.platform ?? "meta";
  const resolvedVideoReference =
    videoReference ??
    (await resolveAdSlackVideoReference({
      ad,
      adMediaApiUrl,
      campaign,
      platform,
    }));

  return {
    grade: ad.grade,
    message: buildAdSlackContextMessage({
      ad,
      campaign,
      dateRange,
      message,
      platform,
      priority,
    }),
    priority,
    title: `Audit ad review: ${ad.adName || "Unnamed ad"}`,
    videoReference: resolvedVideoReference,
  };
}

async function resolveAdSlackVideoReference({
  ad,
  adMediaApiUrl,
  campaign,
  platform,
}: {
  ad: CampaignHealthAdRow;
  adMediaApiUrl?: string;
  campaign: CampaignHealthRow;
  platform: CampaignPlatform;
}): Promise<string> {
  const adId = ad.adId?.trim();

  if (adMediaApiUrl && adId) {
    try {
      const media = await fetchAdMedia(adMediaApiUrl, {
        adId,
        campaignLabel: `${campaign.brand} / ${campaign.campaignName}`,
        platform,
      });
      const watchUrl = getAdMediaWatchUrl(media, platform);

      return (
        firstTrimmedValue(
          watchUrl,
          media.creativeName,
          media.videoId,
          media.creativeId,
          ad.adId,
          ad.adName,
        ) ?? buildFallbackAdVideoReference(ad)
      );
    } catch {
      return buildFallbackAdVideoReference(ad);
    }
  }

  return buildFallbackAdVideoReference(ad);
}

function buildAdSlackContextMessage({
  ad,
  campaign,
  dateRange,
  message,
  platform,
  priority,
}: {
  ad: CampaignHealthAdRow;
  campaign: CampaignHealthRow;
  dateRange: DashboardDateRange;
  message: string;
  platform: CampaignPlatform;
  priority: SlackPriorityLevel;
}): string {
  const contextRows = buildAdSlackContextRows({
    ad,
    campaign,
    dateRange,
    platform,
    priority,
  });

  return [
    message,
    "",
    "Audit context:",
    ...contextRows.map((row) => `${row.label}: ${row.value}`),
  ].join("\n");
}

function buildAdSlackContextRows({
  ad,
  campaign,
  dateRange,
  platform,
  priority,
}: {
  ad: CampaignHealthAdRow;
  campaign: CampaignHealthRow;
  dateRange: DashboardDateRange;
  platform: CampaignPlatform;
  priority: SlackPriorityLevel;
}): Array<{ label: string; value: string }> {
  return [
    { label: "Priority", value: priority },
    { label: "Brand", value: campaign.brand },
    { label: "Campaign", value: campaign.campaignName },
    { label: "Campaign started", value: formatCampaignStartDate(campaign) },
    { label: "Days running", value: formatCampaignRunningDays(campaign) },
    { label: "Ad", value: ad.adName || "-" },
    { label: "Ad ID", value: ad.adId || "-" },
    { label: "Platform", value: platformLabel(platform) },
    { label: "Recommendation", value: ad.recommendation },
    { label: "Confidence", value: ad.confidence },
    {
      label: "Delivery status",
      value: getAdDeliveryStatus(ad, platform).label,
    },
    {
      label: "Quality",
      value: healthStatusLabels[ad.metricHealth.attribution.status],
    },
    {
      label: "Int. Conv.",
      value: healthStatusLabels[ad.metricHealth.intake.status],
    },
    { label: "Leads", value: formatNumber(ad.leads) },
    { label: "Signed leads", value: formatNumber(ad.signedLeads) },
    { label: "Date range", value: `${dateRange.from} to ${dateRange.to}` },
  ];
}

function formatCampaignStartDate(campaign: CampaignHealthRow): string {
  const startedAt = campaign.startedAt?.trim();

  if (!startedAt) {
    return "-";
  }

  const dateParts = startedAt.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (dateParts) {
    const [, year, month, day] = dateParts;

    return CAMPAIGN_START_DATE_FORMATTER.format(
      new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))),
    );
  }

  const parsedDate = new Date(startedAt);

  if (Number.isNaN(parsedDate.getTime())) {
    return startedAt;
  }

  return CAMPAIGN_START_DATE_FORMATTER.format(parsedDate);
}

function formatCampaignRunningDays(campaign: CampaignHealthRow): string {
  const days = campaign.campaignAgeDays;

  if (typeof days !== "number" || !Number.isFinite(days)) {
    return "-";
  }

  return `${formatNumber(days)} ${days === 1 ? "day" : "days"}`;
}

function getDefaultSlackPriority(ad: CampaignHealthAdRow): SlackPriorityLevel {
  switch (ad.recommendation) {
    case "Shut off":
      return "Urgent";
    case "Review":
      return "High";
    default:
      return "Normal";
  }
}

function buildFallbackAdVideoReference(ad: CampaignHealthAdRow): string {
  return (
    firstTrimmedValue(ad.adId, ad.adName, ad.id) ??
    "Unknown ad reference"
  );
}

function firstTrimmedValue(
  ...values: Array<string | null | undefined>
): string | null {
  for (const value of values) {
    const trimmed = value?.trim();

    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

async function sendSlackGradeMessage(
  apiUrl: string,
  payload: SlackGradeMessageRequest,
): Promise<void> {
  const response = await fetch(apiUrl, {
    body: JSON.stringify(payload),
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readSlackResponseMessage(response));
  }
}

async function readSlackResponseMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as unknown;

    if (typeof body === "object" && body !== null) {
      if ("message" in body) {
        const message = (body as { message?: unknown }).message;

        if (Array.isArray(message)) {
          const normalized = message
            .filter((item) => typeof item === "string")
            .join(" ")
            .trim();

          if (normalized) {
            return normalized;
          }
        }

        if (typeof message === "string" && message.trim()) {
          return message;
        }
      }

      if ("error" in body) {
        const error = (body as { error?: unknown }).error;

        if (typeof error === "string" && error.trim()) {
          return error;
        }
      }
    }
  } catch {
    return `Unable to send Slack message (${response.status}).`;
  }

  return `Unable to send Slack message (${response.status}).`;
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
  >(() => (isMetaPlacement ? ["on"] : []));
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
    setSelectedMetaStatuses(isMetaPlacement ? ["on"] : []);
  }, [adName, isMetaPlacement, placements]);

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
        {
          accessorFn: (row) => row.ad.metricHealth.cpsl.value,
          header: "In-State CPSL",
          id: "inStateCpsl",
          sortingFn: placementNumberSortingFn,
        },
        {
          accessorFn: (row) => row.ad.metricHealth.volume.value,
          header: "Volume",
          id: "volume",
          sortDescFirst: true,
          sortingFn: placementNumberSortingFn,
        },
        {
          accessorFn: (row) => row.ad.metricHealth.attribution.value,
          header: "Quality",
          id: "quality",
          sortDescFirst: true,
          sortingFn: placementNumberSortingFn,
        },
        {
          accessorFn: (row) => row.ad.metricHealth.intake.value,
          header: "Int. Conv.",
          id: "intake",
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
        <table className="w-full table-fixed text-xs">
          {isMetaPlacement ? (
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[13%]" />
              <col className="w-[6%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[6%]" />
              <col className="w-[5%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[9%]" />
            </colgroup>
          ) : (
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[15%]" />
              <col className="w-[7%]" />
              <col className="w-[8%]" />
              <col className="w-[7%]" />
              <col className="w-[6%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
              <col className="w-[9%]" />
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
                        className={`flex w-full items-start gap-1 text-left font-semibold transition hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${getPlacementHeaderButtonClassName(
                          header.column.id,
                        )}`}
                        onClick={header.column.getToggleSortingHandler()}
                        type="button"
                      >
                        <span className="min-w-0 leading-tight">
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
                    <td className="break-words px-2 py-2 font-medium text-slate-950">
                      <div className="truncate">
                        {placement.campaign.brand} /{" "}
                        {placement.campaign.campaignName}
                      </div>
                    </td>
                    <td className="break-words px-2 py-2 text-slate-500">
                      {placement.ad.adId ?? "No ad ID"}
                    </td>
                    <td className="px-2 py-2">
                      <GradeChip grade={placement.ad.grade} />
                    </td>
                    {isMetaPlacement ? (
                      <td className="px-2 py-2">
                        <MetaStatusChip status={getAdMetaStatus(placement.ad)} />
                      </td>
                    ) : null}
                    <td className="px-2 py-2 text-right">
                      {formatCurrency(placement.ad.spend)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {formatNumber(placement.ad.leads)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {formatNumber(placement.ad.signedLeads)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <MetricChip
                        metric={placement.ad.metricHealth.cpsl}
                        variant="currency"
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <MetricChip
                        metric={placement.ad.metricHealth.volume}
                        variant="currency"
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <MetricChip
                        metric={placement.ad.metricHealth.attribution}
                        variant="percentage"
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <MetricChip
                        metric={placement.ad.metricHealth.intake}
                        variant="percentage"
                      />
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  className="px-4 py-10 text-center text-sm text-slate-500"
                  colSpan={columns.length}
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

function formatAverageDays(value: number | null | undefined): string {
  const formatted = formatRoundedValue(value);

  return formatted === "-" ? formatted : `${formatted}d`;
}

function formatAverageYears(value: number | null | undefined): string {
  const formatted = formatRoundedValue(value);

  return formatted === "-" ? formatted : `${formatted}y`;
}

function formatRoundedValue(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatGenderCounts(
  counts: Record<string, number> | null | undefined,
  options: { compact?: boolean } = {},
): string {
  const entries = getSortedGenderEntries(counts);

  if (entries.length === 0) {
    return "-";
  }

  return entries
    .map(([gender, count]) => {
      const label = options.compact === false ? gender : shortGenderLabel(gender);

      return `${label} ${formatNumber(count)}`;
    })
    .join(" / ");
}

function GenderCountsStack({
  counts,
}: {
  counts: Record<string, number> | null | undefined;
}) {
  const entries = getSortedGenderEntries(counts);

  if (entries.length === 0) {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <div className="flex flex-col gap-0.5 leading-tight">
      {entries.map(([gender, count]) => (
        <span className="whitespace-nowrap" key={gender}>
          <span className="font-semibold text-slate-700">
            {shortGenderLabel(gender)}
          </span>{" "}
          <span className="tabular-nums text-slate-600">
            {formatNumber(count)}
          </span>
        </span>
      ))}
    </div>
  );
}

function getSortedGenderEntries(
  counts: Record<string, number> | null | undefined,
): Array<[string, number]> {
  const genderRank: Record<string, number> = {
    Female: 1,
    Male: 2,
    Other: 3,
    Unknown: 4,
  };

  return Object.entries(counts ?? {})
    .filter(([, count]) => count > 0)
    .sort(
      ([firstGender], [secondGender]) =>
        (genderRank[firstGender] ?? 99) - (genderRank[secondGender] ?? 99) ||
        firstGender.localeCompare(secondGender),
    );
}

function shortGenderLabel(gender: string): string {
  switch (gender) {
    case "Female":
      return "F";
    case "Male":
      return "M";
    case "Unknown":
      return "Unk";
    default:
      return gender;
  }
}

function getQualitySignalFormula(signal: CampaignHealthQualitySignal): string {
  switch (signal.label) {
    case "No accident":
      return "Formula: no-accident leads / total leads.";
    case "CNA / no answer":
      return "Formula: CNA or no-answer leads / total leads.";
    case "Commercial":
      return "Formula: commercial leads / total leads.";
    case "Previous attorney":
      return "Formula: previous-attorney leads / total leads.";
    case "Old accident":
      return "Formula: old-accident leads / total leads.";
    case "Speed to lead":
      return "Formula: total minutes from CRM lead creation to first measured PhoneBurner attempt / measured leads.";
    default:
      return "Formula: signal count / total leads.";
  }
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
  compact = false,
  recommendation,
}: {
  compact?: boolean;
  recommendation: CampaignHealthRecommendation;
}) {
  const label = compact
    ? compactRecommendationLabels[recommendation]
    : recommendation;

  return (
    <span
      className={`inline-flex max-w-full whitespace-nowrap rounded-md border px-2.5 py-1 text-left text-xs font-semibold leading-tight ${recommendationClasses[recommendation]}`}
      title={compact ? recommendation : undefined}
    >
      {label}
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
        Campaign grades use In-State CPSL, volume, quality, and Int. Conv.
        In-State CPSL is the shutdown gate: only Red CPSL forces F. Yellow
        CPSL below the red threshold is graded with the other health metrics.
        Overall CPSL remains Spend / all signed leads for comparison. Ad grades
        use the same In-State CPSL rule. Campaign and ad rows with fewer than 7
        active spend days are marked Learning before grade-based actions apply.
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
              formula="Spend / In-State Signed Leads"
              green={`< ${formatCurrency(thresholds.cpsl.greenMaxExclusive)}`}
              metric="In-State CPSL"
              neutral={`0 in-state signed leads and spend < ${formatCurrency(
                thresholds.cpsl.zeroSignedLeadYellowSpendMin,
              )}`}
              red={`>= ${formatCurrency(thresholds.cpsl.redMin)}`}
              yellow={`${formatCurrency(
                thresholds.cpsl.greenMaxExclusive,
              )} - ${formatCurrency(
                thresholds.cpsl.redMin - 1,
              )}; or 0 in-state signed leads and spend ${formatCurrency(
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

function HealthInlineErrorNotice({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 shadow-sm">
      Fresh data could not be loaded. Showing the latest data already on
      screen. {message}
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
  Learning: "border-slate-200 bg-slate-50 text-slate-600",
  Scale: "border-teal-200 bg-teal-50 text-teal-800",
  Review: "border-amber-200 bg-amber-50 text-amber-800",
  "Shut off": "border-rose-200 bg-rose-50 text-rose-800",
};

const compactRecommendationLabels: Record<
  CampaignHealthRecommendation,
  ReactNode
> = {
  Learning: "Learning",
  Scale: "Scale",
  Review: "Review",
  "Shut off": "Shut off",
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
  "Shut off": 4,
  Review: 3,
  Learning: 2,
  Scale: 1,
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

const adRecommendationSortingFn: SortingFn<CampaignHealthAdRow> = (
  first,
  second,
  columnId,
) =>
  compareRankedValues(
    first.getValue<CampaignHealthRecommendation>(columnId),
    second.getValue<CampaignHealthRecommendation>(columnId),
    recommendationSortRanks,
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
  const rightAligned = new Set([
    "spend",
    "leads",
    "signedLeads",
    "inStateCpsl",
    "volume",
    "quality",
    "intake",
  ]);

  return rightAligned.has(columnId)
    ? "px-2 py-2 text-right"
    : "px-2 py-2 text-left";
}

function getPlacementHeaderButtonClassName(columnId: string): string {
  return [
    "spend",
    "leads",
    "signedLeads",
    "inStateCpsl",
    "volume",
    "quality",
    "intake",
  ].includes(columnId)
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

function getCampaignHeaderTitle(columnId: string): string | undefined {
  const titles: Record<string, string> = {
    activeDays:
      "Active days in the selected range; campaigns under the ramp-up window are treated separately.",
    brand: "Brand associated with the campaign.",
    campaignName: "Campaign name and platform campaign ID.",
    confidence:
      "Confidence in the audit result based on available data and campaign age.",
    actualAge: "Average lead age in years from CRM birth date when available.",
    droppedLeads: "CRM leads dropped in the selected date range.",
    genders: "CRM gender mix for attributed leads in the selected date range.",
    grade:
      "Overall campaign grade based on In-State CPSL, volume, quality, and Int. Conv.",
    inStateCpsl:
      "Spend / In-State Signed Leads. Shows N/A when there are no in-state signed leads.",
    inStateSignedLeads:
      "Signed leads attributed to the campaign inside the target state.",
    intake: "Signed Leads / Leads.",
    leadAgeDays:
      "Average days from CRM lead creation to the selected date range end.",
    leads: "Total CRM leads attributed to the campaign.",
    meta: "Current delivery status from the ad platform.",
    oosCpsl:
      "Spend / Out-of-State Signed Leads. Shows N/A when there are no out-of-state signed leads.",
    oosSignedLeads:
      "Signed leads attributed to the campaign outside the target state.",
    overallCpsl:
      "Spend / all Signed Leads. Shows N/A when there are no signed leads.",
    platform: "Ad platform for the campaign.",
    quality: "1 - (no-accident leads / total leads).",
    recommendation:
      "< 7 active spend days: Learning. A/B: Scale. C/D: Review. F: Shut off once it has at least 7 active spend days.",
    signedLeads: "Total signed leads attributed to the campaign.",
    spend: "Total ad spend in the selected date range.",
    volume: "Spend / Leads. Shows N/A when there are no leads.",
  };

  return titles[columnId];
}

function getCampaignHeaderClassName(columnId: string): string {
  const rightAligned = new Set([
    "activeDays",
    "spend",
    "leads",
    "signedLeads",
    "overallCpsl",
    "inStateSignedLeads",
    "oosSignedLeads",
    "inStateCpsl",
    "oosCpsl",
    "volume",
    "quality",
    "intake",
    "droppedLeads",
    "leadAgeDays",
    "actualAge",
  ]);
  const base = columnId === "expand" ? "w-12 px-2 py-3" : "px-2 py-3";

  return rightAligned.has(columnId) ? `${base} text-right` : base;
}

function getCampaignHeaderButtonClassName(columnId: string): string {
  return [
    "activeDays",
    "spend",
    "leads",
    "signedLeads",
    "overallCpsl",
    "inStateSignedLeads",
    "oosSignedLeads",
    "inStateCpsl",
    "oosCpsl",
    "volume",
    "quality",
    "intake",
    "droppedLeads",
    "leadAgeDays",
    "actualAge",
  ].includes(columnId)
    ? "justify-end"
    : "";
}

function getAdHeaderTitle(columnId: string): string | undefined {
  const titles: Record<string, string> = {
    activeDays:
      "Active days in the selected range; ads under the ramp-up window are treated separately.",
    adId: "Ad platform ID for the individual ad.",
    adName: "Ad name. Click it to inspect placements that reuse the same ad name.",
    adsetStatus:
      "Current ad set delivery status from the ad platform. Used for TikTok ad-row filtering.",
    cpl: "Spend / Leads. Shows N/A when there are no leads.",
    droppedLeads: "CRM leads dropped in the selected date range.",
    grade:
      "Overall ad grade based on In-State CPSL, volume, quality, and Int. Conv.",
    inStateCpsl:
      "Spend / In-State Signed Leads. Shows N/A when there are no in-state signed leads.",
    inStateSignedLeads:
      "Signed leads attributed to the ad inside the target state.",
    intake: "Signed Leads / Leads.",
    leads: "Total CRM leads attributed to the ad.",
    meta: "Current ad delivery status from the ad platform.",
    oosCpsl:
      "Spend / Out-of-State Signed Leads. Shows N/A when there are no out-of-state signed leads.",
    oosSignedLeads: "Signed leads attributed to the ad outside the target state.",
    overallCpsl:
      "Spend / all Signed Leads. Shows N/A when there are no signed leads.",
    quality: "1 - (no-accident leads / total leads).",
    recommendation:
      "< 7 active spend days: Learning. A/B: Scale. C/D/F: Review unless spend is at least $2,500 with zero in-state signed leads or in-state CPSL above the shutdown threshold.",
    signedLeads: "Total signed leads attributed to the ad.",
    slack: "Compose a Slack grade message for this ad.",
    spend: "Total ad spend in the selected date range.",
    volume: "Spend / Leads. Shows N/A when there are no leads.",
  };

  return titles[columnId];
}

function getAdHeaderClassName(columnId: string): string {
  const rightAligned = new Set([
    "activeDays",
    "spend",
    "leads",
    "signedLeads",
    "droppedLeads",
    "cpl",
    "overallCpsl",
    "cpsl",
    "inStateSignedLeads",
    "oosSignedLeads",
    "inStateCpsl",
    "oosCpsl",
    "volume",
    "quality",
    "intake",
  ]);

  return rightAligned.has(columnId)
    ? "px-3 py-2 text-right"
    : "px-3 py-2 text-left";
}

function getAdHeaderButtonClassName(columnId: string): string {
  return [
    "activeDays",
    "spend",
    "leads",
    "signedLeads",
    "droppedLeads",
    "cpl",
    "overallCpsl",
    "cpsl",
    "inStateSignedLeads",
    "oosSignedLeads",
    "inStateCpsl",
    "oosCpsl",
    "volume",
    "quality",
    "intake",
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

function adMatchesSelectedRecommendation(
  ad: CampaignHealthAdRow,
  selectedAdRecommendations: Set<CampaignHealthRecommendation>,
): boolean {
  return (
    selectedAdRecommendations.size === 0 ||
    selectedAdRecommendations.has(ad.recommendation)
  );
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

function filterHealthRows(
  rows: CampaignHealthRow[],
  filters: {
    selectedAdIds: string[];
    selectedAdGrades: CampaignHealthGrade[];
    selectedAdMetaStatuses: CampaignMetaDeliveryStatus[];
    selectedAdRecommendations: CampaignHealthRecommendation[];
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
  const selectedAdRecommendations = new Set(
    filters.selectedAdRecommendations,
  );
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
      selectedAdMetaStatuses.size > 0 ||
      selectedAdRecommendations.size > 0 ||
      selectedStates.size > 0;
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

    if (selectedAdRecommendations.size > 0) {
      selectedRowAds = selectedRowAds.filter((ad) =>
        adMatchesSelectedRecommendation(ad, selectedAdRecommendations),
      );
    }

    if (selectedStates.size > 0) {
      selectedRowAds = selectedRowAds.filter((ad) =>
        adMatchesSelectedStates(ad, selectedStates),
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

function countRecommendations(
  rows: CampaignHealthRow[],
): Partial<Record<CampaignHealthRecommendation, number>> {
  return rows.reduce(
    (counts, row) => {
      counts[row.recommendation] = (counts[row.recommendation] ?? 0) + 1;

      return counts;
    },
    {} as Partial<Record<CampaignHealthRecommendation, number>>,
  );
}

function countAdGrades(
  rows: CampaignHealthRow[],
  filters: AdSummaryFilters,
): Partial<Record<CampaignHealthGrade, number>> {
  const counts: Partial<Record<CampaignHealthGrade, number>> = {};

  for (const row of rows) {
    for (const ad of getMatchingAds(row, filters)) {
      counts[ad.grade] = (counts[ad.grade] ?? 0) + 1;
    }
  }

  return counts;
}

function countAdRecommendations(
  rows: CampaignHealthRow[],
  filters: AdSummaryFilters,
): Partial<Record<CampaignHealthRecommendation, number>> {
  const counts: Partial<Record<CampaignHealthRecommendation, number>> = {};

  for (const row of rows) {
    for (const ad of getMatchingAds(row, filters)) {
      counts[ad.recommendation] = (counts[ad.recommendation] ?? 0) + 1;
    }
  }

  return counts;
}

function countMatchingAds(
  rows: CampaignHealthRow[],
  filters: AdSummaryFilters,
): number {
  return rows.reduce(
    (count, row) => count + getMatchingAds(row, filters).length,
    0,
  );
}

function getMatchingAds(
  row: CampaignHealthRow,
  filters: AdSummaryFilters,
): CampaignHealthAdRow[] {
  const selectedAdIds = new Set(filters.selectedAdIds);
  const selectedAdGrades = new Set(filters.selectedAdGrades);
  const selectedAdMetaStatuses = new Set(filters.selectedAdMetaStatuses);
  const selectedAdRecommendations = new Set(
    filters.selectedAdRecommendations,
  );
  const selectedStates = new Set(filters.selectedStates);

  return row.ads.filter(
    (ad) =>
      (selectedAdIds.size === 0 ||
        selectedAdIds.has(toAdFilterId(row, ad))) &&
      adMatchesSelectedGrade(ad, selectedAdGrades) &&
      adMatchesSelectedMetaStatus(
        ad,
        selectedAdMetaStatuses,
        row.platform ?? "meta",
      ) &&
      adMatchesSelectedRecommendation(ad, selectedAdRecommendations) &&
      adMatchesSelectedStates(ad, selectedStates),
  );
}

function appendSelectionChips({
  chips,
  group,
  onChange,
  options,
  selectedIds,
}: {
  chips: ActiveFilterChip[];
  group: string;
  onChange: (ids: string[]) => void;
  options: Array<{ id: string; label: string }>;
  selectedIds: string[];
}): void {
  for (const selectedId of selectedIds) {
    chips.push({
      group,
      id: `${group}:${selectedId}`,
      label: getOptionLabel(options, selectedId),
      onRemove: () =>
        onChange(selectedIds.filter((currentId) => currentId !== selectedId)),
    });
  }
}

function getOptionLabel(
  options: Array<{ id: string; label: string }>,
  id: string,
): string {
  return options.find((option) => option.id === id)?.label ?? id;
}

function formatDateRangeChip(range: DashboardDateRange): string {
  if (!range.from || !range.to) {
    return "Default range";
  }

  if (range.from === range.to) {
    return range.from;
  }

  return `${range.from} - ${range.to}`;
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
    return constrainDateRangeDays(
      getCurrentMonthDateRange(),
      AUDIT_MAX_RANGE_DAYS,
    );
  }

  return constrainDateRangeDays({ from, to }, AUDIT_MAX_RANGE_DAYS);
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
