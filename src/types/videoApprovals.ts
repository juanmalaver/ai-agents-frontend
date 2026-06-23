export type ReviewDecision = "approved" | "rejected";

export type ReviewAssetStatus =
  | "duplicate"
  | "pending"
  | "pending_review"
  | "ready"
  | "rejected";

export type ReviewQcStatus =
  | "duplicate_detected"
  | "failed"
  | "failed_regenerate"
  | "failed_terminal"
  | "needs_review"
  | "passed";

export interface ReviewAssetListItem {
  asset_id: string;
  brief_id: string;
  variant_id: string;
  brand: string;
  state: string;
  client_type: string;
  video_style: string;
  hook_angle: string;
  cta: string;
  status: ReviewAssetStatus;
  qc_status: ReviewQcStatus | null;
  qc_score: number | null;
  human_review_required: boolean;
  approved: boolean;
  review_decision: ReviewDecision | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string | null;
}

export interface ReviewAssetsResponse {
  items: ReviewAssetListItem[];
}

export interface ReviewAssetDetailResponse {
  asset: {
    asset_id: string;
    brief_id: string;
    variant_id: string;
    status: ReviewAssetStatus;
    qc_status: ReviewQcStatus | null;
    qc_score: number | null;
    storage_url: string | null;
    signed_video_url: string | null;
    thumbnail_url: string | null;
    human_review_required: boolean;
    approved: boolean;
    review_decision: ReviewDecision | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    variant_strategy: Record<string, unknown>;
    cost_amount: number | null;
    cost_currency: string | null;
    cost_unit: string | null;
    created_at: string | null;
  };
  brief: VideoReviewBrief;
  artifacts: {
    script_url: string | null;
    storyboard_url: string | null;
    prompt_url: string | null;
    qc_report_url: string | null;
  };
}

export interface AssetReviewDecisionResponse {
  asset_id: string;
  brief_id: string;
  variant_id: string;
  decision: ReviewDecision;
  status: ReviewAssetStatus;
  reviewer: string;
  reviewed_at: string | null;
}

export type VideoReviewBrief = {
  brand?: {
    name?: string;
  };
  market?: {
    state?: string;
    client_type?: string;
  };
  creative?: {
    video_style?: string;
    hook_angle?: string;
    cta?: string;
  };
} & Record<string, unknown>;
