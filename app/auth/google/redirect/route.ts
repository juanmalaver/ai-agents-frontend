import { NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest) {
  const sourceUrl = new URL(request.url);
  const callbackUrl = new URL("google/callback", getAuthBaseUrl());

  for (const key of ["code", "state", "error", "error_description"]) {
    const value = sourceUrl.searchParams.get(key);

    if (value) {
      callbackUrl.searchParams.set(key, value);
    }
  }

  return NextResponse.redirect(callbackUrl);
}

function getAuthBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_AUTH_API_URL?.trim();

  if (explicit) {
    return normalizeAuthBaseUrl(explicit);
  }

  const dashboardApiUrl = process.env.NEXT_PUBLIC_DASHBOARD_API_URL?.trim();

  if (dashboardApiUrl) {
    return `${new URL(dashboardApiUrl).origin}/auth/`;
  }

  return "http://localhost:3002/auth/";
}

function normalizeAuthBaseUrl(value: string): string {
  const normalized = value.replace(/\/+$/, "");

  return normalized.endsWith("/auth")
    ? `${normalized}/`
    : `${normalized}/auth/`;
}
