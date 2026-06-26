import { AuthGate } from "@/src/components/auth/AuthGate";
import { DashboardPage } from "@/src/components/dashboard/DashboardPage";
import { resolveCombinedDashboardApiUrl } from "@/src/utils/runtimeApiUrls";

export default function CombinedMarketingDashboard() {
  return (
    <AuthGate>
      <DashboardPage
        activeTab="combined"
        apiUrl={resolveCombinedDashboardApiUrl(
          process.env.NEXT_PUBLIC_DASHBOARD_API_URL,
        )}
      />
    </AuthGate>
  );
}
