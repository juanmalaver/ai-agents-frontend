export interface DashboardPageProps {
  apiUrl?: string;
  activeTab?: DashboardTabId;
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

export type DashboardSectionCacheStatus = "fresh" | "stale";

export interface DashboardSectionCacheMetadata {
  status: DashboardSectionCacheStatus;
  refreshedAt: string | null;
  expiresAt: string | null;
}

export interface DashboardSectionResponse<T> {
  cache: DashboardSectionCacheMetadata;
  data: T;
  generatedAt: string;
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
  slGoal: number | null;
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
  recommendation?: AiAgentRecommendation | null;
}

export type CampaignStateName = string;

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

export type MetricStatus = "on-track" | "alert" | "critical" | "unavailable";

export type DashboardTabId = "overview" | "campaigns";

export type RowHealth = "met" | "near" | "critical" | "neutral";

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


export interface A1AgentLatestResponse {
  agent_id: string;
  run_id: string | null;
  run_date: string | null;
  generated_at: string | null;
  status: "empty" | "success";
  payload: A1DashboardAgentPayload | null;
}

export interface A1DashboardAgentPayload {
  schema_version: string;
  agent_id: string;
  workflow_id?: string;
  run_date?: string;
  generated_at?: string;
  trigger_source?: string;
  crm_output?: Record<string, unknown>;
  agent_output?: A1AgentOutput | null;
  agent_output_parse_status?: string;
  raw_agent_output?: Record<string, unknown>;
  summary?: A1DashboardAgentSummary;
}

export interface A1DashboardAgentSummary {
  anomaly_count?: number | null;
  campaign_count?: number | null;
  fleet_cpl?: number | null;
  overall_health?: string | null;
  recommendation_count?: number | null;
  total_leads?: number | null;
  total_signed?: number | null;
}

export interface A1AgentOutput {
  report_date?: string;
  generated_at?: string;
  fleet_summary?: A1AgentFleetSummary;
  data_quality_notes?: string[];
  summary?: string;
  top_campaigns?: A1AgentCampaignHighlight[];
  underperformers?: A1AgentUnderperformer[];
  anomalies?: A1AgentAnomaly[];
  recommendations?: A1AgentRecommendationOutput[];
  slack_message?: string;
}

export interface A1AgentFleetSummary {
  total_spend?: number | null;
  total_leads?: number | null;
  total_signed?: number | null;
  total_qualified?: number | null;
  fleet_cpl?: number | null;
  fleet_cpsl?: number | null;
  fleet_signed_rate?: number | null;
  fleet_qualify_rate?: number | null;
  mom_summary?: string;
  overall_health?: string;
  health_reason?: string;
}

export interface A1AgentCampaignHighlight {
  campaign_name?: string;
  brand?: string | null;
  channel?: string | null;
  cpl?: number | null;
  signed_rate?: number | null;
  why_top?: string;
}

export interface A1AgentUnderperformer {
  campaign_name?: string;
  brand?: string | null;
  channel?: string | null;
  issue?: string;
  detail?: string;
  mom_signed_rate_change?: number | null;
  mom_leads_change?: number | null;
}

export interface A1AgentAnomaly {
  campaign_name?: string;
  brand?: string | null;
  channel?: string | null;
  anomaly_type?: string;
  today_value?: number | null;
  recommended_action?: string;
}

export interface A1AgentRecommendationOutput {
  priority?: number;
  campaign_name?: string;
  brand?: string | null;
  channel?: string | null;
  action?: string;
  rationale?: string;
  requires_approval?: boolean;
}
