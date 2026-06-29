import { NextRequest } from "next/server";
import { proxyVideoReviewRequest } from "@/src/utils/videoProductionApi";

interface BriefDraftContinueRouteContext {
  params: Promise<{ draftId: string }> | { draftId: string };
}

export async function POST(
  request: NextRequest,
  context: BriefDraftContinueRouteContext,
) {
  const { draftId } = await context.params;
  const body = await request.text();

  return proxyVideoReviewRequest(
    `/brief-drafts/${encodeURIComponent(draftId)}/continue`,
    {
      body,
      method: "POST",
    },
    request,
  );
}
