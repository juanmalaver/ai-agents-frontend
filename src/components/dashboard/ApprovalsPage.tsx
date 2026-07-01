"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  AssetReviewDecisionResponse,
  BriefDraftContinueResponse,
  BriefDraftResponse,
  BriefDraftScene,
  HiggsfieldOAuthStartResponse,
  HiggsfieldOAuthStatusResponse,
  ReviewAssetDetailResponse,
  ReviewAssetListItem,
  ReviewAssetsResponse,
  ReviewDecision,
  VideoProductionBriefCatalogResponse,
  VideoProductionBrandOption,
  VideoProductionCatalogOption,
  VideoProductionCharacterOption,
  VideoProductionClientTypeOption,
} from "@/src/types/videoApprovals";
import { useAuthUser } from "@/src/components/auth/AuthGate";
import { formatDashboardTimestamp } from "@/src/utils/dashboardFormatters";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardShell } from "./DashboardShell";

type ApprovalTab = "briefs" | "videos";
type LoadState = "loading" | "ready" | "error";
type StatusTone = "amber" | "rose" | "slate" | "teal";
type VideoReviewFilter = "all" | "approved" | "rejected" | "waiting";
type ScriptPayload = BriefDraftResponse["script"];
type StoryboardPayload = BriefDraftResponse["storyboard"];

