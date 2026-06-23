import type { DashboardQueryParams } from "@/src/types/dashboard";

const LOCAL_BACKEND_ORIGIN = "http://localhost:3002";
const FRONTEND_SERVICE_NAME = "ai-agents-frontend";
const BACKEND_SERVICE_NAME = "ai-agents-backend";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

export function resolveHealthDashboardApiUrl(
  explicitDashboardApiUrl?: string | null,
): string | undefined {
  const dashboardUrl = resolveDashboardApiUrl(explicitDashboardApiUrl);

  if (!dashboardUrl) {
    return undefined;
  }

  const trimmed = dashboardUrl.replace(/\/+$/, "");

  if (trimmed.endsWith("/marketing-dashboard/campaigns")) {
    return `${trimmed.slice(0, -"/campaigns".length)}/health`;
  }

  if (trimmed.endsWith("/marketing-dashboard/health")) {
    return trimmed;
  }

  return trimmed.endsWith("/marketing-dashboard")
    ? `${trimmed}/health`
    : `${trimmed}/marketing-dashboard/health`;
}

export function resolveDashboardAdMediaApiUrl(
  explicitDashboardApiUrl?: string | null,
): string | undefined {
  const dashboardUrl = resolveDashboardApiUrl(explicitDashboardApiUrl);

  if (!dashboardUrl) {
    return undefined;
  }

  const trimmed = dashboardUrl.replace(/\/+$/, "");

  if (trimmed.endsWith("/marketing-dashboard/campaigns")) {
    return `${trimmed.slice(0, -"/campaigns".length)}/ad-media`;
  }

  if (trimmed.endsWith("/marketing-dashboard/health")) {
    return `${trimmed.slice(0, -"/health".length)}/ad-media`;
  }

  if (trimmed.endsWith("/marketing-dashboard/ad-media")) {
    return trimmed;
  }

  return trimmed.endsWith("/marketing-dashboard")
    ? `${trimmed}/ad-media`
    : `${trimmed}/marketing-dashboard/ad-media`;
}

export function resolveDashboardSectionApiUrl(
  section: "kpis" | "monthly-performance" | "state-campaigns" | "state-law-firms",
  explicitDashboardApiUrl?: string | null,
): string | undefined {
  const dashboardUrl = resolveDashboardApiUrl(explicitDashboardApiUrl);

  return appendSectionPath(dashboardUrl, `sections/${section}`);
}

export function appendStateLawFirmsQueryParams(
  url: string | undefined,
  query: Partial<DashboardQueryParams> & { state: string },
): string | undefined {
  const baseUrl = appendDashboardQueryParams(url, query);

  if (!baseUrl) {
    return undefined;
  }

  const state = query.state.trim();

  if (!state) {
    return baseUrl;
  }

  const params = new URLSearchParams();
  params.set("state", state);
  const separator = baseUrl.includes("?") ? "&" : "?";

  return `${baseUrl}${separator}${params.toString()}`;
}

export function resolveDashboardBrandsApiUrl(
  explicitDashboardApiUrl?: string | null,
): string | undefined {
  const dashboardUrl = resolveDashboardApiUrl(explicitDashboardApiUrl);

  if (!dashboardUrl) {
    return undefined;
  }

  const trimmed = dashboardUrl.replace(/\/+$/, "");

  if (trimmed.endsWith("/marketing-dashboard/campaigns")) {
    return `${trimmed.slice(0, -"/campaigns".length)}/brands`;
  }

  return trimmed.endsWith("/marketing-dashboard")
    ? `${trimmed}/brands`
    : `${trimmed}/marketing-dashboard/brands`;
}

export function appendDashboardQueryParams(
  url: string | undefined,
  query?: Partial<DashboardQueryParams> | null,
): string | undefined {
  if (!url) {
    return undefined;
  }

  const params = new URLSearchParams();
  const normalizedBrand = normalizeBrandParam(query?.brand);
  const normalizedFrom = normalizeDateParam(query?.from);
  const normalizedTo = normalizeDateParam(query?.to);

  if (normalizedBrand) {
    params.set("brand", normalizedBrand);
  }

  if (normalizedFrom && normalizedTo && normalizedFrom <= normalizedTo) {
    params.set("from", normalizedFrom);
    params.set("to", normalizedTo);
  }

  const queryString = params.toString();

  if (!queryString) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";

  return `${url}${separator}${queryString}`;
}

export function buildHealthPageUrl(
  query?: Partial<DashboardQueryParams> & { states?: string[] | null },
): string {
  const params = new URLSearchParams();
  const normalizedBrand = normalizeBrandParam(query?.brand);
  const normalizedFrom = normalizeDateParam(query?.from);
  const normalizedTo = normalizeDateParam(query?.to);

  if (normalizedBrand) {
    params.set("brand", normalizedBrand);
  }

  if (normalizedFrom && normalizedTo && normalizedFrom <= normalizedTo) {
    params.set("from", normalizedFrom);
    params.set("to", normalizedTo);
  }

  for (const state of query?.states ?? []) {
    const normalizedState = state.trim();

    if (normalizedState) {
      params.append("states", normalizedState);
    }
  }

  const queryString = params.toString();

  return queryString
    ? `/marketing-dashboard/health?${queryString}`
    : "/marketing-dashboard/health";
}

export function appendHealthDashboardQueryParams(
  url: string | undefined,
  query?: {
    brands?: string[] | null;
    from?: string | null;
    to?: string | null;
  } | null,
): string | undefined {
  if (!url) {
    return undefined;
  }

  const params = new URLSearchParams();
  const normalizedFrom = normalizeDateParam(query?.from);
  const normalizedTo = normalizeDateParam(query?.to);

  for (const brand of query?.brands ?? []) {
    const normalizedBrand = normalizeBrandParam(brand);

    if (normalizedBrand) {
      params.append("brands", normalizedBrand);
    }
  }

  if (normalizedFrom && normalizedTo && normalizedFrom <= normalizedTo) {
    params.set("from", normalizedFrom);
    params.set("to", normalizedTo);
  }

  const queryString = params.toString();

  if (!queryString) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";

  return `${url}${separator}${queryString}`;
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

function normalizeBrandParam(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ");

  if (
    !normalized ||
    normalized.toLowerCase() === "all" ||
    normalized.toLowerCase() === "all brands"
  ) {
    return null;
  }

  return normalized;
}

function normalizeDateParam(value: string | null | undefined): string | null {
  const normalized = value?.trim();

  if (!normalized || !DATE_PATTERN.test(normalized)) {
    return null;
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);

  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
    ? null
    : normalized;
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
