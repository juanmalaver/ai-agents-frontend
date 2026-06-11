import type {
  AiAgentRecommendation,
  CampaignDashboardApiResponse,
  CampaignStateName,
  CampaignStateRow,
  MonthlyCampaignPerformance,
} from "@/src/types/dashboard";
import { safeDivide } from "@/src/utils/dashboardFormatters";

const generatedAt = "2026-06-11T12:00:00.000Z";

export const dashboardMock: CampaignDashboardApiResponse = {
  aggregatedKpis: {
    budgetSpentCompletionPct: 0.823,
    cpsl: 168.12,
    cpql: 241.5,
    finalCpl: 229.96,
    leadGoalCompletionPct: 0.857,
    mtdSpentPct: 0.823,
    slGoalCompletionPct: 0.862,
  },
  generatedAt,
  monthlyPerformance: [
    monthPerformance("2026-01", 420, 500),
    monthPerformance("2026-02", 480, 500),
    monthPerformance("2026-03", 530, 540),
    monthPerformance("2026-04", 610, 580),
    monthPerformance("2026-05", 690, 640),
    monthPerformance("2026-06", 722, 720),
  ],
  stateCampaigns: [
    stateRow({
      budget: 120000,
      leads: 540,
      leadsGoal: 520,
      mtdSl: 760,
      mtdSpent: 102500,
      recommendation: recommendation({
        id: "rec-texas",
        priority: "medium",
        rationale:
          "Texas is above SL goal while spend remains below budget pace, so incremental budget can be shifted into the highest converting placements.",
        state: "Texas",
        summary: "Scale efficient Texas placements while monitoring CPL drift.",
      }),
      slGoal: 720,
      state: "Texas",
    }),
    stateRow({
      budget: 85000,
      leads: 321,
      leadsGoal: 380,
      mtdSl: 438,
      mtdSpent: 71800,
      recommendation: recommendation({
        id: "rec-georgia",
        priority: "medium",
        rationale:
          "Georgia is near goal but lead volume is behind plan, indicating the campaign needs more qualified traffic before month end.",
        state: "Georgia",
        summary: "Increase lead capture volume in Georgia without raising CPSL.",
      }),
      slGoal: 510,
      state: "Georgia",
    }),
    stateRow({
      budget: 94000,
      leads: 260,
      leadsGoal: 430,
      mtdSl: 372,
      mtdSpent: 70800,
      recommendation: recommendation({
        id: "rec-florida",
        priority: "critical",
        rationale:
          "Florida is materially below SL goal and CPL is above the temporary cost threshold, so spend should move away from weak segments.",
        state: "Florida",
        summary: "Reduce Florida spend in underperforming segments immediately.",
      }),
      slGoal: 600,
      state: "Florida",
    }),
    stateRow({
      budget: 150000,
      leads: 628,
      leadsGoal: 610,
      mtdSl: 846,
      mtdSpent: 132000,
      recommendation: recommendation({
        id: "rec-california",
        priority: "low",
        rationale:
          "California is ahead of SL and lead goals with spend inside expected pacing, making it a stable source of campaign volume.",
        state: "California",
        summary: "Maintain California budget and protect high quality traffic.",
      }),
      slGoal: 820,
      state: "California",
    }),
    stateRow({
      budget: 62000,
      leads: 191,
      leadsGoal: 220,
      mtdSl: 252,
      mtdSpent: 51000,
      recommendation: recommendation({
        id: "rec-mixed",
        priority: "high",
        rationale:
          "Mixed campaigns are close to goal but cost metrics are elevated, suggesting audience overlap or inefficient creative rotation.",
        state: "Mixed",
        summary: "Tighten Mixed audience targeting and refresh creative.",
      }),
      slGoal: 300,
      state: "Mixed",
    }),
    stateRow({
      budget: 48000,
      leads: 102,
      leadsGoal: 180,
      mtdSl: 158,
      mtdSpent: 39200,
      recommendation: recommendation({
        id: "rec-sunshine",
        priority: "critical",
        rationale:
          "Sunshine is behind SL and lead goals while already past 80% spend completion, so remaining budget needs stronger controls.",
        state: "Sunshine",
        summary: "Pause low intent Sunshine spend and reallocate to proven states.",
      }),
      slGoal: 240,
      state: "Sunshine",
    }),
    stateRow({
      budget: 18000,
      leads: 24,
      leadsGoal: 70,
      mtdSl: 0,
      mtdSpent: 7800,
      recommendation: recommendation({
        id: "rec-testing",
        priority: "high",
        rationale:
          "Testing has no MTD SL, so CPSL and conversion rate are unavailable and the campaign should not scale until tracking is validated.",
        state: "Testing",
        summary: "Validate Testing campaign tracking before adding spend.",
      }),
      slGoal: 90,
      state: "Testing",
    }),
  ],
};

function monthPerformance(
  month: string,
  sl: number,
  slGoal: number,
): MonthlyCampaignPerformance {
  return {
    month,
    sl,
    slGoal,
    slPctToTarget: safeDivide(sl, slGoal),
  };
}

function stateRow(input: {
  budget: number;
  leads: number;
  leadsGoal: number;
  mtdSl: number;
  mtdSpent: number;
  recommendation: AiAgentRecommendation;
  slGoal: number;
  state: CampaignStateName;
}): CampaignStateRow {
  return {
    budget: input.budget,
    cpl: safeDivide(input.mtdSpent, input.leads),
    cpsl: safeDivide(input.mtdSpent, input.mtdSl),
    conversionRate: safeDivide(input.leads, input.mtdSl),
    goalPct: safeDivide(input.mtdSl, input.slGoal),
    id: input.state.toLowerCase(),
    leads: input.leads,
    leadsGoal: input.leadsGoal,
    mtdSl: input.mtdSl,
    mtdSpent: input.mtdSpent,
    recommendation: input.recommendation,
    slGoal: input.slGoal,
    spentPct: safeDivide(input.mtdSpent, input.budget),
    state: input.state,
  };
}

function recommendation(input: {
  id: string;
  priority: AiAgentRecommendation["priority"];
  rationale: string;
  state: CampaignStateName;
  summary: string;
}): AiAgentRecommendation {
  return {
    actions: [
      {
        description: `Review ${input.state} budget allocation against goal completion.`,
        id: `${input.id}-budget`,
        impact: "Improves spend pacing.",
        label: "Review budget allocation",
      },
      {
        description: `Compare ${input.state} CPL and CPSL against current campaign thresholds.`,
        id: `${input.id}-cost`,
        impact: "Protects cost efficiency.",
        label: "Audit cost efficiency",
      },
    ],
    confidenceScore: input.priority === "critical" ? 0.91 : 0.84,
    generatedAt,
    id: input.id,
    priority: input.priority,
    rationale: input.rationale,
    status: "new",
    summary: input.summary,
  };
}
