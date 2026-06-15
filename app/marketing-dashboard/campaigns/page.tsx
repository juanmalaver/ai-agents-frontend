import { AuthGate } from "@/src/components/auth/AuthGate";
import { CampaignsPage } from "@/src/components/dashboard/CampaignsPage";

export default function MarketingDashboardCampaigns() {
  return (
    <AuthGate>
      <CampaignsPage
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
