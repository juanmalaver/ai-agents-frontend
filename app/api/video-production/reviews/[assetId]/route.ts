import { proxyVideoReviewRequest } from "@/src/utils/videoProductionApi";

interface AssetRouteContext {
  params: Promise<{ assetId: string }> | { assetId: string };
}

export async function GET(request: Request, context: AssetRouteContext) {
  const { assetId } = await context.params;

  return proxyVideoReviewRequest(
    `/agent/video-production/reviews/${encodeURIComponent(assetId)}`,
    {},
    request,
  );
}
