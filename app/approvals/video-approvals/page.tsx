import { Suspense } from "react";
import { AuthGate } from "@/src/components/auth/AuthGate";
import { ApprovalsPage } from "@/src/components/dashboard/ApprovalsPage";

export default function VideoApprovalsRoute() {
  return (
    <AuthGate>
      <Suspense fallback={<ApprovalsFallback />}>
        <ApprovalsPage activeTab="videos" />
      </Suspense>
    </AuthGate>
  );
}

function ApprovalsFallback() {
  return (
    <main className="min-h-screen bg-[#f7f8fb] px-4 py-6 text-slate-950 md:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="h-36 rounded-lg border border-slate-200 bg-white" />
      </div>
    </main>
  );
}
