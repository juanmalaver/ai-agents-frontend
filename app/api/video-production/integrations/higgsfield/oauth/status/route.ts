import { NextRequest } from "next/server";
import { proxyVideoReviewRequest } from "@/src/utils/videoProductionApi";

export async function GET(request: NextRequest) {
  return proxyVideoReviewRequest(
    "/integrations/higgsfield/oauth/status",
    undefined,
    request,
  );
}
