import { NextRequest } from "next/server";
import { proxyVideoReviewRequest } from "@/src/utils/videoProductionApi";

interface BriefDraftScriptRouteContext {
  params: Promise<{ draftId: string }> | { draftId: string };
}

export async function PATCH(
  request: NextRequest,
  context: BriefDraftScriptRouteContext,
) {
  const { draftId } = await context.params;
  const body = await request.text();

  return proxyVideoReviewRequest(
    `/brief-drafts/${encodeURIComponent(draftId)}/script`,
    {
      body,
      method: "PATCH",
    },
    request,
  );
}
