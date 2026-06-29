import { AuthGate } from "@/src/components/auth/AuthGate";
import { HealthPage } from "@/src/components/dashboard/HealthPage";

export default function MarketingDashboardHealth() {
  return (
    <AuthGate>
      <HealthPage
        apiUrl={
          process.env.NEXT_PUBLIC_HEALTH_DASHBOARD_API_URL ??
          process.env.NEXT_PUBLIC_DASHBOARD_API_URL
        }
      />
    </AuthGate>
  );
}
