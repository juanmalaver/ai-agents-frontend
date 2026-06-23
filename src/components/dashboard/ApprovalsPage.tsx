"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type {
  AssetReviewDecisionResponse,
  ReviewAssetDetailResponse,
  ReviewAssetListItem,
  ReviewAssetsResponse,
  ReviewDecision,
} from "@/src/types/videoApprovals";
import { formatDashboardTimestamp } from "@/src/utils/dashboardFormatters";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardShell } from "./DashboardShell";

const REVIEWER_STORAGE_KEY = "video-approvals-reviewer";

type ApprovalTab = "briefs" | "videos";
type LoadState = "loading" | "ready" | "error";

export function ApprovalsPage({ activeTab }: { activeTab: ApprovalTab }) {
  const searchParams = useSearchParams();
  const deepLinkedAssetId = searchParams.get("asset_id");
  const [items, setItems] = useState<ReviewAssetListItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [listError, setListError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReviewAssetDetailResponse | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [decisionStatus, setDecisionStatus] = useState<string | null>(null);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [reviewer, setReviewer] = useState("");

  const pendingCount = useMemo(
    () => items.filter((item) => !item.review_decision).length,
    [items],
  );
  const reviewedCount = items.length - pendingCount;
  const lastUpdated = useMemo(() => latestTimestamp(items), [items]);

  const loadPending = useCallback(async () => {
    setLoadState("loading");
    setListError(null);

    try {
      const response = await fetchJson<ReviewAssetsResponse>(
        "/api/video-production/reviews/pending",
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

  const closeDetail = useCallback(() => {
    setDetail(null);
    setSelectedAssetId(null);
    setDetailError(null);
    setDecisionStatus(null);
  }, []);

  const submitDecision = useCallback(
    async (decision: ReviewDecision) => {
      if (!detail || !selectedAssetId) {
        return;
      }

      const normalizedReviewer = reviewer.trim();
      if (!normalizedReviewer) {
        setDecisionStatus("Reviewer is required.");
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
              reviewer: normalizedReviewer,
            }),
            headers: {
              "Content-Type": "application/json",
            },
            method: "POST",
          },
        );

        window.localStorage.setItem(REVIEWER_STORAGE_KEY, normalizedReviewer);
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
    [detail, reviewer, selectedAssetId],
  );

  useEffect(() => {
    if (activeTab !== "videos") {
      return;
    }

    void loadPending();
  }, [activeTab, loadPending]);

  useEffect(() => {
    const storedReviewer = window.localStorage.getItem(REVIEWER_STORAGE_KEY);

    if (storedReviewer) {
      setReviewer(storedReviewer);
    }
  }, []);

  useEffect(() => {
    if (!deepLinkedAssetId) {
      return;
    }

    void openAsset(deepLinkedAssetId);
  }, [deepLinkedAssetId, openAsset]);

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
          <BriefApprovalsPanel />
        ) : (
          <VideoApprovalsPanel
            items={items}
            listError={listError}
            loadPending={loadPending}
            loadState={loadState}
            openAsset={openAsset}
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
          reviewer={reviewer}
          selectedAssetId={selectedAssetId}
          setReviewer={setReviewer}
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

function BriefApprovalsPanel() {
  return (
    <>
      <section className="grid gap-3 md:grid-cols-3">
        <MetricTile label="Pending" value="0" />
        <MetricTile label="Reviewed in view" value="0" />
        <MetricTile label="Total loaded" value="0" />
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Brief Queue
            </h2>
            <p className="text-sm text-slate-500">0 briefs</p>
          </div>
          <button
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
            type="button"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
              <tr>
                <TableHead>Brand</TableHead>
                <TableHead>Brief</TableHead>
                <TableHead>Market</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Review</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </tr>
            </thead>
          </table>
        </div>
        <div className="px-4 py-12 text-center text-sm text-slate-500">
          No pending briefs.
        </div>
      </section>
    </>
  );
}

function VideoApprovalsPanel({
  items,
  listError,
  loadPending,
  loadState,
  openAsset,
  pendingCount,
  reviewedCount,
  selectedAssetId,
}: {
  items: ReviewAssetListItem[];
  listError: string | null;
  loadPending: () => Promise<void>;
  loadState: LoadState;
  openAsset: (assetId: string) => Promise<void>;
  pendingCount: number;
  reviewedCount: number;
  selectedAssetId: string | null;
}) {
  return (
    <>
      <section className="grid gap-3 md:grid-cols-3">
        <MetricTile label="Pending" value={String(pendingCount)} />
        <MetricTile label="Reviewed in view" value={String(reviewedCount)} />
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
                ? `${items.length} video${items.length === 1 ? "" : "s"}`
                : "Loading"}
            </p>
          </div>
          <button
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
            onClick={() => void loadPending()}
            type="button"
          >
            Refresh
          </button>
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
            No pending videos.
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
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
                {items.map((item) => (
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
                          tone={item.review_decision ? "slate" : "amber"}
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
                        className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
                        onClick={() => void openAsset(item.asset_id)}
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
  reviewer,
  selectedAssetId,
  setReviewer,
}: {
  decisionStatus: string | null;
  detail: ReviewAssetDetailResponse | null;
  detailError: string | null;
  isDetailLoading: boolean;
  isSubmittingDecision: boolean;
  onClose: () => void;
  onDecision: (decision: ReviewDecision) => void;
  reviewer: string;
  selectedAssetId: string;
  setReviewer: (value: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-40">
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
            <h2 className="truncate text-lg font-semibold text-slate-950">
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
                    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                      Reviewer
                      <input
                        className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                        onChange={(event) => setReviewer(event.target.value)}
                        placeholder="reviewer@example.com"
                        value={reviewer}
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className="inline-flex h-10 items-center justify-center rounded-lg bg-teal-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isSubmittingDecision}
                        onClick={() => onDecision("approved")}
                        type="button"
                      >
                        Approve
                      </button>
                      <button
                        className="inline-flex h-10 items-center justify-center rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isSubmittingDecision}
                        onClick={() => onDecision("rejected")}
                        type="button"
                      >
                        Reject
                      </button>
                    </div>
                    {decisionStatus ? (
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {decisionStatus}
                      </p>
                    ) : null}
                    <DescriptionGrid
                      rows={[
                        ["Decision", detail.asset.review_decision ?? "Pending"],
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
  tone: "amber" | "slate" | "teal";
}) {
  const classes = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
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

function reviewStatusLabel(item: ReviewAssetListItem): string {
  if (item.review_decision === "approved") {
    return "Approved";
  }

  if (item.review_decision === "rejected") {
    return "Rejected";
  }

  return "Pending";
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
