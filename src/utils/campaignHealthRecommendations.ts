import type { CampaignHealthRecommendation } from "../types/campaignHealth";

export function normalizeCampaignHealthRecommendation(
  value: string | null | undefined,
): CampaignHealthRecommendation {
  const normalized = value?.trim().replace(/\s+/g, " ").toLowerCase();

  switch (normalized) {
    case "learning":
      return "Learning";
    case "replicate / keep on":
    case "replicate/keep on":
    case "scale":
    case "skill":
      return "Scale";
    case "shut off":
    case "shut-off":
    case "shutoff":
      return "Shut off";
    case "review":
    default:
      return "Review";
  }
}
