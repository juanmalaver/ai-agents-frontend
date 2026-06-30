import { proxyVideoReviewStreamRequest } from "@/src/utils/videoProductionApi";

interface AssetVideoRouteContext {
  params: Promise<{ assetId: string }> | { assetId: string };
}

export async function GET(request: Request, context: AssetVideoRouteContext) {
  const { assetId } = await context.params;

  return proxyVideoReviewStreamRequest(
    `/reviews/${encodeURIComponent(assetId)}/video`,
    request,
  );
}
