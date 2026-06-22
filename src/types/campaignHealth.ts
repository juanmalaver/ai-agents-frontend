import type { MarketingDashboardBrand } from "./dashboard";

export type CampaignHealthStatus = "green" | "yellow" | "red" | "neutral";

export type CampaignHealthGrade = "A" | "B" | "C" | "D" | "F";

export type CampaignMetaDeliveryStatus = "on" | "off" | "unknown";

export type CampaignHealthConfidence =
  | "High"
  | "Medium"
  | "Limited"
  | "Learning";

export type CampaignHealthRecommendation =
  | "Fix tracking"
  | "Working"
  | "Monitor"
  | "Investigate"
  | "Pause candidate"
  | "Learning";

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
  adId: string | null;
  adName: string;
  confidence: CampaignHealthConfidence;
  cpl: number | null;
  cpsl: number | null;
  grade: CampaignHealthGrade;
  id: string;
  leads: number;
  metaStatus: CampaignMetaStatus;
  metaLeadActions: number | null;
  metricHealth: {
    attribution: CampaignHealthMetric;
    cpsl: CampaignHealthMetric;
    intake: CampaignHealthMetric;
    volume: CampaignHealthMetric;
  };
  recommendation: CampaignHealthRecommendation;
  signedLeads: number;
  spend: number;
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
  ads: CampaignHealthAdRow[];
  brand: string;
  campaignAgeDays: number | null;
  campaignId: string | null;
  campaignName: string;
  confidence: CampaignHealthConfidence;
  cpl: number | null;
  cpsl: number | null;
  displayName: string;
  grade: CampaignHealthGrade;
  id: string;
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
  qualitySignals: {
    callNotAnswered: CampaignHealthQualitySignal;
    noAccident: CampaignHealthQualitySignal;
    oldAccident: CampaignHealthQualitySignal;
    previousAttorney: CampaignHealthQualitySignal;
    speedToLead: CampaignHealthQualitySignal;
  };
  recommendation: CampaignHealthRecommendation;
  signedLeads: number;
  spend: number;
  startedAt: string | null;
}

export interface CampaignHealthFilterOption {
  brand?: string;
  id: string;
  label: string;
}

export interface CampaignHealthFilterOptions {
  ads: CampaignHealthFilterOption[];
  brands: MarketingDashboardBrand[];
  campaigns: CampaignHealthFilterOption[];
  grades: CampaignHealthGrade[];
  metaStatuses: CampaignHealthFilterOption[];
}

export interface CampaignHealthThresholds {
  rampUp: {
    minimumCampaignAgeDays: number;
  };
  cpsl: {
    greenMaxExclusive: number;
    redMin: number;
    zeroSignedLeadRedSpendMin: number;
    zeroSignedLeadYellowSpendMin: number;
  };
  intake: {
    greenMin: number;
    minimumMetaLeadActions: number;
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
  scope: "all_brands" | "selected_brands";
  selectedBrands: string[];
  thresholds: CampaignHealthThresholds;
}
