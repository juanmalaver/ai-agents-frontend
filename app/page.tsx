import { AuthGate } from "@/src/components/auth/AuthGate";
import { DashboardPage } from "@/src/components/dashboard/DashboardPage";

export default function Home() {
  return (
    <AuthGate>
      <DashboardPage
        agentLatestUrl={process.env.NEXT_PUBLIC_A1_AGENT_LATEST_URL}
        agentRerunUrl={process.env.NEXT_PUBLIC_A1_AGENT_RERUN_URL}
        apiUrl={process.env.NEXT_PUBLIC_DASHBOARD_API_URL}
      />
    </AuthGate>
  );
}
