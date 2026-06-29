import { NextRequest } from "next/server";
import { proxyVideoReviewRequest } from "@/src/utils/videoProductionApi";

interface BriefDraftStoryboardRouteContext {
  params: Promise<{ draftId: string }> | { draftId: string };
}

export async function PATCH(
  request: NextRequest,
  context: BriefDraftStoryboardRouteContext,
) {
  const { draftId } = await context.params;
  const body = await request.text();

  return proxyVideoReviewRequest(
    `/brief-drafts/${encodeURIComponent(draftId)}/storyboard`,
    {
      body,
      method: "PATCH",
    },
    request,
  );
}
