import { AuthGate } from "@/src/components/auth/AuthGate";
import { DashboardPage } from "@/src/components/dashboard/DashboardPage";
import { resolveTikTokDashboardApiUrl } from "@/src/utils/runtimeApiUrls";

export default function TikTokMarketingDashboard() {
  return (
    <AuthGate>
      <DashboardPage
        activeTab="tiktok"
        apiUrl={resolveTikTokDashboardApiUrl(
          process.env.NEXT_PUBLIC_DASHBOARD_API_URL,
        )}
      />
    </AuthGate>
  );
}
