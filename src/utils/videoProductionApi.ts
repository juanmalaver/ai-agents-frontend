import { NextResponse } from "next/server";
import { resolveAuthApiUrl } from "@/src/utils/runtimeApiUrls";

const DEFAULT_VIDEO_PRODUCTION_AGENT_API_URL = "http://localhost:8000";

interface ProxyOptions {
  body?: BodyInit | null;
  method?: "GET" | "POST";
}

export async function proxyVideoReviewRequest(
  path: string,
  options: ProxyOptions = {},
  request?: Request,
): Promise<NextResponse> {
  const authFailure = await validateDashboardSession(request);

  if (authFailure) {
    return authFailure;
  }

  const targetUrl = `${resolveVideoProductionAgentApiUrl()}${path}`;
  const headers = new Headers({
    Accept: "application/json",
  });
  const reviewSecret = process.env.VIDEO_REVIEW_WEBHOOK_SECRET?.trim();

  if (reviewSecret) {
    headers.set("x-video-review-secret", reviewSecret);
  }

  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(targetUrl, {
      body: options.body,
      cache: "no-store",
      headers,
      method: options.method ?? "GET",
    });
    const responseBody = await response.text();

    return new NextResponse(responseBody || null, {
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") ?? "application/json",
      },
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      { detail: "Video Production Agent is unavailable." },
      { status: 502 },
    );
  }
}

async function validateDashboardSession(
  request?: Request,
): Promise<NextResponse | null> {
  const cookie = request?.headers.get("cookie");

  if (!cookie) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(`${resolveAuthBaseUrl()}/me`, {
      cache: "no-store",
      headers: {
        cookie,
      },
    });

    if (response.ok) {
      return null;
    }
  } catch {
    return NextResponse.json(
      { detail: "Authentication service is unavailable." },
      { status: 502 },
    );
  }

  return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
}

function resolveVideoProductionAgentApiUrl(): string {
  return (
    process.env.VIDEO_PRODUCTION_AGENT_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_VIDEO_PRODUCTION_AGENT_API_URL?.trim() ||
    DEFAULT_VIDEO_PRODUCTION_AGENT_API_URL
  ).replace(/\/+$/, "");
}

function resolveAuthBaseUrl(): string {
  return resolveAuthApiUrl(
    process.env.AUTH_API_URL?.trim() ||
      process.env.NEXT_PUBLIC_AUTH_API_URL?.trim(),
    process.env.NEXT_PUBLIC_DASHBOARD_API_URL?.trim(),
  ).replace(/\/+$/, "");
}
