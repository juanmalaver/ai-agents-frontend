import { proxyVideoReviewRequest } from "@/src/utils/videoProductionApi";

export async function GET(request: Request) {
  return proxyVideoReviewRequest(
    "/agent/video-production/reviews/pending",
    {},
    request,
  );
}
