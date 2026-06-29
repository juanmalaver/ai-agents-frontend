import { proxyVideoReviewRequest } from "@/src/utils/videoProductionApi";

interface BriefDraftRouteContext {
  params: Promise<{ draftId: string }> | { draftId: string };
}

export async function GET(request: Request, context: BriefDraftRouteContext) {
  const { draftId } = await context.params;

  return proxyVideoReviewRequest(
    `/brief-drafts/${encodeURIComponent(draftId)}`,
    {},
    request,
  );
}
