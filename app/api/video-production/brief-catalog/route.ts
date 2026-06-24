import { NextRequest } from "next/server";
import { proxyVideoReviewRequest } from "@/src/utils/videoProductionApi";

export async function GET(request: NextRequest) {
  return proxyVideoReviewRequest("/brief-catalog", undefined, request);
}
