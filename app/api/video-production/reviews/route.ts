import { proxyVideoReviewRequest } from "@/src/utils/videoProductionApi";

export async function GET(request: Request) {
  return proxyVideoReviewRequest("/reviews", {}, request);
}
