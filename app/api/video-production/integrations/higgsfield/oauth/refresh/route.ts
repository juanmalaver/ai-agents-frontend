import { NextRequest } from "next/server";
import { proxyVideoReviewRequest } from "@/src/utils/videoProductionApi";

export async function POST(request: NextRequest) {
  return proxyVideoReviewRequest(
    "/integrations/higgsfield/oauth/refresh",
    {
      method: "POST",
    },
    request,
  );
}
