import { NextRequest } from "next/server";
import { proxyVideoReviewRequest } from "@/src/utils/videoProductionApi";

export async function POST(request: NextRequest) {
  const body = await request.text();

  return proxyVideoReviewRequest(
    "/brief-drafts",
    {
      body,
      method: "POST",
    },
    request,
  );
}
