export interface CampaignsDashboardApiResponse {
  alert: CampaignAlert;
  campaignRows: CampaignResultRow[];
  generatedAt: string;
  leadTrendRows: CampaignLeadTrendRow[];
  lowerSnapshotRows: CampaignStateSnapshotRow[];
  scorecards: CampaignScorecard[];
  spendRows: CampaignSpendRow[];
  statusDistributionRows: CampaignStatusDistributionRow[];
  stateCompletionRows: CampaignStateCompletionRow[];
  topPerformer: CampaignInsight;
  lowestPerformer: CampaignInsight;
}

export type CampaignsDashboardMock = CampaignsDashboardApiResponse;

export interface CampaignAlert {
  campaignNames: string[];
  cplLimit: number;
  message: string;
}

export interface CampaignScorecard {
  id: string;
  label: string;
  primaryLabel: string;
  primaryValue: number | null;
  secondaryItems: Array<{
    label: string;
    value: number | string;
  }>;
  status: "healthy" | "watch" | "critical";
}

export interface CampaignStateCompletionRow {
  state: string;
  sl: number;
  slGoal: number | null;
}

export interface CampaignLeadTrendRow {
  campaign: string;
  conversionRate: number | null;
  dropRate: number | null;
  drops: number;
  leads: number;
  noAccidentRate: number | null;
  sl: number;
}

export interface CampaignResultRow extends CampaignLeadTrendRow {
  activeMarketingStates: string;
  cpl: number | null;
  cpql: number | null;
  mql: number;
  qLeadsGoal: number | null;
  slGoal: number | null;
  spend: number;
  status: "Active" | "Inactive";
}

export interface CampaignStateSnapshotRow {
  budget: number | null;
  conversionRate: number | null;
  cpl: number | null;
  cpql: number | null;
  cpsl: number | null;
  date: string;
  leads: number;
  mtdSl: number;
  mtdSpent: number;
  qLeadsGoal: number | null;
  slGoal: number | null;
  state: string;
}

export interface CampaignSpendRow {
  campaign: string;
  spend: number;
}

export interface CampaignStatusDistributionRow {
  appointment: number;
  drop: number;
  hotLeads: number;
  marketingState: string;
  nullStatus: number;
  retainerSent: number;
  signedUp: number;
}

export interface CampaignInsight {
  campaign: string;
  description: string;
  metricLabel: string;
  metricValue: string;
}
