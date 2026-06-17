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

export function resolveDashboardSectionApiUrl(
  section:
    | "kpis"
    | "monthly-performance"
    | "state-campaigns",
  explicitDashboardApiUrl?: string | null,
): string | undefined {
  const dashboardUrl = resolveDashboardApiUrl(explicitDashboardApiUrl);

  return appendSectionPath(dashboardUrl, `sections/${section}`);
}

export function resolveCampaignsDashboardSectionApiUrl({
  dashboardApiUrl,
  explicitCampaignsApiUrl,
  section,
}: {
  dashboardApiUrl?: string | null;
  explicitCampaignsApiUrl?: string | null;
  section:
    | "lead-behavior"
    | "lower-detail"
    | "results"
    | "state-completion"
    | "summary";
}): string | undefined {
  const campaignsUrl = resolveCampaignsDashboardApiUrl({
    dashboardApiUrl,
    explicitCampaignsApiUrl,
  });

  return appendSectionPath(campaignsUrl, `sections/${section}`);
}

export function resolveAgentEndpointUrl({
  action,
  dashboardApiUrl,
  explicitAgentUrl,
}: {
  action: "latest" | "rerun";
  dashboardApiUrl?: string | null;
  explicitAgentUrl?: string | null;
}): string | undefined {
  const explicit = explicitAgentUrl?.trim();

  if (explicit) {
    return explicit;
  }

  const dashboardUrl = resolveDashboardApiUrl(dashboardApiUrl);

  if (!dashboardUrl) {
    return undefined;
  }

  try {
    const url = new URL(dashboardUrl);
    return `${url.origin}/api/agents/a1-kcars-performance-agent/${action}`;
  } catch {
    const trimmed = dashboardUrl.replace(/\/+$/, "");
    const base = trimmed.endsWith("/marketing-dashboard/campaigns")
      ? trimmed.slice(0, -"/marketing-dashboard/campaigns".length)
      : trimmed.endsWith("/marketing-dashboard")
      ? trimmed.slice(0, -"/marketing-dashboard".length)
      : trimmed;

    return `${base}/api/agents/a1-kcars-performance-agent/${action}`;
  }
}

function normalizeAuthBaseUrl(value: string): string {
  const normalized = value.replace(/\/+$/, "");

  return normalized.endsWith("/auth") ? normalized : `${normalized}/auth`;
}

function appendSectionPath(
  baseUrl: string | undefined,
  sectionPath: string,
): string | undefined {
  if (!baseUrl) {
    return undefined;
  }

  return `${baseUrl.replace(/\/+$/, "")}/${sectionPath}`;
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
