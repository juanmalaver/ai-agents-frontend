import { AuthGate } from "@/src/components/auth/AuthGate";
import { CampaignsPage } from "@/src/components/dashboard/CampaignsPage";

export default function MarketingDashboardCampaigns() {
  return (
    <AuthGate>
      <CampaignsPage
        agentLatestUrl={process.env.NEXT_PUBLIC_A1_AGENT_LATEST_URL}
        agentRerunUrl={process.env.NEXT_PUBLIC_A1_AGENT_RERUN_URL}
        apiUrl={
          process.env.NEXT_PUBLIC_CAMPAIGNS_DASHBOARD_API_URL ??
          deriveCampaignsApiUrl(process.env.NEXT_PUBLIC_DASHBOARD_API_URL)
        }
      />
    </AuthGate>
  );
}

function deriveCampaignsApiUrl(apiUrl: string | undefined): string | undefined {
  if (!apiUrl) {
    return undefined;
  }

  const trimmed = apiUrl.replace(/\/+$/, "");

  if (trimmed.endsWith("/marketing-dashboard")) {
    return `${trimmed}/campaigns`;
  }

  return `${trimmed}/marketing-dashboard/campaigns`;
}
