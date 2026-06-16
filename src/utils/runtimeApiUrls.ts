const LOCAL_BACKEND_ORIGIN = "http://localhost:3002";
const FRONTEND_SERVICE_NAME = "ai-agents-frontend";
const BACKEND_SERVICE_NAME = "ai-agents-backend";

export function resolveAuthApiUrl(
  explicitAuthApiUrl?: string | null,
  dashboardApiUrl?: string | null,
): string {
  const explicit = explicitAuthApiUrl?.trim();

  if (explicit) {
    return normalizeAuthBaseUrl(explicit);
  }

  const dashboardUrl = dashboardApiUrl?.trim();

  if (dashboardUrl) {
    return `${new URL(dashboardUrl).origin}/auth`;
  }

  const runtimeBackendOrigin = getRuntimeBackendOrigin();

  if (runtimeBackendOrigin) {
    return `${runtimeBackendOrigin}/auth`;
  }

  return `${LOCAL_BACKEND_ORIGIN}/auth`;
}

export function resolveDashboardApiUrl(
  explicitDashboardApiUrl?: string | null,
): string | undefined {
  const explicit = explicitDashboardApiUrl?.trim();

  if (explicit) {
    return explicit;
  }

  const runtimeBackendOrigin = getRuntimeBackendOrigin();

  return runtimeBackendOrigin
    ? `${runtimeBackendOrigin}/marketing-dashboard`
    : undefined;
}

export function resolveCampaignsDashboardApiUrl({
  dashboardApiUrl,
  explicitCampaignsApiUrl,
}: {
  dashboardApiUrl?: string | null;
  explicitCampaignsApiUrl?: string | null;
}): string | undefined {
  const explicit = explicitCampaignsApiUrl?.trim();

  if (explicit) {
    return explicit;
  }

  const dashboardUrl = resolveDashboardApiUrl(dashboardApiUrl);

  if (!dashboardUrl) {
    return undefined;
  }

  const trimmed = dashboardUrl.replace(/\/+$/, "");

  return trimmed.endsWith("/marketing-dashboard")
    ? `${trimmed}/campaigns`
    : `${trimmed}/marketing-dashboard/campaigns`;
}

function normalizeAuthBaseUrl(value: string): string {
  const normalized = value.replace(/\/+$/, "");

  return normalized.endsWith("/auth") ? normalized : `${normalized}/auth`;
}

function getRuntimeBackendOrigin(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const { host, protocol } = window.location;

  if (!host.startsWith(FRONTEND_SERVICE_NAME)) {
    return null;
  }

  return `${protocol}//${host.replace(
    FRONTEND_SERVICE_NAME,
    BACKEND_SERVICE_NAME,
  )}`;
}
