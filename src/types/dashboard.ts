export interface DashboardPageProps {
  apiUrl?: string;
}

export interface DashboardPageState {
  data: CampaignDashboardApiResponse | null;
  isLoading: boolean;
  error: string | null;
}

export interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  lastUpdated?: string;
}

export interface KpiCardsGridProps {
  items: KpiCardData[];
}

export interface KpiCardProps {
  item: KpiCardData;
}

export interface CampaignPerformanceChartProps {
  data: MonthlyCampaignPerformance[];
  isLoading?: boolean;
}

export interface CampaignStateTableProps {
  rows: CampaignStateRow[];
}

export interface RecommendationPanelProps {
  recommendation: AiAgentRecommendation;
  stateName: string;
}

export interface CampaignDashboardApiResponse {
  generatedAt: string;
  aggregatedKpis: AggregatedKpis;
  monthlyPerformance: MonthlyCampaignPerformance[];
  stateCampaigns: CampaignStateRow[];
}

export interface AggregatedKpis {
  finalCpl: number | null;
  cpsl: number | null;
  cpql: number | null;
  budgetSpentCompletionPct: number | null;
  slGoalCompletionPct: number | null;
  leadGoalCompletionPct: number | null;
  mtdSpentPct: number | null;
}

export interface MonthlyCampaignPerformance {
  month: string;
  sl: number;
  slGoal: number;
  slPctToTarget: number | null;
}

export interface CampaignStateRow {
  id: string;
  state: CampaignStateName;
  budget: number | null;
  slGoal: number | null;
  leadsGoal: number | null;
  mtdSpent: number | null;
  spentPct: number | null;
  goalPct: number | null;
  cpsl: number | null;
  mtdSl: number | null;
  leads: number | null;
  conversionRate: number | null;
  cpl: number | null;
  recommendation: AiAgentRecommendation;
}

export type CampaignStateName =
  | "Texas"
  | "Georgia"
  | "Florida"
  | "California"
  | "Mixed"
  | "Sunshine"
  | "Testing";

export interface AiAgentRecommendation {
  id: string;
  summary: string;
  priority: RecommendationPriority;
  status?: RecommendationStatus;
  rationale?: string;
  actions: RecommendationAction[];
  confidenceScore?: number | null;
  generatedAt?: string;
}

export type RecommendationPriority = "low" | "medium" | "high" | "critical";

export type RecommendationStatus =
  | "new"
  | "reviewed"
  | "accepted"
  | "dismissed";

export interface RecommendationAction {
  id: string;
  label: string;
  description?: string;
  impact?: string;
}

export interface KpiCardData {
  id: string;
  label: string;
  value: number | null;
  format: MetricFormat;
  status: MetricStatus;
  helperText?: string;
}

export type MetricFormat = "currency" | "number" | "percentage";

export type MetricStatus = "on-track" | "alert" | "critical";

export type RowHealth = "met" | "near" | "critical";

export interface CostKpiTarget {
  metric: "finalCpl" | "cpsl" | "cpql";
  onTrackMax: number;
  alertMax: number;
}

export interface RecommendationPanelViewModel {
  stateName: string;
  priorityLabel: string;
  summary: string;
  rationale?: string;
  actions: string[];
  confidenceLabel?: string;
  generatedAtLabel?: string;
}

export type NullableNumber = number | null | undefined;
