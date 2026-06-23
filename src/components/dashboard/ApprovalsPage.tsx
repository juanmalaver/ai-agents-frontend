"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  AssetReviewDecisionResponse,
  BriefDraftContinueResponse,
  BriefDraftResponse,
  BriefDraftScene,
  ReviewAssetDetailResponse,
  ReviewAssetListItem,
  ReviewAssetsResponse,
  ReviewDecision,
} from "@/src/types/videoApprovals";
import { useAuthUser } from "@/src/components/auth/AuthGate";
import { formatDashboardTimestamp } from "@/src/utils/dashboardFormatters";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardShell } from "./DashboardShell";

type ApprovalTab = "briefs" | "videos";
type LoadState = "loading" | "ready" | "error";
type StatusTone = "amber" | "rose" | "slate" | "teal";
type VideoReviewFilter = "all" | "approved" | "rejected" | "waiting";

const videoReviewFilters: Array<{
  id: VideoReviewFilter;
  label: string;
}> = [
  { id: "waiting", label: "Waiting Approval" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

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
  const [directorPrompt, setDirectorPrompt] = useState("");
  const [draft, setDraft] = useState<BriefDraftResponse | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [continueStatus, setContinueStatus] = useState<string | null>(null);
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const trimmedPrompt = directorPrompt.trim();
  const canGenerate =
    Boolean(reviewerEmail) &&
    trimmedPrompt.length >= 10 &&
    !isGeneratingStoryboard;
  const canContinue =
    draft !== null &&
    draft.status === "storyboard_ready" &&
    !draft.run_id &&
    Boolean(reviewerEmail) &&
    !isContinuing;

  const generateStoryboard = useCallback(async () => {
    if (!reviewerEmail) {
      setBriefError("Authenticated creator email is required.");
      return;
    }

    if (trimmedPrompt.length < 10) {
      setBriefError("Prompt director must be at least 10 characters.");
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
            source_prompt: trimmedPrompt,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      setDraft(response);
    } catch (caughtError) {
      setDraft(null);
      setBriefError(errorMessage(caughtError, "Unable to generate storyboard."));
    } finally {
      setIsGeneratingStoryboard(false);
    }
  }, [reviewerEmail, trimmedPrompt]);

  const continueToVideo = useCallback(async () => {
    if (!draft) {
      return;
    }

    if (!reviewerEmail) {
      setContinueStatus("Authenticated reviewer email is required.");
      return;
    }

    setIsContinuing(true);
    setBriefError(null);
    setContinueStatus(null);

    try {
      const response = await fetchJson<BriefDraftContinueResponse>(
        `/api/video-production/brief-drafts/${encodeURIComponent(
          draft.draft_id,
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
  }, [draft, reviewerEmail]);

  useEffect(() => {
    if (draft) {
      previewRef.current?.focus();
    }
  }, [draft?.draft_id]);

  return (
    <>
      <section className="grid gap-3 md:grid-cols-3">
        <MetricTile
          label="Draft status"
          value={draft ? briefDraftStatusLabel(draft.status) : "-"}
        />
        <MetricTile
          label="Storyboard scenes"
          value={draft ? String(draft.storyboard.scenes.length) : "0"}
        />
        <MetricTile
          label="Video run"
          value={draft?.run_id ? "Started" : "Not started"}
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Single Brief
            </h2>
            <p className="text-sm text-slate-500">
              {draft ? draft.brief_id : "No storyboard generated"}
            </p>
          </div>
          <button
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
            disabled={!directorPrompt && !draft}
            onClick={() => {
              setDirectorPrompt("");
              setDraft(null);
              setBriefError(null);
              setContinueStatus(null);
            }}
            type="button"
          >
            Reset
          </button>
        </div>

        <form
          className="grid gap-4 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void generateStoryboard();
          }}
        >
          <div className="grid gap-2">
            <label
              className="text-sm font-semibold text-slate-950"
              htmlFor="brief-director-prompt"
            >
              Prompt director
            </label>
            <textarea
              aria-describedby="brief-director-status"
              aria-keyshortcuts="Control+Enter Meta+Enter"
              className="min-h-36 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              id="brief-director-prompt"
              onChange={(event) => setDirectorPrompt(event.target.value)}
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
              placeholder="Brand, market, target client, hook, CTA, compliance notes..."
              value={directorPrompt}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p
              aria-live="polite"
              className="text-sm text-slate-500"
              id="brief-director-status"
            >
              {reviewerEmail ? `Creating as ${reviewerEmail}` : "Email required"}
            </p>
            <button
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canGenerate}
              type="submit"
            >
              {isGeneratingStoryboard ? "Generating" : "Generate storyboard"}
            </button>
          </div>
        </form>

        {briefError ? <InlineError message={briefError} /> : null}

        {!draft && !briefError ? (
          <div className="border-t border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
            No storyboard generated.
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
                  Storyboard Preview
                </h2>
                <StatusPill
                  label={briefDraftStatusLabel(draft.status)}
                  tone={briefDraftStatusTone(draft.status)}
                />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {draft.storyboard.visual_style}
              </p>
            </div>
            <button
              className="inline-flex h-10 items-center justify-center rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canContinue}
              onClick={() => void continueToVideo()}
              type="button"
            >
              {isContinuing ? "Starting" : "Continue to video"}
            </button>
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
                  ["Run ID", draft.run_id ?? "-"],
                ]}
              />

              {continueStatus ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {continueStatus}
                </p>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
                  <tr>
                    <TableHead>Scene</TableHead>
                    <TableHead>Visual</TableHead>
                    <TableHead>Copy</TableHead>
                    <TableHead>Camera</TableHead>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {draft.storyboard.scenes.map((scene) => (
                    <BriefStoryboardRow key={scene.scene_number} scene={scene} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}

function BriefStoryboardRow({ scene }: { scene: BriefDraftScene }) {
  return (
    <tr className="hover:bg-slate-50">
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-slate-950">
            {scene.scene_number}
          </span>
          <span className="text-xs text-slate-500">
            {scene.duration_seconds}s
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex max-w-[260px] flex-col gap-1">
          <span>{scene.visual_direction}</span>
          {scene.transition ? (
            <span className="text-xs text-slate-500">{scene.transition}</span>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex max-w-[280px] flex-col gap-1">
          <span className="font-medium text-slate-950">
            {scene.on_screen_text}
          </span>
          <span className="text-xs text-slate-500">{scene.voiceover}</span>
        </div>
      </TableCell>
      <TableCell>{scene.camera_style}</TableCell>
    </tr>
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
                  {detail.asset.signed_video_url || detail.asset.storage_url ? (
                    <video
                      className="aspect-video w-full bg-slate-950"
                      controls
                      src={
                        detail.asset.signed_video_url ??
                        detail.asset.storage_url ??
                        undefined
                      }
                    />
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

  return "Storyboard ready";
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