const videoReviewFilters: Array<{
  id: VideoReviewFilter;
  label: string;
}> = [
  { id: "waiting", label: "Waiting Approval" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];
const DEFAULT_CHARACTER_DESCRIPTION = "Latina woman dressed very casually";
const DEFAULT_SCENE_COUNT = "1";
const DEFAULT_VARIANT_COUNT = 1;
const DEFAULT_VIDEO_LENGTH_SECONDS = 15;
const sceneCountOptions = [1, 2, 3, 4, 5];
const videoLengthOptions = [15, 30, 45, 60];
const REELS_ASPECT_RATIO = "9:16";
const REELS_PLATFORM = "TikTok/Reels/Shorts";
const HIGGSFIELD_OAUTH_STATUS_REFRESH_MS = 12_000;
const HIGGSFIELD_OAUTH_MAX_WAIT_ATTEMPTS = 20;
const promptChecklist = [
  "Brand",
  "Market / state",
  "Language",
  "Client type",
  "Offer / CTA",
  "Script or voiceover",
  "Video style",
  "Vertical Reels length",
  "Scene count",
  "Character or character description",
  "Compliance notes",
  "References",
];
const manualPromptPlaceholder = `Example:
Brand: Los Abogados Latinos
Market: Florida
Language: Spanish
Client type: commercial truck accident
CTA: book a free consultation
Style: raw UGC selfie, vertical Reels
Character: bilingual attorney in her late 30s, calm and direct

Script:
Scene 1 voiceover...
Scene 2 voiceover...

Notes:
Keep it compliant. Do not include phone numbers, websites, end cards, or final contact cards.`;

export function ApprovalsPage({ activeTab }: { activeTab: ApprovalTab }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const authUser = useAuthUser();
  const searchParamString = searchParams.toString();
  const deepLinkedAssetId = searchParams.get("asset_id");
  const deepLinkedBriefId = searchParams.get("brief_id");
  const reviewerEmail = authUser?.email.trim() ?? "";
  const handledDeepLinkRef = useRef<string | null>(null);
  const [items, setItems] = useState<ReviewAssetListItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [listError, setListError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReviewAssetDetailResponse | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [decisionStatus, setDecisionStatus] = useState<string | null>(null);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  const pendingCount = useMemo(
    () =>
      items.filter(
        (item) =>
          item.human_review_required &&
          !item.approved &&
          !item.review_decision,
      ).length,
    [items],
  );
  const reviewedCount = useMemo(
    () =>
      items.filter((item) => Boolean(item.review_decision) || item.approved)
        .length,
    [items],
  );
  const lastUpdated = useMemo(() => latestTimestamp(items), [items]);

  const loadReviews = useCallback(async () => {
    setLoadState("loading");
    setListError(null);

    try {
      const response = await fetchJson<ReviewAssetsResponse>(
        "/api/video-production/reviews",
      );

      setItems(response.items);
      setLoadState("ready");
    } catch (caughtError) {
      setListError(errorMessage(caughtError, "Unable to load review queue."));
      setLoadState("error");
    }
  }, []);

  const openAsset = useCallback(async (assetId: string) => {
    setSelectedAssetId(assetId);
    setIsDetailLoading(true);
    setDetailError(null);
    setDecisionStatus(null);

    try {
      const response = await fetchJson<ReviewAssetDetailResponse>(
        `/api/video-production/reviews/${encodeURIComponent(assetId)}`,
      );

      setDetail(response);
    } catch (caughtError) {
      setDetail(null);
      setDetailError(errorMessage(caughtError, "Unable to load asset detail."));
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const setReviewUrl = useCallback(
    (
      {
        assetId,
        briefId,
      }: {
        assetId: string;
        briefId: string;
      },
      mode: "push" | "replace" = "push",
    ) => {
      const nextSearchParams = new URLSearchParams(searchParamString);
      nextSearchParams.set("brief_id", briefId);
      nextSearchParams.set("asset_id", assetId);

      const nextUrl = `${pathname}?${nextSearchParams.toString()}`;

      if (mode === "replace") {
        router.replace(nextUrl, { scroll: false });
        return;
      }

      router.push(nextUrl, { scroll: false });
    },
    [pathname, router, searchParamString],
  );

  const openAssetFromList = useCallback(
    (item: ReviewAssetListItem) => {
      handledDeepLinkRef.current = `${item.brief_id}:${item.asset_id}`;
      setReviewUrl({
        assetId: item.asset_id,
        briefId: item.brief_id,
      });
      void openAsset(item.asset_id);
    },
    [openAsset, setReviewUrl],
  );

  const closeDetail = useCallback(() => {
    setDetail(null);
    setSelectedAssetId(null);
    setDetailError(null);
    setDecisionStatus(null);
    handledDeepLinkRef.current = null;

    const nextSearchParams = new URLSearchParams(searchParamString);
    const hadReviewParams =
      nextSearchParams.has("asset_id") || nextSearchParams.has("brief_id");
    nextSearchParams.delete("asset_id");
    nextSearchParams.delete("brief_id");

    if (!hadReviewParams && !selectedAssetId) {
      return;
    }

    const nextQuery = nextSearchParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [
    pathname,
    router,
    searchParamString,
    selectedAssetId,
  ]);

  const submitDecision = useCallback(
    async (decision: ReviewDecision) => {
      if (!detail || !selectedAssetId) {
        return;
      }

      if (!reviewerEmail) {
        setDecisionStatus("Authenticated reviewer email is required.");
        return;
      }

      setIsSubmittingDecision(true);
      setDecisionStatus(null);

      try {
        const response = await fetchJson<AssetReviewDecisionResponse>(
          `/api/video-production/reviews/${encodeURIComponent(
            selectedAssetId,
          )}/decision`,
          {
            body: JSON.stringify({
              decision,
            }),
            headers: {
              "Content-Type": "application/json",
            },
            method: "POST",
          },
        );

        setDecisionStatus(
          response.decision === "approved" ? "Approved" : "Rejected",
        );
        setDetail((current) =>
          current
            ? {
                ...current,
                asset: {
                  ...current.asset,
                  approved: response.decision === "approved",
                  review_decision: response.decision,
                  reviewed_at: response.reviewed_at,
                  reviewed_by: response.reviewer,
                  status: response.status,
                },
              }
            : current,
        );
        setItems((current) =>
          current.map((item) =>
            item.asset_id === response.asset_id
              ? {
                  ...item,
                  approved: response.decision === "approved",
                  review_decision: response.decision,
                  reviewed_at: response.reviewed_at,
                  reviewed_by: response.reviewer,
                  status: response.status,
                }
              : item,
          ),
        );
      } catch (caughtError) {
        setDecisionStatus(errorMessage(caughtError, "Unable to save decision."));
      } finally {
        setIsSubmittingDecision(false);
      }
    },
    [detail, reviewerEmail, selectedAssetId],
  );

  useEffect(() => {
    if (activeTab !== "videos") {
      return;
    }

    void loadReviews();
  }, [activeTab, loadReviews]);

  useEffect(() => {
    if (activeTab !== "videos") {
      return;
    }

    if (!deepLinkedAssetId && !deepLinkedBriefId) {
      handledDeepLinkRef.current = null;
      setDetail(null);
      setSelectedAssetId(null);
      setDetailError(null);
      setDecisionStatus(null);
      return;
    }

    const deepLinkKey = `${deepLinkedBriefId ?? ""}:${deepLinkedAssetId ?? ""}`;

    if (handledDeepLinkRef.current === deepLinkKey) {
      return;
    }

    if (deepLinkedAssetId) {
      handledDeepLinkRef.current = deepLinkKey;
      void openAsset(deepLinkedAssetId);
      return;
    }

    if (loadState !== "ready") {
      return;
    }

    const matchingAsset = items.find(
      (item) => item.brief_id === deepLinkedBriefId,
    );

    if (!matchingAsset) {
      return;
    }

    const resolvedDeepLinkKey = `${matchingAsset.brief_id}:${matchingAsset.asset_id}`;
    handledDeepLinkRef.current = resolvedDeepLinkKey;
    setReviewUrl(
      {
        assetId: matchingAsset.asset_id,
        briefId: matchingAsset.brief_id,
      },
      "replace",
    );
    void openAsset(matchingAsset.asset_id);
  }, [
    activeTab,
    deepLinkedAssetId,
    deepLinkedBriefId,
    items,
    loadState,
    openAsset,
    setReviewUrl,
  ]);

  return (
    <>
      <DashboardShell activeItem="approvals">
        <DashboardHeader
          lastUpdated={
            activeTab === "videos" && lastUpdated
              ? formatTimestamp(lastUpdated)
              : undefined
          }
          subtitle="Brief and generated video review queues."
          title="Approvals"
        />

        <ApprovalsTabs activeTab={activeTab} />

        {activeTab === "briefs" ? (
          <BriefApprovalsPanel reviewerEmail={reviewerEmail} />
        ) : (
          <VideoApprovalsPanel
            items={items}
            listError={listError}
            loadReviews={loadReviews}
            loadState={loadState}
            openAsset={openAssetFromList}
            pendingCount={pendingCount}
            reviewedCount={reviewedCount}
            selectedAssetId={selectedAssetId}
          />
        )}
      </DashboardShell>

      {selectedAssetId ? (
        <ReviewDetailModal
          decisionStatus={decisionStatus}
          detail={detail}
          detailError={detailError}
          isDetailLoading={isDetailLoading}
          isSubmittingDecision={isSubmittingDecision}
          onClose={closeDetail}
          onDecision={(decision) => void submitDecision(decision)}
          reviewerEmail={reviewerEmail}
          selectedAssetId={selectedAssetId}
        />
      ) : null}
    </>
  );
}

function ApprovalsTabs({ activeTab }: { activeTab: ApprovalTab }) {
  const tabs: Array<{ href: string; id: ApprovalTab; label: string }> = [
    { href: "/approvals", id: "briefs", label: "Brief Approvals" },
    {
      href: "/approvals/video-approvals",
      id: "videos",
      label: "Video Approvals",
    },
  ];

  return (
    <nav
      aria-label="Approval queues"
      className="flex w-full gap-2 overflow-x-auto border-b border-slate-200"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
              isActive
                ? "border-teal-500 text-slate-950"
                : "border-transparent text-slate-500 hover:border-sky-300 hover:text-slate-800"
            }`}
            href={tab.href}
            key={tab.id}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

function BriefApprovalsPanel({ reviewerEmail }: { reviewerEmail: string }) {
  const [briefText, setBriefText] = useState("");
  const [useAdvancedOptions, setUseAdvancedOptions] = useState(false);
  const [higgsfieldOAuthStatus, setHiggsfieldOAuthStatus] =
    useState<HiggsfieldOAuthStatusResponse | null>(null);
  const [higgsfieldOAuthLoadState, setHiggsfieldOAuthLoadState] =
    useState<LoadState>("loading");
  const [higgsfieldOAuthError, setHiggsfieldOAuthError] = useState<string | null>(
    null,
  );
  const [higgsfieldOAuthMessage, setHiggsfieldOAuthMessage] = useState<
    string | null
  >(null);
  const [higgsfieldAuthorizationUrl, setHiggsfieldAuthorizationUrl] = useState<
    string | null
  >(null);
  const [isStartingHiggsfieldOAuth, setIsStartingHiggsfieldOAuth] =
    useState(false);
  const [isRefreshingHiggsfieldOAuth, setIsRefreshingHiggsfieldOAuth] =
    useState(false);
  const [catalog, setCatalog] =
    useState<VideoProductionBriefCatalogResponse | null>(null);
  const [catalogLoadState, setCatalogLoadState] =
    useState<LoadState>("loading");
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selectedBrandCode, setSelectedBrandCode] = useState("");
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [customCharacterDescription, setCustomCharacterDescription] =
    useState(DEFAULT_CHARACTER_DESCRIPTION);
  const [marketState, setMarketState] = useState("");
  const [languageCode, setLanguageCode] = useState("en");
  const [clientType, setClientType] = useState("");
  const [videoStyle, setVideoStyle] = useState("");
  const [awarenessLevel, setAwarenessLevel] = useState("problem-aware");
  const [hookAngle, setHookAngle] = useState("");
  const [cta, setCta] = useState("");
  const [sceneCount, setSceneCount] = useState(DEFAULT_SCENE_COUNT);
  const [maxVariants, setMaxVariants] = useState(DEFAULT_VARIANT_COUNT);
  const [videoLengthSeconds, setVideoLengthSeconds] = useState(
    DEFAULT_VIDEO_LENGTH_SECONDS,
  );
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [draft, setDraft] = useState<BriefDraftResponse | null>(null);
  const [editableScript, setEditableScript] = useState<ScriptPayload | null>(
    null,
  );
  const [isScriptDirty, setIsScriptDirty] = useState(false);
  const [editableStoryboard, setEditableStoryboard] =
    useState<StoryboardPayload | null>(null);
  const [isStoryboardDirty, setIsStoryboardDirty] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [continueStatus, setContinueStatus] = useState<string | null>(null);
  const [scriptSaveStatus, setScriptSaveStatus] = useState<string | null>(null);
  const [storyboardSaveStatus, setStoryboardSaveStatus] = useState<
    string | null
  >(null);
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [isSavingScript, setIsSavingScript] = useState(false);
  const [isSavingStoryboard, setIsSavingStoryboard] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const higgsfieldOAuthWindowRef = useRef<Window | null>(null);
  const higgsfieldOAuthPollTimerRef = useRef<number | null>(null);
  const trimmedBriefText = briefText.trim();
  const brands = catalog?.brands ?? [];
  const characters = catalog?.characters ?? [];
  const clientTypeOptions = catalog?.client_types ?? [];
  const videoStyleOptions = catalog?.video_styles ?? [];
  const marketStateOptions = catalog?.market_states ?? [];
  const hookAngleOptions = catalog?.hook_angles ?? [];
  const ctaOptions = catalog?.ctas ?? [];
  const languageOptions = catalog?.languages ?? [
    { code: "en", label: "English" },
    { code: "es", label: "Spanish" },
  ];
  const awarenessLevelOptions = catalog?.awareness_levels ?? [];
  const variantOptions = catalog?.max_variants ?? [1, 2, 3];
  const activeBrands = useMemo(
    () => brands.filter((brand) => brand.is_active),
    [brands],
  );
  const selectedBrand = useMemo(
    () =>
      activeBrands.find((brand) => brand.brand_code === selectedBrandCode) ??
      null,
    [activeBrands, selectedBrandCode],
  );
  const characterOptions = useMemo(
    () =>
      characters.filter((character) => {
        const matchesBrand =
          !character.brand_code || character.brand_code === selectedBrandCode;
        const matchesLanguage =
          character.language === "any" || character.language === languageCode;

        return character.is_active && matchesBrand && matchesLanguage;
      }),
    [characters, languageCode, selectedBrandCode],
  );
  const selectedCharacter = useMemo(
    () =>
      characterOptions.find(
        (character) => character.character_id === selectedCharacterId,
      ) ?? null,
    [characterOptions, selectedCharacterId],
  );
  const selectedLanguageLabel = useMemo(
    () =>
      languageOptions.find((option) => option.code === languageCode)?.label ??
      "English",
    [languageCode, languageOptions],
  );
  const autofillMetadata = useMemo(
    () =>
      buildBriefDraftAutofillMetadata({
        activeBrands,
        awarenessLevelOptions,
        characters,
        clientTypeOptions,
        ctaOptions,
        hookAngleOptions,
        languageOptions,
        marketStateOptions,
        variantOptions,
        videoStyleOptions,
      }),
    [
      activeBrands,
      awarenessLevelOptions,
      characters,
      clientTypeOptions,
      ctaOptions,
      hookAngleOptions,
      languageOptions,
      marketStateOptions,
      variantOptions,
      videoStyleOptions,
    ],
  );
  const markAdvancedOptionsUsed = useCallback(() => {
    setUseAdvancedOptions(true);
  }, []);

  const clearHiggsfieldOAuthPolling = useCallback(() => {
    if (higgsfieldOAuthPollTimerRef.current !== null) {
      window.clearInterval(higgsfieldOAuthPollTimerRef.current);
      higgsfieldOAuthPollTimerRef.current = null;
    }
  }, []);

  const loadHiggsfieldOAuthStatus = useCallback(async (
    options: { onlyIfVisible?: boolean; silent?: boolean } = {},
  ): Promise<HiggsfieldOAuthStatusResponse | null> => {
    if (!reviewerEmail) {
      setHiggsfieldOAuthStatus(null);
      setHiggsfieldOAuthLoadState("ready");
      setHiggsfieldOAuthError(null);
      return null;
    }

    if (options.onlyIfVisible && document.visibilityState !== "visible") {
      return null;
    }

    if (!options.silent) {
      setHiggsfieldOAuthLoadState("loading");
    }
    setHiggsfieldOAuthError(null);

    try {
      const response = await fetchJson<HiggsfieldOAuthStatusResponse>(
        "/api/video-production/integrations/higgsfield/oauth/status",
      );

      setHiggsfieldOAuthStatus(response);
      setHiggsfieldOAuthLoadState("ready");
      return response;
    } catch (caughtError) {
      if (!options.silent) {
        setHiggsfieldOAuthError(
          errorMessage(caughtError, "Unable to load Higgsfield connection."),
        );
        setHiggsfieldOAuthLoadState("error");
      }
      return null;
    }
  }, [reviewerEmail]);

  const startHiggsfieldOAuthPolling = useCallback(() => {
    clearHiggsfieldOAuthPolling();

    let attempts = 0;
    higgsfieldOAuthPollTimerRef.current = window.setInterval(() => {
      attempts += 1;

      void loadHiggsfieldOAuthStatus({
        onlyIfVisible: true,
        silent: true,
      }).then((response) => {
        if (response?.connected) {
          clearHiggsfieldOAuthPolling();
          setHiggsfieldOAuthMessage("State updated to connected.");
          return;
        }

        const oauthWindow = higgsfieldOAuthWindowRef.current;
        if (oauthWindow?.closed && attempts >= 2) {
          clearHiggsfieldOAuthPolling();
          setHiggsfieldOAuthMessage(
            "Authorization window closed before a connected state was confirmed.",
          );
          return;
        }

        if (attempts >= HIGGSFIELD_OAUTH_MAX_WAIT_ATTEMPTS) {
          clearHiggsfieldOAuthPolling();
          setHiggsfieldOAuthMessage(
            "Still waiting for Higgsfield authorization.",
          );
        }
      });
    }, HIGGSFIELD_OAUTH_STATUS_REFRESH_MS);
  }, [clearHiggsfieldOAuthPolling, loadHiggsfieldOAuthStatus]);

  const startHiggsfieldOAuth = useCallback(async () => {
    if (!reviewerEmail) {
      setHiggsfieldOAuthMessage("Authenticated user email is required.");
      return;
    }

    setIsStartingHiggsfieldOAuth(true);
    setHiggsfieldOAuthError(null);
    setHiggsfieldOAuthMessage(null);

    try {
      const response = await fetchJson<HiggsfieldOAuthStartResponse>(
        "/api/video-production/integrations/higgsfield/oauth/start",
      );

      setHiggsfieldAuthorizationUrl(response.authorization_url);
      const openedWindow = window.open(
        response.authorization_url,
        "higgsfield-oauth",
        "popup=yes,width=560,height=760",
      );
      higgsfieldOAuthWindowRef.current = openedWindow;

      setHiggsfieldOAuthMessage(
        openedWindow
          ? "Waiting for Higgsfield authorization."
          : "Popup blocked. Open the authorization link.",
      );

      startHiggsfieldOAuthPolling();
    } catch (caughtError) {
      setHiggsfieldOAuthError(
        errorMessage(caughtError, "Unable to start Higgsfield authorization."),
      );
    } finally {
      setIsStartingHiggsfieldOAuth(false);
    }
  }, [reviewerEmail, startHiggsfieldOAuthPolling]);

  const refreshHiggsfieldOAuth = useCallback(async () => {
    if (!reviewerEmail) {
      setHiggsfieldOAuthMessage("Authenticated user email is required.");
      return;
    }

    setIsRefreshingHiggsfieldOAuth(true);
    setHiggsfieldOAuthError(null);
    setHiggsfieldOAuthMessage(null);

    try {
      const response = await fetchJson<HiggsfieldOAuthStatusResponse>(
        "/api/video-production/integrations/higgsfield/oauth/refresh",
        {
          method: "POST",
        },
      );

      setHiggsfieldOAuthStatus(response);
      setHiggsfieldOAuthLoadState("ready");
      setHiggsfieldOAuthMessage("Higgsfield connection refreshed.");
    } catch (caughtError) {
      setHiggsfieldOAuthError(
        errorMessage(caughtError, "Unable to refresh Higgsfield connection."),
      );
    } finally {
      setIsRefreshingHiggsfieldOAuth(false);
    }
  }, [reviewerEmail]);

  const scriptValidationError = useMemo(
    () => validateScript(editableScript),
    [editableScript],
  );
  const storyboardValidationError = useMemo(
    () => validateStoryboard(editableStoryboard),
    [editableStoryboard],
  );
  const isCatalogLoading = catalogLoadState === "loading";
  const canGenerate =
    Boolean(reviewerEmail) &&
    !isCatalogLoading &&
    (!useAdvancedOptions || Boolean(selectedBrand)) &&
    trimmedBriefText.length >= 10 &&
    !isGeneratingStoryboard;
  const canContinue =
    draft !== null &&
    !draft.run_id &&
    isBriefDraftEditableStatus(draft.status) &&
    Boolean(reviewerEmail) &&
    !scriptValidationError &&
    !storyboardValidationError &&
    !isContinuing &&
    !isSavingScript &&
    !isSavingStoryboard;

  const generateStoryboard = useCallback(async () => {
    if (!reviewerEmail) {
      setBriefError("Authenticated creator email is required.");
      return;
    }

    if (useAdvancedOptions && !selectedBrand) {
      setBriefError("Brand is required when using advanced options.");
      return;
    }

    if (trimmedBriefText.length < 10) {
      setBriefError("Brief must be at least 10 characters.");
      return;
    }

    setIsGeneratingStoryboard(true);
    setBriefError(null);
    setContinueStatus(null);

    try {
      const response = await fetchJson<BriefDraftResponse>(
        "/api/video-production/brief-drafts",
        {
          body: JSON.stringify({
            metadata:
              useAdvancedOptions && selectedBrand
                ? buildBriefDraftMetadata({
                    brand: selectedBrand,
                    awarenessLevel,
                    character: selectedCharacter,
                    customCharacterDescription,
                    clientType,
                    cta,
                    hookAngle,
                    languageCode,
                    languageLabel: selectedLanguageLabel,
                    marketState,
                    maxVariants,
                    sceneCount,
                    subtitlesEnabled,
                    videoLengthSeconds,
                    videoStyle,
                  })
                : autofillMetadata,
            source_prompt: trimmedBriefText,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      setDraft(response);
      setEditableScript(response.script);
      setIsScriptDirty(false);
      setEditableStoryboard(response.storyboard);
      setIsStoryboardDirty(false);
      setScriptSaveStatus(null);
      setStoryboardSaveStatus(null);
    } catch (caughtError) {
      setDraft(null);
      setEditableScript(null);
      setIsScriptDirty(false);
      setEditableStoryboard(null);
      setIsStoryboardDirty(false);
      setBriefError(errorMessage(caughtError, "Unable to generate script."));
    } finally {
      setIsGeneratingStoryboard(false);
    }
  }, [
    awarenessLevel,
    autofillMetadata,
    selectedCharacter,
    customCharacterDescription,
    clientType,
    cta,
    hookAngle,
    languageCode,
    selectedLanguageLabel,
    marketState,
    maxVariants,
    reviewerEmail,
    sceneCount,
    selectedBrand,
    subtitlesEnabled,
    trimmedBriefText,
    useAdvancedOptions,
    videoLengthSeconds,
    videoStyle,
  ]);

  const saveScript = useCallback(async (): Promise<BriefDraftResponse | null> => {
    if (!draft) {
      return null;
    }

    if (!editableScript) {
      setScriptSaveStatus("Script is required.");
      return null;
    }

    if (!reviewerEmail) {
      setScriptSaveStatus("Authenticated reviewer email is required.");
      return null;
    }

    if (scriptValidationError) {
      setScriptSaveStatus(scriptValidationError);
      return null;
    }

    setIsSavingScript(true);
    setScriptSaveStatus(null);

    try {
      const response = await fetchJson<BriefDraftResponse>(
        `/api/video-production/brief-drafts/${encodeURIComponent(
          draft.draft_id,
        )}/script`,
        {
          body: JSON.stringify({
            script: editableScript,
            updated_by: reviewerEmail,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );

      setDraft(response);
      setEditableScript(response.script);
      setIsScriptDirty(false);
      setEditableStoryboard(response.storyboard);
      setIsStoryboardDirty(false);
      setScriptSaveStatus(
        `Script saved. ${response.prompt_count} prompt${
          response.prompt_count === 1 ? "" : "s"
        } recompiled.`,
      );
      return response;
    } catch (caughtError) {
      setScriptSaveStatus(errorMessage(caughtError, "Unable to save script."));
      return null;
    } finally {
      setIsSavingScript(false);
    }
  }, [draft, editableScript, reviewerEmail, scriptValidationError]);

  const saveStoryboard = useCallback(async (): Promise<BriefDraftResponse | null> => {
    if (!draft) {
      return null;
    }

    if (!editableStoryboard) {
      setStoryboardSaveStatus("Storyboard is required.");
      return null;
    }

    if (!reviewerEmail) {
      setStoryboardSaveStatus("Authenticated reviewer email is required.");
      return null;
    }

    if (storyboardValidationError) {
      setStoryboardSaveStatus(storyboardValidationError);
      return null;
    }

    setIsSavingStoryboard(true);
    setStoryboardSaveStatus(null);

    try {
      const response = await fetchJson<BriefDraftResponse>(
        `/api/video-production/brief-drafts/${encodeURIComponent(
          draft.draft_id,
        )}/storyboard`,
        {
          body: JSON.stringify({
            storyboard: editableStoryboard,
            updated_by: reviewerEmail,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );

      setDraft(response);
      setEditableStoryboard(response.storyboard);
      setIsStoryboardDirty(false);
      setStoryboardSaveStatus(
        `Storyboard saved. ${response.prompt_count} prompt${
          response.prompt_count === 1 ? "" : "s"
        } recompiled.`,
      );
      return response;
    } catch (caughtError) {
      setStoryboardSaveStatus(
        errorMessage(caughtError, "Unable to save storyboard."),
      );
      return null;
    } finally {
      setIsSavingStoryboard(false);
    }
  }, [draft, editableStoryboard, reviewerEmail, storyboardValidationError]);

  const continueToVideo = useCallback(async () => {
    if (!draft) {
      return;
    }

    if (!reviewerEmail) {
      setContinueStatus("Authenticated reviewer email is required.");
      return;
    }

    let draftForContinue = draft;
    if (isScriptDirty) {
      const savedDraft = await saveScript();
      if (!savedDraft) {
        return;
      }
      draftForContinue = savedDraft;
    }

    if (isStoryboardDirty) {
      const savedDraft = await saveStoryboard();
      if (!savedDraft) {
        return;
      }
      draftForContinue = savedDraft;
    }

    setIsContinuing(true);
    setBriefError(null);
    setContinueStatus(null);

    try {
      const response = await fetchJson<BriefDraftContinueResponse>(
        `/api/video-production/brief-drafts/${encodeURIComponent(
          draftForContinue.draft_id,
        )}/continue`,
        {
          body: JSON.stringify({}),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      setDraft((current) =>
        current
          ? {
              ...current,
              continued_by: reviewerEmail,
              run_id: response.run_id,
              status: "generation_submitted",
            }
          : current,
      );
      setContinueStatus(
        `Video generation started with ${response.submitted_jobs.length} job${
          response.submitted_jobs.length === 1 ? "" : "s"
        }.`,
      );
    } catch (caughtError) {
      setContinueStatus(
        errorMessage(caughtError, "Unable to continue to video generation."),
      );
    } finally {
      setIsContinuing(false);
    }
  }, [
    draft,
    isScriptDirty,
    isStoryboardDirty,
    reviewerEmail,
    saveScript,
    saveStoryboard,
  ]);

  useEffect(() => {
    if (draft) {
      setEditableScript(draft.script);
      setIsScriptDirty(false);
      setScriptSaveStatus(null);
      setEditableStoryboard(draft.storyboard);
      setIsStoryboardDirty(false);
      setStoryboardSaveStatus(null);
      previewRef.current?.focus();
    }
  }, [draft?.draft_id]);

  useEffect(() => {
    let isMounted = true;

    async function loadCatalog() {
      setCatalogLoadState("loading");
      setCatalogError(null);

      try {
        const response = await fetchJson<VideoProductionBriefCatalogResponse>(
          "/api/video-production/brief-catalog",
        );

        if (!isMounted) {
          return;
        }

        setCatalog(response);
        setCatalogLoadState("ready");
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        setCatalogError(errorMessage(caughtError, "Unable to load catalog."));
        setCatalogLoadState("error");
      }
    }

    void loadCatalog();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!catalog) {
      return;
    }

    if (!selectedBrandCode && activeBrands[0]) {
      setSelectedBrandCode(activeBrands[0].brand_code);
    }

    if (!marketState && marketStateOptions[0]) {
      setMarketState(marketStateOptions[0]);
    }

    if (!languageOptions.some((option) => option.code === languageCode)) {
      setLanguageCode(languageOptions[0]?.code ?? "en");
    }

    if (!clientType && clientTypeOptions[0]) {
      setClientType(clientTypeOptions[0].label);
    }

    if (!videoStyle && videoStyleOptions[0]) {
      setVideoStyle(videoStyleOptions[0].label);
    }

    if (!hookAngle && hookAngleOptions[0]) {
      setHookAngle(hookAngleOptions[0].label);
    }

    if (!cta && ctaOptions[0]) {
      setCta(ctaOptions[0].label);
    }

    if (
      selectedCharacterId &&
      !characterOptions.some(
        (character) => character.character_id === selectedCharacterId,
      )
    ) {
      setSelectedCharacterId("");
    }
  }, [
    activeBrands,
    catalog,
    characterOptions,
    clientType,
    clientTypeOptions,
    cta,
    ctaOptions,
    hookAngle,
    hookAngleOptions,
    languageCode,
    languageOptions,
    marketState,
    marketStateOptions,
    selectedCharacterId,
    selectedBrandCode,
    videoStyle,
    videoStyleOptions,
  ]);

  const canEditStoryboard =
    draft !== null && isBriefDraftEditableStatus(draft.status) && !draft.run_id;
  const canEditScript =
    draft !== null && isBriefDraftEditableStatus(draft.status) && !draft.run_id;
  const canSaveScript =
    canEditScript &&
    isScriptDirty &&
    !scriptValidationError &&
    !isSavingScript &&
    !isContinuing;
  const canSaveStoryboard =
    canEditStoryboard &&
    isStoryboardDirty &&
    !storyboardValidationError &&
    !isSavingStoryboard &&
    !isContinuing;
  const scriptForView = editableScript ?? draft?.script ?? null;
  const storyboardForView = editableStoryboard ?? draft?.storyboard ?? null;

  const updateScript = useCallback(
    (updater: (script: ScriptPayload) => ScriptPayload) => {
      setEditableScript((current) => {
        if (!current || !canEditScript) {
          return current;
        }

        setIsScriptDirty(true);
        setScriptSaveStatus(null);
        return updater(current);
      });
    },
    [canEditScript],
  );

  const updateScriptScene = useCallback(
    (sceneIndex: number, patch: Partial<BriefDraftScene>) => {
      updateScript((script) => ({
        ...script,
        scenes: script.scenes.map((scene, index) =>
          index === sceneIndex ? { ...scene, ...patch } : scene,
        ),
      }));
    },
    [updateScript],
  );

  const updateStoryboard = useCallback(
    (updater: (storyboard: StoryboardPayload) => StoryboardPayload) => {
      setEditableStoryboard((current) => {
        if (!current || !canEditStoryboard) {
          return current;
        }

        setIsStoryboardDirty(true);
        setStoryboardSaveStatus(null);
        return updater(current);
      });
    },
    [canEditStoryboard],
  );

  const updateStoryboardScene = useCallback(
    (sceneIndex: number, patch: Partial<BriefDraftScene>) => {
      updateStoryboard((storyboard) => ({
        ...storyboard,
        scenes: storyboard.scenes.map((scene, index) =>
          index === sceneIndex ? { ...scene, ...patch } : scene,
        ),
      }));
    },
    [updateStoryboard],
  );

  const addStoryboardScene = useCallback(() => {
    updateStoryboard((storyboard) => ({
      ...storyboard,
      scenes: renumberStoryboardScenes([
        ...storyboard.scenes,
        createStoryboardScene(
          storyboard.scenes.length + 1,
          storyboard.total_duration_seconds,
        ),
      ]),
    }));
  }, [updateStoryboard]);

  const duplicateStoryboardScene = useCallback(
    (sceneIndex: number) => {
      updateStoryboard((storyboard) => {
        const sourceScene = storyboard.scenes[sceneIndex];
        if (!sourceScene) {
          return storyboard;
        }

        const scenes = [...storyboard.scenes];
        scenes.splice(sceneIndex + 1, 0, { ...sourceScene });
        return {
          ...storyboard,
          scenes: renumberStoryboardScenes(scenes),
        };
      });
    },
    [updateStoryboard],
  );

  const removeStoryboardScene = useCallback(
    (sceneIndex: number) => {
      updateStoryboard((storyboard) => {
        if (storyboard.scenes.length <= 1) {
          return storyboard;
        }

        return {
          ...storyboard,
          scenes: renumberStoryboardScenes(
            storyboard.scenes.filter((_, index) => index !== sceneIndex),
          ),
        };
      });
    },
    [updateStoryboard],
  );

  const moveStoryboardScene = useCallback(
    (sceneIndex: number, direction: -1 | 1) => {
      updateStoryboard((storyboard) => {
        const targetIndex = sceneIndex + direction;
        if (targetIndex < 0 || targetIndex >= storyboard.scenes.length) {
          return storyboard;
        }

        const scenes = [...storyboard.scenes];
        const [scene] = scenes.splice(sceneIndex, 1);
        scenes.splice(targetIndex, 0, scene);
        return {
          ...storyboard,
          scenes: renumberStoryboardScenes(scenes),
        };
      });
    },
    [updateStoryboard],
  );

  useEffect(() => {
    void loadHiggsfieldOAuthStatus();

    if (!reviewerEmail) {
      return;
    }

    function refreshVisibleStatus() {
      if (higgsfieldOAuthPollTimerRef.current !== null) {
        return;
      }

      void loadHiggsfieldOAuthStatus({
        onlyIfVisible: true,
        silent: true,
      });
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        refreshVisibleStatus();
      }
    }

    const statusRefreshInterval = window.setInterval(
      refreshVisibleStatus,
      HIGGSFIELD_OAUTH_STATUS_REFRESH_MS,
    );
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshVisibleStatus);

    return () => {
      window.clearInterval(statusRefreshInterval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshVisibleStatus);
    };
  }, [loadHiggsfieldOAuthStatus, reviewerEmail]);

  useEffect(() => {
    function handleHiggsfieldOAuthMessage(event: MessageEvent) {
      const data = event.data as
        | { provider?: string; success?: boolean; type?: string }
        | null;

      if (
        !data ||
        data.type !== "higgsfield-oauth-complete" ||
        data.provider !== "higgsfield"
      ) {
        return;
      }

      clearHiggsfieldOAuthPolling();
      setHiggsfieldOAuthMessage(
        data.success
          ? "State updated after Higgsfield authorization."
          : "Higgsfield authorization did not complete.",
      );
      void loadHiggsfieldOAuthStatus({ silent: true });
    }

    window.addEventListener("message", handleHiggsfieldOAuthMessage);
    return () => {
      window.removeEventListener("message", handleHiggsfieldOAuthMessage);
      clearHiggsfieldOAuthPolling();
    };
  }, [clearHiggsfieldOAuthPolling, loadHiggsfieldOAuthStatus]);

  return (
    <>
      <section className="grid gap-3 md:grid-cols-3">
        <MetricTile
          label="Draft status"
          value={draft ? briefDraftStatusLabel(draft.status) : "-"}
        />
        <MetricTile
          label="Script scenes"
          value={
            editableScript
              ? String(editableScript.scenes.length)
              : draft
                ? String(draft.script.scenes.length)
                : "0"
          }
        />
        <MetricTile
          label="Video run"
          value={draft?.run_id ? "Started" : "Not started"}
        />
      </section>

      <HiggsfieldConnectionPanel
        authorizationUrl={higgsfieldAuthorizationUrl}
        error={higgsfieldOAuthError}
        isConnecting={isStartingHiggsfieldOAuth}
        isLoading={higgsfieldOAuthLoadState === "loading"}
        isRefreshing={isRefreshingHiggsfieldOAuth}
        message={higgsfieldOAuthMessage}
        onConnect={() => void startHiggsfieldOAuth()}
        onRefreshToken={() => void refreshHiggsfieldOAuth()}
        reviewerEmail={reviewerEmail}
        status={higgsfieldOAuthStatus}
      />

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Single Brief
            </h2>
            <p className="text-sm text-slate-500">
              {draft ? draft.brief_id : "No script generated"}
            </p>
          </div>
          <button
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
            disabled={!briefText && !draft}
            onClick={() => {
              setBriefText("");
              setUseAdvancedOptions(false);
              setDraft(null);
              setEditableScript(null);
              setIsScriptDirty(false);
              setEditableStoryboard(null);
              setIsStoryboardDirty(false);
              setCustomCharacterDescription(DEFAULT_CHARACTER_DESCRIPTION);
              setSceneCount(DEFAULT_SCENE_COUNT);
              setMaxVariants(DEFAULT_VARIANT_COUNT);
              setVideoLengthSeconds(DEFAULT_VIDEO_LENGTH_SECONDS);
              setSubtitlesEnabled(false);
              setBriefError(null);
              setContinueStatus(null);
              setScriptSaveStatus(null);
              setStoryboardSaveStatus(null);
            }}
            type="button"
          >
            Reset
          </button>
        </div>

        {catalogError ? <InlineError message={catalogError} /> : null}

        <form
          className="grid gap-4 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void generateStoryboard();
          }}
        >
          <details className="order-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">
              Advanced options{useAdvancedOptions ? " (using overrides)" : ""}
            </summary>
            <div
              className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4"
              onChange={markAdvancedOptionsUsed}
            >
              <FormField label="Brand" htmlFor="brief-brand-select">
                <SelectControl
                  disabled={catalogLoadState === "loading"}
                  id="brief-brand-select"
                  onChange={(event) => setSelectedBrandCode(event.target.value)}
                  value={selectedBrandCode}
                >
                  {catalogLoadState === "loading" ? (
                    <option value="">Loading catalog</option>
                  ) : null}
                  {catalogLoadState !== "loading" &&
                  activeBrands.length === 0 ? (
                    <option value="">No brands available</option>
                  ) : null}
                  {activeBrands.map((brand) => (
                    <option key={brand.brand_code} value={brand.brand_code}>
                      {brand.brand_name}
                    </option>
                  ))}
                </SelectControl>
              </FormField>

              <FormField label="Market" htmlFor="brief-market-state">
                <SelectControl
                  disabled={catalogLoadState === "loading"}
                  id="brief-market-state"
                  onChange={(event) => setMarketState(event.target.value)}
                  value={marketState}
                >
                  {marketStateOptions.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </SelectControl>
              </FormField>

              <FormField label="Language" htmlFor="brief-language">
                <SelectControl
                  disabled={catalogLoadState === "loading"}
                  id="brief-language"
                  onChange={(event) => setLanguageCode(event.target.value)}
                  value={languageCode}
                >
                  {languageOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </SelectControl>
              </FormField>

              <FormField label="Character" htmlFor="brief-character">
                <SelectControl
                  disabled={catalogLoadState === "loading"}
                  id="brief-character"
                  onChange={(event) =>
                    setSelectedCharacterId(event.target.value)
                  }
                  value={selectedCharacterId}
                >
                  <option value="">No character</option>
                  {characterOptions.map((character) => (
                    <option
                      key={character.character_id}
                      value={character.character_id}
                    >
                      {character.display_name}
                    </option>
                  ))}
                </SelectControl>
              </FormField>

              <div className="md:col-span-2 xl:col-span-4">
                <FormField
                  label="Custom character"
                  htmlFor="brief-custom-character"
                >
                  <textarea
                    className="min-h-20 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-500"
                    disabled={catalogLoadState === "loading"}
                    id="brief-custom-character"
                    onChange={(event) =>
                      setCustomCharacterDescription(event.target.value)
                    }
                    placeholder="Describe the on-camera person if they are not in the catalog."
                    value={customCharacterDescription}
                  />
                </FormField>
              </div>

              <FormField label="Client type" htmlFor="brief-client-type">
                <SelectControl
                  disabled={catalogLoadState === "loading"}
                  id="brief-client-type"
                  onChange={(event) => setClientType(event.target.value)}
                  value={clientType}
                >
                  {clientTypeOptions.map((option) => (
                    <option key={option.code} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </SelectControl>
              </FormField>

              <FormField label="Video style" htmlFor="brief-video-style">
                <SelectControl
                  disabled={catalogLoadState === "loading"}
                  id="brief-video-style"
                  onChange={(event) => setVideoStyle(event.target.value)}
                  value={videoStyle}
                >
                  {videoStyleOptions.map((option) => (
                    <option key={option.code} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </SelectControl>
              </FormField>

              <FormField label="Awareness" htmlFor="brief-awareness-level">
                <SelectControl
                  disabled={catalogLoadState === "loading"}
                  id="brief-awareness-level"
                  onChange={(event) => setAwarenessLevel(event.target.value)}
                  value={awarenessLevel}
                >
                  {awarenessLevelOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </SelectControl>
              </FormField>

              <FormField label="Hook" htmlFor="brief-hook-angle">
                <SelectControl
                  disabled={catalogLoadState === "loading"}
                  id="brief-hook-angle"
                  onChange={(event) => setHookAngle(event.target.value)}
                  value={hookAngle}
                >
                  {hookAngleOptions.map((option) => (
                    <option key={option.code} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </SelectControl>
              </FormField>

              <FormField label="CTA" htmlFor="brief-cta">
                <SelectControl
                  disabled={catalogLoadState === "loading"}
                  id="brief-cta"
                  onChange={(event) => setCta(event.target.value)}
                  value={cta}
                >
                  {ctaOptions.map((option) => (
                    <option key={option.code} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </SelectControl>
              </FormField>

              <FormField label="Scenes" htmlFor="brief-scene-count">
                <SelectControl
                  disabled={catalogLoadState === "loading"}
                  id="brief-scene-count"
                  onChange={(event) => setSceneCount(event.target.value)}
                  value={sceneCount}
                >
                  {sceneCountOptions.map((count) => (
                    <option key={count} value={count}>
                      {count} scenes
                    </option>
                  ))}
                </SelectControl>
              </FormField>

              <FormField label="Video length" htmlFor="brief-video-length">
                <SelectControl
                  disabled={catalogLoadState === "loading"}
                  id="brief-video-length"
                  onChange={(event) =>
                    setVideoLengthSeconds(Number(event.target.value))
                  }
                  value={String(videoLengthSeconds)}
                >
                  {videoLengthOptions.map((duration) => (
                    <option key={duration} value={duration}>
                      {duration}s
                    </option>
                  ))}
                </SelectControl>
              </FormField>

              <div className="grid gap-1.5">
                <span className="text-xs font-semibold text-slate-700">
                  Subtitles
                </span>
                <button
                  aria-pressed={subtitlesEnabled}
                  className={`inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 ${
                    subtitlesEnabled
                      ? "border-teal-500 bg-teal-50 text-teal-800"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                  }`}
                  disabled={catalogLoadState === "loading"}
                  onClick={() => {
                    markAdvancedOptionsUsed();
                    setSubtitlesEnabled((current) => !current);
                  }}
                  type="button"
                >
                  {subtitlesEnabled ? "Subtitles on" : "Subtitles off"}
                </button>
              </div>

              <FormField label="Variants" htmlFor="brief-max-variants">
                <SelectControl
                  disabled={catalogLoadState === "loading"}
                  id="brief-max-variants"
                  onChange={(event) =>
                    setMaxVariants(Number(event.target.value))
                  }
                  value={String(maxVariants)}
                >
                  {variantOptions.map((variant) => (
                    <option key={variant} value={variant}>
                      {variant}
                    </option>
                  ))}
                </SelectControl>
              </FormField>
            </div>
          </details>

          <div className="order-1 grid gap-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
                Include if available
              </p>
              <ul className="mt-2 grid gap-x-4 gap-y-1 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
                {promptChecklist.map((item) => (
                  <li className="flex gap-2" key={item}>
                    <span aria-hidden="true" className="text-teal-600">
                      -
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <label
              className="text-sm font-semibold text-slate-950"
              htmlFor="brief-director-prompt"
            >
              Prompt
            </label>
            <textarea
              aria-describedby="brief-director-status"
              aria-keyshortcuts="Control+Enter Meta+Enter"
              className="min-h-36 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              id="brief-director-prompt"
              onChange={(event) => {
                setBriefText(event.target.value);
              }}
              onKeyDown={(event) => {
                if (
                  (event.ctrlKey || event.metaKey) &&
                  event.key === "Enter" &&
                  canGenerate
                ) {
                  event.preventDefault();
                  void generateStoryboard();
                }
              }}
              placeholder={manualPromptPlaceholder}
              value={briefText}
            />
          </div>

          <div className="order-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p
              aria-live="polite"
              className="text-sm text-slate-500"
              id="brief-director-status"
            >
              {isCatalogLoading
                ? "Loading autofill catalog"
                : reviewerEmail
                  ? `Creating as ${reviewerEmail}`
                  : "Email required"}
            </p>
            <button
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canGenerate}
              type="submit"
            >
              {isGeneratingStoryboard ? "Generating" : "Generate script"}
            </button>
          </div>
        </form>

        {briefError ? <InlineError message={briefError} /> : null}

        {!draft && !briefError ? (
          <div className="border-t border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
            No script generated.
          </div>
        ) : null}
      </section>

      {draft ? (
        <section
          className="rounded-lg border border-slate-200 bg-white shadow-sm"
          ref={previewRef}
          tabIndex={-1}
        >
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-slate-950">
                  Script Review
                </h2>
                <StatusPill
                  label={briefDraftStatusLabel(draft.status)}
                  tone={briefDraftStatusTone(draft.status)}
                />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {scriptForView
                  ? `${scriptForView.scenes.length} scene${
                      scriptForView.scenes.length === 1 ? "" : "s"
                    } / ${scriptForView.total_duration_seconds}s`
                  : "Script generated"}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canSaveScript}
                onClick={() => void saveScript()}
                type="button"
              >
                {isSavingScript ? "Saving" : "Save script"}
              </button>
              <button
                className="inline-flex h-10 items-center justify-center rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canContinue}
                onClick={() => void continueToVideo()}
                type="button"
              >
                {isContinuing ? "Starting" : "Continue to video"}
              </button>
            </div>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="grid content-start gap-4">
              <DescriptionGrid
                rows={[
                  ["Brand", briefDraftValue(draft, "brand")],
                  ["Market", briefDraftValue(draft, "market")],
                  ["Client type", briefDraftValue(draft, "client_type")],
                  ["Hook", briefDraftValue(draft, "hook_angle")],
                  ["CTA", briefDraftValue(draft, "cta")],
                  ["Brief ID", draft.brief_id],
                  ["Draft ID", draft.draft_id],
                  ["Prompt variants", String(draft.prompt_count)],
                  [
                    "Script scenes",
                    scriptForView ? String(scriptForView.scenes.length) : "-",
                  ],
                  ["Run ID", draft.run_id ?? "-"],
                ]}
              />

              {scriptValidationError ? (
                <InlineError message={scriptValidationError} />
              ) : null}

              {scriptSaveStatus ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {scriptSaveStatus}
                </p>
              ) : null}

              {continueStatus ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {continueStatus}
                </p>
              ) : null}
            </div>

            {scriptForView ? (
              <div className="grid gap-4">
                <ScriptEditor
                  canEdit={canEditScript && !isContinuing}
                  onFieldChange={(patch) =>
                    updateScript((script) => ({ ...script, ...patch }))
                  }
                  onSceneChange={updateScriptScene}
                  script={scriptForView}
                />

                {storyboardForView ? (
                  <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                      Storyboard ({storyboardForView.scenes.length} scene
                      {storyboardForView.scenes.length === 1 ? "" : "s"})
                    </summary>
                    <div className="mt-4 grid gap-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-slate-500">
                          {storyboardForView.visual_style}
                        </p>
                        <button
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={!canSaveStoryboard}
                          onClick={() => void saveStoryboard()}
                          type="button"
                        >
                          {isSavingStoryboard ? "Saving" : "Save storyboard"}
                        </button>
                      </div>

                      {storyboardForView.scene_count_reason ? (
                        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                          {storyboardForView.scene_count_reason}
                        </p>
                      ) : null}

                      {storyboardValidationError ? (
                        <InlineError message={storyboardValidationError} />
                      ) : null}

                      {storyboardSaveStatus ? (
                        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                          {storyboardSaveStatus}
                        </p>
                      ) : null}

                      <StoryboardEditor
                        canEdit={canEditStoryboard && !isContinuing}
                        onAddScene={addStoryboardScene}
                        onDuplicateScene={duplicateStoryboardScene}
                        onMoveScene={moveStoryboardScene}
                        onRemoveScene={removeStoryboardScene}
                        onSceneChange={updateStoryboardScene}
                        onVisualStyleChange={(visualStyle) =>
                          updateStoryboard((storyboard) => ({
                            ...storyboard,
                            visual_style: visualStyle,
                          }))
                        }
                        storyboard={storyboardForView}
                      />
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}

function HiggsfieldConnectionPanel({
  authorizationUrl,
  error,
  isConnecting,
  isLoading,
  isRefreshing,
  message,
  onConnect,
  onRefreshToken,
  reviewerEmail,
  status,
}: {
  authorizationUrl: string | null;
  error: string | null;
  isConnecting: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  message: string | null;
  onConnect: () => void;
  onRefreshToken: () => void;
  reviewerEmail: string;
  status: HiggsfieldOAuthStatusResponse | null;
}) {
  const isConnected = Boolean(status?.connected);
  const stateValue = isLoading
    ? "Checking"
    : isConnected
      ? "Connected"
      : status?.status === "reconnect_required"
        ? "Reconnect"
        : "Not connected";
  const statusTone: StatusTone = isLoading
    ? "amber"
    : isConnected
      ? "teal"
      : status?.status === "reconnect_required"
        ? "rose"
        : "slate";
  const connectedLabel =
    status?.connected_email || status?.owner_email || reviewerEmail || "-";
  const detailLabel = isConnected
    ? connectedLabel
    : reviewerEmail
      ? reviewerEmail
      : "Email required";

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-950">
              Higgsfield
            </h2>
            <StatusPill label={stateValue} tone={statusTone} />
          </div>
          <p className="mt-1 break-words text-sm text-slate-500">
            State: {stateValue.toLowerCase()} / {detailLabel}
          </p>
          {status?.expires_at ? (
            <p className="mt-1 text-xs text-slate-500">
              Expires {formatTimestamp(status.expires_at)}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!reviewerEmail || isConnecting}
            onClick={onConnect}
            type="button"
          >
            {isConnecting
              ? "Opening"
              : isConnected
                ? "Reconnect"
                : "Connect"}
          </button>
          <button
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!reviewerEmail || !status?.has_refresh_token || isRefreshing}
            onClick={onRefreshToken}
            type="button"
          >
            {isRefreshing ? "Renewing" : "Renew"}
          </button>
        </div>
      </div>

      {message ? (
        <p className="border-t border-slate-200 px-4 py-3 text-sm text-slate-700">
          {message}
          {authorizationUrl ? (
            <>
              {" "}
              <a
                className="font-semibold text-teal-700 underline-offset-2 hover:underline"
                href={authorizationUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open link
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      {error ? <InlineError message={error} /> : null}
    </section>
  );
}

function ScriptEditor({
  canEdit,
  onFieldChange,
  onSceneChange,
  script,
}: {
  canEdit: boolean;
  onFieldChange: (patch: Partial<ScriptPayload>) => void;
  onSceneChange: (
    sceneIndex: number,
    patch: Partial<BriefDraftScene>,
  ) => void;
  script: ScriptPayload;
}) {
  return (
    <div className="grid gap-4">
      <StoryboardTextArea
        disabled={!canEdit}
        id="script-hook"
        label="Hook"
        onChange={(value) => onFieldChange({ hook: value })}
        value={script.hook}
      />

      <div className="grid gap-3">
        <StoryboardTextArea
          disabled={!canEdit}
          id="script-body"
          label="Body"
          onChange={(value) => onFieldChange({ body: value })}
          value={script.body}
        />
        <StoryboardTextArea
          disabled={!canEdit}
          id="script-cta"
          label="CTA"
          onChange={(value) => onFieldChange({ cta: value })}
          value={script.cta}
        />
      </div>

      <div className="border-b border-slate-200 pb-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Voiceover</h3>
          <p className="text-xs text-slate-500">
            {script.scenes.length} scene
            {script.scenes.length === 1 ? "" : "s"} /{" "}
            {script.total_duration_seconds}s total
          </p>
        </div>
      </div>

      <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
        {script.scenes.map((scene, index) => (
          <div className="grid gap-3 p-3" key={`script-scene-${scene.scene_number}`}>
            <StoryboardTextArea
              disabled={!canEdit}
              id={`script-scene-${scene.scene_number}-voiceover`}
              label={`Scene ${scene.scene_number}`}
              onChange={(value) => onSceneChange(index, { voiceover: value })}
              value={scene.voiceover}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function StoryboardEditor({
  canEdit,
  onAddScene,
  onDuplicateScene,
  onMoveScene,
  onRemoveScene,
  onSceneChange,
  onVisualStyleChange,
  storyboard,
}: {
  canEdit: boolean;
  onAddScene: () => void;
  onDuplicateScene: (sceneIndex: number) => void;
  onMoveScene: (sceneIndex: number, direction: -1 | 1) => void;
  onRemoveScene: (sceneIndex: number) => void;
  onSceneChange: (
    sceneIndex: number,
    patch: Partial<BriefDraftScene>,
  ) => void;
  onVisualStyleChange: (visualStyle: string) => void;
  storyboard: StoryboardPayload;
}) {
  return (
    <div className="grid gap-4">
      <FormField label="Visual style" htmlFor="storyboard-visual-style">
        <input
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-500"
          disabled={!canEdit}
          id="storyboard-visual-style"
          onChange={(event) => onVisualStyleChange(event.target.value)}
          value={storyboard.visual_style}
        />
      </FormField>

      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Scenes</h3>
          <p className="text-xs text-slate-500">
            {storyboard.scenes.length} scene
            {storyboard.scenes.length === 1 ? "" : "s"} /{" "}
            {storyboard.total_duration_seconds}s total
          </p>
        </div>
        <button
          className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canEdit}
          onClick={onAddScene}
          type="button"
        >
          Add scene
        </button>
      </div>

      <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
        {storyboard.scenes.map((scene, index) => (
          <div className="grid gap-3 p-3" key={`scene-${scene.scene_number}`}>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  Scene {scene.scene_number}
                </p>
                <p className="text-xs text-slate-500">
                  {scene.duration_seconds}s
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canEdit || index === 0}
                  onClick={() => onMoveScene(index, -1)}
                  type="button"
                >
                  Move up
                </button>
                <button
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canEdit || index === storyboard.scenes.length - 1}
                  onClick={() => onMoveScene(index, 1)}
                  type="button"
                >
                  Move down
                </button>
                <button
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canEdit}
                  onClick={() => onDuplicateScene(index)}
                  type="button"
                >
                  Duplicate
                </button>
                <button
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-rose-200 bg-white px-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canEdit || storyboard.scenes.length <= 1}
                  onClick={() => onRemoveScene(index)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)]">
              <FormField
                label="Duration"
                htmlFor={`storyboard-scene-${scene.scene_number}-duration`}
              >
                <input
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-500"
                  disabled={!canEdit}
                  id={`storyboard-scene-${scene.scene_number}-duration`}
                  min={1}
                  onChange={(event) =>
                    onSceneChange(index, {
                      duration_seconds: Number(event.target.value),
                    })
                  }
                  type="number"
                  value={scene.duration_seconds}
                />
              </FormField>
              <FormField
                label="On-screen text"
                htmlFor={`storyboard-scene-${scene.scene_number}-text`}
              >
                <input
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-500"
                  disabled={!canEdit}
                  id={`storyboard-scene-${scene.scene_number}-text`}
                  onChange={(event) =>
                    onSceneChange(index, {
                      on_screen_text: event.target.value,
                    })
                  }
                  value={scene.on_screen_text}
                />
              </FormField>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <StoryboardTextArea
                disabled={!canEdit}
                id={`storyboard-scene-${scene.scene_number}-visual`}
                label="Visual direction"
                onChange={(value) =>
                  onSceneChange(index, { visual_direction: value })
                }
                value={scene.visual_direction}
              />
              <StoryboardTextArea
                disabled={!canEdit}
                id={`storyboard-scene-${scene.scene_number}-voiceover`}
                label="Voiceover"
                onChange={(value) => onSceneChange(index, { voiceover: value })}
                value={scene.voiceover}
              />
              <StoryboardTextArea
                disabled={!canEdit}
                id={`storyboard-scene-${scene.scene_number}-camera`}
                label="Camera style"
                onChange={(value) =>
                  onSceneChange(index, { camera_style: value })
                }
                value={scene.camera_style}
              />
              <StoryboardTextArea
                disabled={!canEdit}
                id={`storyboard-scene-${scene.scene_number}-transition`}
                label="Transition"
                onChange={(value) =>
                  onSceneChange(index, { transition: value || null })
                }
                value={scene.transition ?? ""}
              />
              <div className="md:col-span-2">
                <StoryboardTextArea
                  disabled={!canEdit}
                  id={`storyboard-scene-${scene.scene_number}-notes`}
                  label="Notes"
                  onChange={(value) =>
                    onSceneChange(index, { notes: value || null })
                  }
                  value={scene.notes ?? ""}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StoryboardTextArea({
  disabled,
  id,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <FormField label={label} htmlFor={id}>
      <textarea
        className="min-h-24 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-500"
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </FormField>
  );
}
function VideoApprovalsPanel({
  items,
  listError,
  loadReviews,
  loadState,
  openAsset,
  pendingCount,
  reviewedCount,
  selectedAssetId,
}: {
  items: ReviewAssetListItem[];
  listError: string | null;
  loadReviews: () => Promise<void>;
  loadState: LoadState;
  openAsset: (item: ReviewAssetListItem) => void;
  pendingCount: number;
  reviewedCount: number;
  selectedAssetId: string | null;
}) {
  const [activeFilter, setActiveFilter] =
    useState<VideoReviewFilter>("waiting");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const normalizedSearch = normalizeSearchToken(searchQuery);
  const filterCounts = useMemo(() => buildFilterCounts(items), [items]);
  const filteredItems = useMemo(
    () =>
      items.filter(
        (item) =>
          matchesVideoReviewFilter(item, activeFilter) &&
          matchesVideoSearch(item, normalizedSearch),
      ),
    [activeFilter, items, normalizedSearch],
  );
  const hasNoFilteredResults =
    loadState === "ready" && items.length > 0 && filteredItems.length === 0;

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      const target = event.target;
      const isEditableTarget =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT");
      const shouldFocusSearch =
        event.key === "/" ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k");

      if (!shouldFocusSearch || isEditableTarget) {
        return;
      }

      event.preventDefault();
      searchInputRef.current?.focus();
    }

    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <>
      <section className="grid gap-3 md:grid-cols-3">
        <MetricTile label="Pending Review" value={String(pendingCount)} />
        <MetricTile label="Reviewed" value={String(reviewedCount)} />
        <MetricTile label="Total loaded" value={String(items.length)} />
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Video Queue
            </h2>
            <p className="text-sm text-slate-500">
              {loadState === "ready"
                ? `${filteredItems.length} of ${items.length} video${
                    items.length === 1 ? "" : "s"
                  }`
                : "Loading"}
            </p>
          </div>
          <button
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
            onClick={() => void loadReviews()}
            type="button"
          >
            Refresh
          </button>
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            aria-label="Video review status filter"
            className="flex gap-2 overflow-x-auto"
            role="group"
          >
            {videoReviewFilters.map((filter) => {
              const isActive = filter.id === activeFilter;
              const count = filterCounts[filter.id];

              return (
                <button
                  aria-pressed={isActive}
                  className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 ${
                    isActive
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                  }`}
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  type="button"
                >
                  <span>{filter.label}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-xs ${
                      isActive
                        ? "bg-white/15 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1 lg:max-w-md">
            <label className="sr-only" htmlFor="video-approval-search">
              Search videos
            </label>
            <input
              aria-controls="video-approvals-results"
              aria-describedby="video-approvals-result-count"
              aria-keyshortcuts="/ Control+K Meta+K"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              id="video-approval-search"
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && searchQuery) {
                  event.stopPropagation();
                  setSearchQuery("");
                }
              }}
              placeholder="Search brand, brief, asset, variant, market"
              ref={searchInputRef}
              type="search"
              value={searchQuery}
            />
            <p
              aria-live="polite"
              className="sr-only"
              id="video-approvals-result-count"
            >
              {filteredItems.length} videos visible out of {items.length}.
            </p>
          </div>
        </div>

        {loadState === "error" ? (
          <InlineError message={listError ?? "Unable to load review queue."} />
        ) : null}

        {loadState === "loading" ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                className="h-12 rounded-lg bg-slate-100"
                key={`review-skeleton-${index}`}
              />
            ))}
          </div>
        ) : null}

        {loadState === "ready" && items.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            No loaded videos.
          </div>
        ) : null}

        {hasNoFilteredResults ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            No videos match this view.
          </div>
        ) : null}

        {filteredItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table
              className="min-w-full divide-y divide-slate-200 text-left text-sm"
              id="video-approvals-results"
            >
              <thead className="bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
                <tr>
                  <TableHead>Brand</TableHead>
                  <TableHead>Brief</TableHead>
                  <TableHead>Asset / Variant</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead>Creative</TableHead>
                  <TableHead>QC</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredItems.map((item) => (
                  <tr
                    className={
                      selectedAssetId === item.asset_id
                        ? "bg-teal-50/70"
                        : "hover:bg-slate-50"
                    }
                    key={item.asset_id}
                  >
                    <TableCell strong>{item.brand}</TableCell>
                    <TableCell>
                      <CodeText>{item.brief_id}</CodeText>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <CodeText>{item.asset_id}</CodeText>
                        <span className="text-xs text-slate-500">
                          {item.variant_id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span>{item.state}</span>
                        <span className="text-xs text-slate-500">
                          {item.client_type}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-[220px] flex-col gap-1">
                        <span className="truncate">{item.video_style}</span>
                        <span className="truncate text-xs text-slate-500">
                          {item.hook_angle}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        label={`${item.qc_status ?? "n/a"} ${formatQcScore(
                          item.qc_score,
                        )}`}
                        tone={item.qc_status === "passed" ? "teal" : "amber"}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <StatusPill
                          label={reviewStatusLabel(item)}
                          tone={reviewStatusTone(item)}
                        />
                        {item.reviewed_by ? (
                          <span className="text-xs text-slate-500">
                            {item.reviewed_by}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{formatTimestamp(item.created_at)}</TableCell>
                    <TableCell>
                      <button
                        aria-label={`Open asset ${item.asset_id}`}
                        className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
                        onClick={() => openAsset(item)}
                        type="button"
                      >
                        Open
                      </button>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  );
}

function ReviewDetailModal({
  decisionStatus,
  detail,
  detailError,
  isDetailLoading,
  isSubmittingDecision,
  onClose,
  onDecision,
  reviewerEmail,
  selectedAssetId,
}: {
  decisionStatus: string | null;
  detail: ReviewAssetDetailResponse | null;
  detailError: string | null;
  isDetailLoading: boolean;
  isSubmittingDecision: boolean;
  onClose: () => void;
  onDecision: (decision: ReviewDecision) => void;
  reviewerEmail: string;
  selectedAssetId: string;
}) {
  const [useVideoProxy, setUseVideoProxy] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoProxyUrl = detail?.asset.storage_url
    ? `/api/video-production/reviews/${encodeURIComponent(
        detail.asset.asset_id,
      )}/video`
    : null;
  const videoSourceUrl =
    !useVideoProxy && detail?.asset.signed_video_url
      ? detail.asset.signed_video_url
      : videoProxyUrl;

  useEffect(() => {
    setUseVideoProxy(false);
    setVideoError(null);
  }, [
    detail?.asset.asset_id,
    detail?.asset.signed_video_url,
    detail?.asset.storage_url,
  ]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      aria-labelledby="video-review-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-40"
      role="dialog"
    >
      <button
        aria-label="Close"
        className="absolute inset-0 h-full w-full bg-slate-950/45"
        onClick={onClose}
        type="button"
      />
      <section className="absolute inset-y-0 right-0 flex w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl md:my-4 md:mr-4 md:rounded-lg">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
              Asset Review
            </p>
            <h2
              className="truncate text-lg font-semibold text-slate-950"
              id="video-review-dialog-title"
            >
              {selectedAssetId}
            </h2>
          </div>
          <button
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isDetailLoading ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
              <div className="aspect-video rounded-lg bg-slate-100" />
              <div className="space-y-3">
                <div className="h-24 rounded-lg bg-slate-100" />
                <div className="h-36 rounded-lg bg-slate-100" />
              </div>
            </div>
          ) : null}

          {detailError ? <InlineError message={detailError} /> : null}

          {detail ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
              <div className="flex flex-col gap-4">
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
                  {videoSourceUrl ? (
                    <div className="relative">
                      <video
                        key={videoSourceUrl}
                        className="aspect-video w-full bg-slate-950"
                        controls
                        onError={() => {
                          if (!useVideoProxy && videoProxyUrl) {
                            setUseVideoProxy(true);
                            return;
                          }
                          setVideoError("Video preview failed to load.");
                        }}
                        preload="metadata"
                        src={videoSourceUrl}
                      />
                      {videoError ? (
                        <div className="absolute inset-x-0 bottom-0 bg-slate-950/85 px-3 py-2 text-sm text-white">
                          {videoError}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex aspect-video items-center justify-center text-sm text-white">
                      Video unavailable
                    </div>
                  )}
                </div>

                <DetailSection title="Brief Summary">
                  <DescriptionGrid
                    rows={[
                      ["Brand", briefValue(detail, "brand")],
                      ["State", briefValue(detail, "state")],
                      ["Client type", briefValue(detail, "client_type")],
                      ["Video style", briefValue(detail, "video_style")],
                      ["Hook", briefValue(detail, "hook_angle")],
                      ["CTA", briefValue(detail, "cta")],
                    ]}
                  />
                </DetailSection>

                <DetailSection title="Artifacts">
                  <DescriptionGrid
                    rows={[
                      ["Script", detail.artifacts.script_url ?? "-"],
                      ["Storyboard", detail.artifacts.storyboard_url ?? "-"],
                      ["Prompt", detail.artifacts.prompt_url ?? "-"],
                      ["QC report", detail.artifacts.qc_report_url ?? "-"],
                    ]}
                  />
                </DetailSection>
              </div>

              <aside className="flex flex-col gap-4">
                <DetailSection title="QC / Compliance">
                  <DescriptionGrid
                    rows={[
                      ["Operational status", detail.asset.status],
                      ["QC status", detail.asset.qc_status ?? "-"],
                      ["QC score", formatQcScore(detail.asset.qc_score)],
                      [
                        "Human review",
                        detail.asset.human_review_required ? "Required" : "No",
                      ],
                    ]}
                  />
                </DetailSection>

                <DetailSection title="Asset Metadata">
                  <DescriptionGrid
                    rows={[
                      ["Brief ID", detail.asset.brief_id],
                      ["Asset ID", detail.asset.asset_id],
                      ["Variant", detail.asset.variant_id],
                      ["Storage", detail.asset.storage_url ?? "-"],
                      ["Created", formatTimestamp(detail.asset.created_at)],
                    ]}
                  />
                </DetailSection>

                <DetailSection title="Approval">
                  <div className="flex flex-col gap-3">
                    {canReviewAsset(detail.asset) ? (
                      <>
                        <DescriptionGrid
                          rows={[["Reviewing as", reviewerEmail || "-"]]}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            className="inline-flex h-10 items-center justify-center rounded-lg bg-teal-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isSubmittingDecision || !reviewerEmail}
                            onClick={() => onDecision("approved")}
                            type="button"
                          >
                            Approve
                          </button>
                          <button
                            className="inline-flex h-10 items-center justify-center rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isSubmittingDecision || !reviewerEmail}
                            onClick={() => onDecision("rejected")}
                            type="button"
                          >
                            Reject
                          </button>
                        </div>
                      </>
                    ) : null}
                    {decisionStatus ? (
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {decisionStatus}
                      </p>
                    ) : null}
                    <DescriptionGrid
                      rows={[
                        ["Decision", reviewStatusLabel(detail.asset)],
                        ["Reviewed by", detail.asset.reviewed_by ?? "-"],
                        [
                          "Reviewed at",
                          formatTimestamp(detail.asset.reviewed_at),
                        ],
                      ]}
                    />
                  </div>
                </DetailSection>
              </aside>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function FormField({
  children,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-semibold text-slate-700" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

function SelectControl({
  children,
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

function DetailSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DescriptionGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid gap-3 text-sm">
      {rows.map(([label, value]) => (
        <div className="grid gap-1" key={label}>
          <dt className="text-xs font-semibold uppercase tracking-normal text-slate-500">
            {label}
          </dt>
          <dd className="break-words text-slate-800">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function TableCell({
  children,
  strong = false,
}: {
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <td
      className={`px-4 py-3 align-top ${
        strong ? "font-semibold text-slate-950" : "text-slate-700"
      }`}
    >
      {children}
    </td>
  );
}

function CodeText({ children }: { children: string }) {
  return <span className="font-mono text-xs text-slate-700">{children}</span>;
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: StatusTone;
}) {
  const classes = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    teal: "border-teal-200 bg-teal-50 text-teal-800",
  };

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[tone]}`}
    >
      {label}
    </span>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {message}
    </div>
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail =
      payload && typeof payload.detail === "string" ? payload.detail : null;

    throw new Error(detail ?? `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

function latestTimestamp(items: ReviewAssetListItem[]): string | null {
  const timestamps = items
    .map((item) => item.created_at)
    .filter((value): value is string => Boolean(value));

  if (!timestamps.length) {
    return null;
  }

  return timestamps.sort().at(-1) ?? null;
}

function formatTimestamp(value?: string | null): string {
  return value ? formatDashboardTimestamp(value) : "-";
}

function formatQcScore(value?: number | null): string {
  return typeof value === "number" ? value.toFixed(3) : "n/a";
}

function briefDraftStatusLabel(status: BriefDraftResponse["status"]): string {
  if (status === "generation_submitted") {
    return "Submitted";
  }

  if (status === "generation_failed") {
    return "Failed";
  }

  return "Script ready";
}

function briefDraftStatusTone(status: BriefDraftResponse["status"]): StatusTone {
  if (status === "generation_submitted") {
    return "teal";
  }

  if (status === "generation_failed") {
    return "rose";
  }

  return "amber";
}

function isBriefDraftEditableStatus(
  status: BriefDraftResponse["status"],
): boolean {
  return status === "storyboard_ready" || status === "generation_failed";
}

function briefDraftValue(
  draft: BriefDraftResponse,
  key: "brand" | "client_type" | "cta" | "hook_angle" | "market",
): string {
  if (key === "brand") {
    return String(asRecord(draft.brief.brand)?.name ?? "-");
  }

  if (key === "market") {
    return String(asRecord(draft.brief.market)?.state ?? "-");
  }

  if (key === "client_type") {
    return String(asRecord(draft.brief.market)?.client_type ?? "-");
  }

  return String(asRecord(draft.brief.creative)?.[key] ?? "-");
}

function buildBriefDraftMetadata({
  awarenessLevel,
  brand,
  character,
  customCharacterDescription,
  clientType,
  cta,
  hookAngle,
  languageCode,
  languageLabel,
  marketState,
  maxVariants,
  sceneCount,
  subtitlesEnabled,
  videoLengthSeconds,
  videoStyle,
}: {
  awarenessLevel: string;
  brand: VideoProductionBrandOption;
  character: VideoProductionCharacterOption | null;
  customCharacterDescription: string;
  clientType: string;
  cta: string;
  hookAngle: string;
  languageCode: string;
  languageLabel: string;
  marketState: string;
  maxVariants: number;
  sceneCount: string;
  subtitlesEnabled: boolean;
  videoLengthSeconds: number;
  videoStyle: string;
}): Record<string, unknown> {
  const parsedSceneCount =
    sceneCount === "auto" ? null : clampNumber(Number(sceneCount), 1, 8, 3);
  const parsedVideoLengthSeconds = clampNumber(videoLengthSeconds, 15, 60, 15);
  const trimmedCharacterDescription = customCharacterDescription.trim();
  const characterDescription =
    trimmedCharacterDescription || character?.description || null;

  return {
    brand: {
      brand_aliases: brand.brand_aliases,
      brand_code: brand.brand_code,
      brand_name: brand.brand_name,
      meta_ad_account_id: brand.meta_ad_account_id,
      slack_channel: brand.slack_channel,
    },
    character: character
      ? {
          brand_code: character.brand_code,
          character_id: character.character_id,
          description: character.description,
          display_name: character.display_name,
          image_url: character.image_url,
          language: character.language,
          metadata: character.metadata,
          thumbnail_url: character.thumbnail_url,
        }
      : trimmedCharacterDescription
        ? {
            custom_description: trimmedCharacterDescription,
            description: trimmedCharacterDescription,
          }
        : null,
    constraints: {
      compliance_level: "regulated",
      max_variants: clampNumber(maxVariants, 1, 3, 3),
      requires_human_approval: true,
    },
    creative: {
      aspect_ratio: REELS_ASPECT_RATIO,
      awareness_level: awarenessLevel.trim() || "problem-aware",
      cta: cta.trim() || "Book a free consultation",
      duration_seconds: parsedVideoLengthSeconds,
      hook_angle: hookAngle.trim() || "free consultation",
      platform: REELS_PLATFORM,
      scene_count: parsedSceneCount,
      subtitles_enabled: subtitlesEnabled,
      video_style: videoStyle.trim() || "UGC testimonial",
      character_description: characterDescription,
      character_id: character?.character_id ?? null,
      character_image_url: character?.image_url ?? null,
      character_name: character?.display_name ?? null,
    },
    language: {
      code: languageCode,
      label: languageLabel,
    },
    market: {
      client_type: clientType.trim() || "personal injury",
      language: languageLabel,
      state: marketState.trim() || "Florida",
    },
  };
}

function buildBriefDraftAutofillMetadata({
  activeBrands,
  awarenessLevelOptions,
  characters,
  clientTypeOptions,
  ctaOptions,
  hookAngleOptions,
  languageOptions,
  marketStateOptions,
  variantOptions,
  videoStyleOptions,
}: {
  activeBrands: VideoProductionBrandOption[];
  awarenessLevelOptions: VideoProductionCatalogOption[];
  characters: VideoProductionCharacterOption[];
  clientTypeOptions: VideoProductionClientTypeOption[];
  ctaOptions: VideoProductionCatalogOption[];
  hookAngleOptions: VideoProductionCatalogOption[];
  languageOptions: VideoProductionCatalogOption[];
  marketStateOptions: string[];
  variantOptions: number[];
  videoStyleOptions: VideoProductionCatalogOption[];
}): Record<string, unknown> {
  return {
    autofill_options: {
      awareness_levels: awarenessLevelOptions.map(catalogOptionForAutofill),
      brands: activeBrands.map((brand) => ({
        aliases: brand.brand_aliases,
        brand_code: brand.brand_code,
        brand_name: brand.brand_name,
      })),
      characters: characters
        .filter((character) => character.is_active)
        .map((character) => ({
          brand_code: character.brand_code,
          character_id: character.character_id,
          description: character.description,
          display_name: character.display_name,
          language: character.language,
        })),
      client_types: clientTypeOptions.map((option) => ({
        awareness_level: option.awareness_level,
        code: option.code,
        label: option.label,
      })),
      ctas: ctaOptions.map(catalogOptionForAutofill),
      hook_angles: hookAngleOptions.map(catalogOptionForAutofill),
      languages: languageOptions.map(catalogOptionForAutofill),
      market_states: marketStateOptions,
      max_variants: variantOptions,
      scene_counts: ["auto", ...sceneCountOptions],
      video_lengths_seconds: videoLengthOptions,
      video_styles: videoStyleOptions.map(catalogOptionForAutofill),
    },
    character: {
      custom_description: DEFAULT_CHARACTER_DESCRIPTION,
      description: DEFAULT_CHARACTER_DESCRIPTION,
    },
    constraints: {
      compliance_level: "regulated",
      max_variants: DEFAULT_VARIANT_COUNT,
      requires_human_approval: true,
    },
    creative: {
      aspect_ratio: REELS_ASPECT_RATIO,
      character_description: DEFAULT_CHARACTER_DESCRIPTION,
      duration_seconds: DEFAULT_VIDEO_LENGTH_SECONDS,
      platform: REELS_PLATFORM,
      scene_count: Number(DEFAULT_SCENE_COUNT),
      subtitles_enabled: false,
    },
    input_mode: "manual_prompt_autofill",
    production_defaults: {
      aspect_ratio: REELS_ASPECT_RATIO,
      duration_seconds: DEFAULT_VIDEO_LENGTH_SECONDS,
      platform: REELS_PLATFORM,
      scene_count: Number(DEFAULT_SCENE_COUNT),
      subtitles_enabled: false,
    },
    prompt_requirements: promptChecklist,
  };
}

function catalogOptionForAutofill(option: VideoProductionCatalogOption) {
  return {
    code: option.code,
    label: option.label,
  };
}

function validateScript(script: ScriptPayload | null): string | null {
  if (!script) {
    return null;
  }

  if (!script.hook.trim()) {
    return "Script hook is required.";
  }

  if (!script.body.trim()) {
    return "Script body is required.";
  }

  if (!script.cta.trim()) {
    return "Script CTA is required.";
  }

  if (
    !Number.isFinite(script.total_duration_seconds) ||
    script.total_duration_seconds <= 0
  ) {
    return "Script duration must be greater than 0.";
  }

  if (script.scenes.length === 0) {
    return "Script must include at least one scene.";
  }

  const sceneDurationTotal = script.scenes.reduce(
    (total, scene) => total + scene.duration_seconds,
    0,
  );
  if (sceneDurationTotal > script.total_duration_seconds + 5) {
    return "Scene durations exceed the script duration.";
  }

  for (const scene of script.scenes) {
    if (!Number.isFinite(scene.duration_seconds) || scene.duration_seconds <= 0) {
      return `Scene ${scene.scene_number} duration must be greater than 0.`;
    }

    if (!scene.visual_direction.trim()) {
      return `Scene ${scene.scene_number} visual direction is required.`;
    }

    if (!scene.on_screen_text.trim()) {
      return `Scene ${scene.scene_number} on-screen text is required.`;
    }

    if (!scene.voiceover.trim()) {
      return `Scene ${scene.scene_number} voiceover is required.`;
    }

    if (!scene.camera_style.trim()) {
      return `Scene ${scene.scene_number} camera style is required.`;
    }
  }

  return null;
}

function validateStoryboard(storyboard: StoryboardPayload | null): string | null {
  if (!storyboard) {
    return null;
  }

  if (!storyboard.visual_style.trim()) {
    return "Storyboard visual style is required.";
  }

  if (storyboard.scenes.length === 0) {
    return "Storyboard must include at least one scene.";
  }

  for (const scene of storyboard.scenes) {
    if (!Number.isFinite(scene.duration_seconds) || scene.duration_seconds <= 0) {
      return `Scene ${scene.scene_number} duration must be greater than 0.`;
    }

    if (!scene.visual_direction.trim()) {
      return `Scene ${scene.scene_number} visual direction is required.`;
    }

    if (!scene.on_screen_text.trim()) {
      return `Scene ${scene.scene_number} on-screen text is required.`;
    }

    if (!scene.voiceover.trim()) {
      return `Scene ${scene.scene_number} voiceover is required.`;
    }

    if (!scene.camera_style.trim()) {
      return `Scene ${scene.scene_number} camera style is required.`;
    }
  }

  return null;
}

function createStoryboardScene(
  sceneNumber: number,
  totalDurationSeconds: number,
): BriefDraftScene {
  return {
    camera_style: "natural vertical video",
    duration_seconds: Math.max(3, Math.round(totalDurationSeconds / 4)),
    notes: "New scene added by reviewer.",
    on_screen_text: "New beat",
    scene_number: sceneNumber,
    transition: "quick cut",
    visual_direction: "Describe the visual action for this scene.",
    voiceover: "Write the voiceover beat for this scene.",
  };
}

function renumberStoryboardScenes(
  scenes: BriefDraftScene[],
): BriefDraftScene[] {
  return renumberDraftScenes(scenes);
}

function renumberDraftScenes(
  scenes: BriefDraftScene[],
): BriefDraftScene[] {
  return scenes.map((scene, index) => ({
    ...scene,
    scene_number: index + 1,
  }));
}

function clampNumber(
  value: number,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function buildFilterCounts(
  items: ReviewAssetListItem[],
): Record<VideoReviewFilter, number> {
  return {
    all: items.length,
    approved: items.filter((item) =>
      matchesVideoReviewFilter(item, "approved"),
    ).length,
    rejected: items.filter((item) =>
      matchesVideoReviewFilter(item, "rejected"),
    ).length,
    waiting: items.filter((item) => matchesVideoReviewFilter(item, "waiting"))
      .length,
  };
}

function matchesVideoReviewFilter(
  item: ReviewAssetListItem,
  filter: VideoReviewFilter,
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "approved") {
    return item.review_decision === "approved" || item.approved;
  }

  if (filter === "rejected") {
    return item.review_decision === "rejected";
  }

  return (
    item.human_review_required && !item.approved && !item.review_decision
  );
}

function matchesVideoSearch(
  item: ReviewAssetListItem,
  normalizedSearch: string,
): boolean {
  if (!normalizedSearch) {
    return true;
  }

  return [
    item.asset_id,
    item.brand,
    item.brief_id,
    item.client_type,
    item.hook_angle,
    item.state,
    item.variant_id,
    item.video_style,
  ]
    .map(normalizeSearchToken)
    .some((value) => value.includes(normalizedSearch));
}

function normalizeSearchToken(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function reviewStatusLabel(item: {
  approved: boolean;
  human_review_required: boolean;
  review_decision: ReviewDecision | null;
}): string {
  if (item.review_decision === "approved") {
    return "Approved";
  }

  if (item.review_decision === "rejected") {
    return "Rejected";
  }

  if (!item.human_review_required) {
    return "No review needed";
  }

  if (item.approved) {
    return "Approved";
  }

  return "Pending";
}

function reviewerAuditLabel(item: {
  approved: boolean;
  review_decision: ReviewDecision | null;
}): string {
  if (item.review_decision === "rejected") {
    return "Rejected by";
  }

  if (item.review_decision === "approved" || item.approved) {
    return "Approved by";
  }

  return "Reviewed by";
}

function canReviewAsset(item: {
  approved: boolean;
  human_review_required: boolean;
  review_decision: ReviewDecision | null;
}): boolean {
  return (
    item.human_review_required &&
    !item.approved &&
    item.review_decision === null
  );
}

function reviewStatusTone(item: ReviewAssetListItem): StatusTone {
  if (item.review_decision === "rejected") {
    return "rose";
  }

  if (item.review_decision === "approved" || item.approved) {
    return "teal";
  }

  return item.human_review_required ? "amber" : "slate";
}

function briefValue(
  detail: ReviewAssetDetailResponse,
  key:
    | "brand"
    | "client_type"
    | "cta"
    | "hook_angle"
    | "state"
    | "video_style",
): string {
  const { brief } = detail;

  if (key === "brand") {
    return String(asRecord(brief.brand)?.name ?? "-");
  }

  if (key === "state" || key === "client_type") {
    return String(asRecord(brief.market)?.[key] ?? "-");
  }

  return String(asRecord(brief.creative)?.[key] ?? "-");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function errorMessage(caughtError: unknown, fallback: string): string {
  return caughtError instanceof Error ? caughtError.message : fallback;
}
