export interface CampaignsDashboardMock {
  alert: CampaignAlert;
  campaignRows: CampaignResultRow[];
  generatedAt: string;
  leadTrendRows: CampaignLeadTrendRow[];
  scorecards: CampaignScorecard[];
  stateCompletionRows: CampaignStateCompletionRow[];
  topPerformer: CampaignInsight;
  lowestPerformer: CampaignInsight;
}

export interface CampaignAlert {
  campaignNames: string[];
  cplLimit: number;
  message: string;
}

export interface CampaignScorecard {
  id: string;
  label: string;
  primaryLabel: string;
  primaryValue: number;
  secondaryItems: Array<{
    label: string;
    value: number | string;
  }>;
  status: "healthy" | "watch" | "critical";
}

export interface CampaignStateCompletionRow {
  state: string;
  sl: number;
  slGoal: number;
}

export interface CampaignLeadTrendRow {
  campaign: string;
  conversionRate: number;
  dropRate: number;
  drops: number;
  leads: number;
  noAccidentRate: number;
  sl: number;
}

export interface CampaignResultRow extends CampaignLeadTrendRow {
  activeMarketingStates: string;
  cpl: number;
  mql: number;
  slGoal: number;
  status: "Active" | "Inactive";
}

export interface CampaignInsight {
  campaign: string;
  description: string;
  metricLabel: string;
  metricValue: string;
}
