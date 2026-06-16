import { AuthGate } from "@/src/components/auth/AuthGate";
import { DashboardPage } from "@/src/components/dashboard/DashboardPage";

export default function MarketingDashboard() {
  return (
    <AuthGate>
      <DashboardPage
        activeTab="overview"
        apiUrl={process.env.NEXT_PUBLIC_DASHBOARD_API_URL}
      />
    </AuthGate>
  );
}
