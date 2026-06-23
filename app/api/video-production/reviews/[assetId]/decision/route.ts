import { NextRequest } from "next/server";
import { proxyVideoReviewRequest } from "@/src/utils/videoProductionApi";

interface AssetDecisionRouteContext {
  params: Promise<{ assetId: string }> | { assetId: string };
}

export async function POST(
  request: NextRequest,
  context: AssetDecisionRouteContext,
) {
  const { assetId } = await context.params;
  const body = await request.text();

  return proxyVideoReviewRequest(
    `/agent/video-production/reviews/${encodeURIComponent(assetId)}/decision`,
    {
      body,
      method: "POST",
    },
    request,
  );
}
