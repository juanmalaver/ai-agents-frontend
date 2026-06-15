import { AuthGate } from "@/src/components/auth/AuthGate";
import { DashboardPage } from "@/src/components/dashboard/DashboardPage";

export default function Home() {
  return (
    <AuthGate>
      <DashboardPage apiUrl={process.env.NEXT_PUBLIC_DASHBOARD_API_URL} />
    </AuthGate>
  );
}
