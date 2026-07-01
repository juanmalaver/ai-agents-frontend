import type { MarketingDashboardBrand } from "./dashboard";

export type CampaignHealthStatus = "green" | "yellow" | "red" | "neutral";

export type CampaignHealthGrade = "A" | "B" | "C" | "D" | "F";

export type CampaignMetaDeliveryStatus = "on" | "off" | "unknown";

export type CampaignPlatform = "meta" | "tiktok";

export type HealthDashboardPlatform = CampaignPlatform | "all";

export type CampaignHealthConfidence =
  | "High"
  | "Medium"
  | "Limited"
  | "Learning";

export type CampaignHealthRecommendation =
  | "Learning"
  | "Scale"
  | "Review"
  | "Shut off";

export interface CampaignHealthMetric {
  label: string;
  reason: string;
  status: CampaignHealthStatus;
  value: number | null;
}

export interface CampaignHealthQualitySignal extends CampaignHealthMetric {
  count: number | null;
  denominator: number | null;
}

export interface CampaignHealthAdRow {
  activeDays: number | null;
  adId: string | null;
  adName: string;
  adsetId: string | null;
  adsetName: string | null;
  adsetStatus: CampaignMetaStatus;
  averageLeadActualAge?: number | null;
  averageLeadAgeDays?: number | null;
  confidence: CampaignHealthConfidence;
  cpl: number | null;
  cpsl: number | null;
  droppedLeads?: number;
  genderCounts?: Record<string, number> | null;
  grade: CampaignHealthGrade;
  id: string;
  inStateCpsl: number | null;
  inStateSignedLeads: number;
  leads: number;
  metaStatus: CampaignMetaStatus;
  metaLeadActions: number | null;
  metricHealth: {
    attribution: CampaignHealthMetric;
    cpsl: CampaignHealthMetric;
    intake: CampaignHealthMetric;
    volume: CampaignHealthMetric;
  };
  oosCpsl: number | null;
  oosSignedLeads: number;
  recommendation: CampaignHealthRecommendation;
  signedLeads: number;
  spend: number;
  states: string[];
  unknownStateSignedLeads: number;
}

export interface CampaignHealthAdMedia {
  adId: string;
  adName: string | null;
  creativeId: string | null;
  creativeName: string | null;
  embedUrl: string | null;
  mediaType: "image" | "unknown" | "video";
  objectStoryId: string | null;
  permalinkUrl: string | null;
  thumbnailUrl: string | null;
  videoId: string | null;
  videoUnavailableReason: string | null;
  videoUrl: string | null;
}

export interface CampaignMetaStatus {
  configuredStatus: string | null;
  effectiveStatus: string | null;
  id: CampaignMetaDeliveryStatus;
  label: "On" | "Off" | "Unknown";
}

export interface CampaignHealthRow {
  accountId: string;
  accountName: string;
  activeDays: number | null;
  activeEndDate: string | null;
  activeStartDate: string | null;
  ads: CampaignHealthAdRow[];
  averageLeadActualAge?: number | null;
  averageLeadAgeDays?: number | null;
  brand: string;
  campaignAgeDays: number | null;
  campaignId: string | null;
  campaignName: string;
  confidence: CampaignHealthConfidence;
  cpl: number | null;
  cpsl: number | null;
  displayName: string;
  droppedLeads?: number;
  genderCounts?: Record<string, number> | null;
  grade: CampaignHealthGrade;
  id: string;
  inStateCpsl: number | null;
  inStateSignedLeads: number;
  intakeRegistrationRate: number | null;
  isRampUp: boolean;
  leads: number;
  metaStatus: CampaignMetaStatus;
  metaLeadActions: number | null;
  metricHealth: {
    cpsl: CampaignHealthMetric;
    intake: CampaignHealthMetric;
    quality: CampaignHealthMetric;
    volume: CampaignHealthMetric;
  };
  noAccidentRate: number | null;
  platform: CampaignPlatform;
  qualitySignals: {
    callNotAnswered: CampaignHealthQualitySignal;
    commercial: CampaignHealthQualitySignal;
    noAccident: CampaignHealthQualitySignal;
    oldAccident: CampaignHealthQualitySignal;
    previousAttorney: CampaignHealthQualitySignal;
    speedToLead: CampaignHealthQualitySignal;
  };
  oosCpsl: number | null;
  oosSignedLeads: number;
  recommendation: CampaignHealthRecommendation;
  signedLeads: number;
  spend: number;
  startedAt: string | null;
  states: string[];
  unknownStateSignedLeads: number;
}

export interface CampaignHealthFilterOption {
  brand?: string;
  id: string;
  label: string;
  platform?: CampaignPlatform;
}

export interface CampaignHealthFilterOptions {
  ads: CampaignHealthFilterOption[];
  brands: MarketingDashboardBrand[];
  campaigns: CampaignHealthFilterOption[];
  grades: CampaignHealthGrade[];
  metaStatuses: CampaignHealthFilterOption[];
  platforms: CampaignHealthFilterOption[];
  states: CampaignHealthFilterOption[];
}

export interface CampaignHealthThresholds {
  rampUp: {
    minimumCampaignAgeDays: number;
  };
  cpsl: {
    adShutdownSpendMin: number;
    greenMaxExclusive: number;
    redMin: number;
    shutdownReviewMinimumCampaignAgeDays: number;
    zeroSignedLeadRedSpendMin: number;
    zeroSignedLeadYellowSpendMin: number;
  };
  intake: {
    greenMin: number;
    minimumLeads: number;
    yellowMin: number;
  };
  quality: {
    callNotAnsweredGreenMax: number;
    greenMax: number;
    minimumLeads: number;
    oldAccidentAgeMonths: number;
    speedToLeadGreenMaxMinutes: number;
    speedToLeadRedMinMinutes: number;
    yellowMax: number;
  };
  volume: {
    greenMax: number;
    redMinExclusive: number;
    zeroLeadRedSpendMin: number;
    zeroLeadYellowSpendMin: number;
  };
}

export interface MarketingDashboardHealthResponse {
  campaignRows: CampaignHealthRow[];
  filterOptions: CampaignHealthFilterOptions;
  generatedAt: string;
  platform: HealthDashboardPlatform;
  scope: "all_brands" | "selected_brands";
  selectedBrands: string[];
  thresholds: CampaignHealthThresholds;
}
