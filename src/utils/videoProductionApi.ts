import { NextResponse } from "next/server";

const DEFAULT_AI_AGENTS_BACKEND_ORIGIN = "http://localhost:3002";

interface ProxyOptions {
  body?: BodyInit | null;
  method?: "GET" | "PATCH" | "POST";
}

export async function proxyVideoReviewRequest(
  path: string,
  options: ProxyOptions = {},
  request?: Request,
): Promise<NextResponse> {
  const targetUrl = `${resolveVideoProductionBackendApiUrl()}${path}`;
  const headers = new Headers({
    Accept: "application/json",
  });
  const cookie = request?.headers.get("cookie");

  if (cookie) {
    headers.set("cookie", cookie);
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
      { detail: "AI Agents backend is unavailable." },
      { status: 502 },
    );
  }
}

function resolveVideoProductionBackendApiUrl(): string {
  const explicit =
    process.env.VIDEO_PRODUCTION_BACKEND_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_VIDEO_PRODUCTION_BACKEND_API_URL?.trim();

  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const dashboardApiUrl = process.env.NEXT_PUBLIC_DASHBOARD_API_URL?.trim();
  const dashboardOrigin = resolveOrigin(dashboardApiUrl);

  if (dashboardOrigin) {
    return `${dashboardOrigin}/api/video-production`;
  }

  const backendOrigin =
    process.env.AI_AGENTS_BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_AI_AGENTS_BACKEND_URL?.trim() ||
    DEFAULT_AI_AGENTS_BACKEND_ORIGIN;

  return `${backendOrigin.replace(/\/+$/, "")}/api/video-production`;
}

function resolveOrigin(value?: string): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}
