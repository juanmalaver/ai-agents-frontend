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

export type BriefDraftStatus =
  | "generation_failed"
  | "generation_submitted"
  | "storyboard_ready";

export interface BriefDraftScene {
  scene_number: number;
  duration_seconds: number;
  visual_direction: string;
  on_screen_text: string;
  voiceover: string;
  camera_style: string;
  transition?: string | null;
  notes?: string | null;
}

export interface BriefDraftResponse {
  draft_id: string;
  status: BriefDraftStatus;
  source_prompt: string;
  created_by: string | null;
  continued_by: string | null;
  run_id: string | null;
  brief_id: string;
  matrix_cell_id: string;
  brief: VideoReviewBrief & {
    priority?: {
      score?: number;
      tier?: string;
      reason?: string;
    };
    constraints?: {
      max_variants?: number;
      requires_human_approval?: boolean;
      compliance_level?: string;
    };
  };
  normalized_brief: Record<string, unknown>;
  script: {
    hook: string;
    body: string;
    cta: string;
    total_duration_seconds: number;
    scenes: BriefDraftScene[];
  };
  storyboard: {
    brief_id: string;
    scenes: BriefDraftScene[];
    visual_style: string;
    total_duration_seconds: number;
    recommended_scene_count?: number | null;
    scene_count_reason?: string | null;
  };
  prompt_count: number;
  metadata: Record<string, unknown>;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BriefDraftContinueResponse {
  run_id: string;
  status: string;
  brief_id: string | null;
  submitted_jobs: Array<Record<string, unknown>>;
}

export interface VideoProductionBrandOption {
  brand_code: string;
  brand_name: string;
  brand_aliases: string[];
  slack_channel: string | null;
  meta_ad_account_id: string | null;
  is_active: boolean;
}

export interface VideoProductionBrandsResponse {
  items: VideoProductionBrandOption[];
}

export interface VideoProductionCharacterOption {
  character_id: string;
  display_name: string;
  description: string | null;
  image_url: string;
  thumbnail_url: string | null;
  brand_code: string | null;
  language: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

export interface VideoProductionCatalogOption {
  code: string;
  label: string;
}

export interface VideoProductionClientTypeOption
  extends VideoProductionCatalogOption {
  awareness_level: string | null;
}

export interface VideoProductionBriefCatalogResponse {
  aspect_ratios: VideoProductionCatalogOption[];
  awareness_levels: VideoProductionCatalogOption[];
  brands: VideoProductionBrandOption[];
  characters: VideoProductionCharacterOption[];
  client_types: VideoProductionClientTypeOption[];
  ctas: VideoProductionCatalogOption[];
  durations_seconds: number[];
  hook_angles: VideoProductionCatalogOption[];
  languages: VideoProductionCatalogOption[];
  market_states: string[];
  max_variants: number[];
  platforms: VideoProductionCatalogOption[];
  video_styles: VideoProductionCatalogOption[];
}

export interface HiggsfieldOAuthStartResponse {
  provider: string;
  owner_type: string;
  owner_email: string;
  authorization_url: string;
  redirect_uri: string;
  expires_at: string;
}

export interface HiggsfieldOAuthStatusResponse {
  provider: string;
  owner_type: string;
  owner_email: string;
  connected: boolean;
  status: string | null;
  connected_email: string | null;
  connected_subject: string | null;
  org_id: string | null;
  expires_at: string | null;
  connected_at: string | null;
  last_refresh_at: string | null;
  has_refresh_token: boolean;
  metadata: Record<string, unknown>;
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
