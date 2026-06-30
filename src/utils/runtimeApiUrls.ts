import type { DashboardQueryParams } from "@/src/types/dashboard";
import type { HealthDashboardPlatform } from "@/src/types/campaignHealth";

const LOCAL_BACKEND_ORIGIN = "http://localhost:3002";
const FRONTEND_SERVICE_NAME = "ai-agents-frontend";
const BACKEND_SERVICE_NAME = "ai-agents-backend";
const VIDEO_PRODUCTION_API_PATH = "/api/video-production";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const GRADE_PATTERN = /^(A|B|C|D|F)$/i;

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

export function resolveVideoProductionApiUrl(requestPath: string): string {
  const trimmedPath = requestPath.trim();

  if (/^https?:\/\//i.test(trimmedPath)) {
    return trimmedPath;
  }

  const baseUrl = resolveVideoProductionApiBaseUrl();
  const apiPath = trimmedPath.startsWith(VIDEO_PRODUCTION_API_PATH)
    ? trimmedPath.slice(VIDEO_PRODUCTION_API_PATH.length)
    : trimmedPath;

  if (!apiPath) {
    return baseUrl;
  }

  return `${baseUrl}${apiPath.startsWith("/") ? "" : "/"}${apiPath}`;
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

  if (trimmed.endsWith("/marketing-dashboard/combined")) {
    return `${trimmed.slice(0, -"/combined".length)}/health`;
  }

  if (trimmed.endsWith("/marketing-dashboard/health")) {
    return trimmed;
  }

  return trimmed.endsWith("/marketing-dashboard")
    ? `${trimmed}/health`
    : `${trimmed}/marketing-dashboard/health`;
}

export function resolveTikTokDashboardApiUrl(
  explicitDashboardApiUrl?: string | null,
): string | undefined {
  const dashboardUrl = resolveDashboardApiUrl(explicitDashboardApiUrl);

  if (!dashboardUrl) {
    return undefined;
  }

  const trimmed = dashboardUrl.replace(/\/+$/, "");

  if (trimmed.endsWith("/marketing-dashboard/tiktok")) {
    return trimmed;
  }

  if (trimmed.endsWith("/marketing-dashboard/campaigns")) {
    return `${trimmed.slice(0, -"/campaigns".length)}/tiktok`;
  }

  if (trimmed.endsWith("/marketing-dashboard/combined")) {
    return `${trimmed.slice(0, -"/combined".length)}/tiktok`;
  }

  if (trimmed.endsWith("/marketing-dashboard/health")) {
    return `${trimmed.slice(0, -"/health".length)}/tiktok`;
  }

  return trimmed.endsWith("/marketing-dashboard")
    ? `${trimmed}/tiktok`
    : `${trimmed}/marketing-dashboard/tiktok`;
}

export function resolveCombinedDashboardApiUrl(
  explicitDashboardApiUrl?: string | null,
): string | undefined {
  const dashboardUrl = resolveDashboardApiUrl(explicitDashboardApiUrl);

  if (!dashboardUrl) {
    return undefined;
  }

  const trimmed = dashboardUrl.replace(/\/+$/, "");

  if (trimmed.endsWith("/marketing-dashboard/combined")) {
    return trimmed;
  }

  if (trimmed.endsWith("/marketing-dashboard/campaigns")) {
    return `${trimmed.slice(0, -"/campaigns".length)}/combined`;
  }

  if (trimmed.endsWith("/marketing-dashboard/health")) {
    return `${trimmed.slice(0, -"/health".length)}/combined`;
  }

  if (trimmed.endsWith("/marketing-dashboard/tiktok")) {
    return `${trimmed.slice(0, -"/tiktok".length)}/combined`;
  }

  return trimmed.endsWith("/marketing-dashboard")
    ? `${trimmed}/combined`
    : `${trimmed}/marketing-dashboard/combined`;
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

  if (trimmed.endsWith("/marketing-dashboard/combined")) {
    return `${trimmed.slice(0, -"/combined".length)}/ad-media`;
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

export function resolveSlackGradeMessageApiUrl(
  explicitDashboardApiUrl?: string | null,
): string | undefined {
  const dashboardUrl = resolveDashboardApiUrl(explicitDashboardApiUrl);

  if (!dashboardUrl) {
    return undefined;
  }

  return `${new URL(dashboardUrl).origin}/api/slack/messages/grade`;
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

  if (trimmed.endsWith("/marketing-dashboard/tiktok")) {
    return `${trimmed}/brands`;
  }

  if (trimmed.endsWith("/marketing-dashboard/combined")) {
    return `${trimmed}/brands`;
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
  query?: Partial<DashboardQueryParams> & {
    adGrades?: string[] | null;
    grades?: string[] | null;
    platform?: HealthDashboardPlatform | string | null;
    states?: string[] | null;
  },
): string {
  const params = new URLSearchParams();
  const normalizedBrand = normalizeBrandParam(query?.brand);
  const normalizedFrom = normalizeDateParam(query?.from);
  const normalizedPlatform =
    query?.platform == null
      ? null
      : normalizeHealthPlatformParam(query.platform);
  const normalizedTo = normalizeDateParam(query?.to);

  if (normalizedBrand) {
    params.set("brand", normalizedBrand);
  }

  if (normalizedFrom && normalizedTo && normalizedFrom <= normalizedTo) {
    params.set("from", normalizedFrom);
    params.set("to", normalizedTo);
  }

  if (normalizedPlatform) {
    params.set("platform", normalizedPlatform);
  }

  for (const state of query?.states ?? []) {
    const normalizedState = state.trim();

    if (normalizedState) {
      params.append("states", normalizedState);
    }
  }

  for (const grade of query?.grades ?? []) {
    const normalizedGrade = normalizeGradeParam(grade);

    if (normalizedGrade) {
      params.append("grades", normalizedGrade);
    }
  }

  for (const grade of query?.adGrades ?? []) {
    const normalizedGrade = normalizeGradeParam(grade);

    if (normalizedGrade) {
      params.append("adGrades", normalizedGrade);
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
    platform?: string | null;
    to?: string | null;
  } | null,
): string | undefined {
  if (!url) {
    return undefined;
  }

  const params = new URLSearchParams();
  const normalizedFrom = normalizeDateParam(query?.from);
  const normalizedPlatform = normalizeHealthPlatformParam(query?.platform);
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

  if (normalizedPlatform) {
    params.set("platform", normalizedPlatform);
  }

  const queryString = params.toString();

  if (!queryString) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";

  return `${url}${separator}${queryString}`;
}

function normalizeHealthPlatformParam(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, " ");

  if (!normalized || normalized === "all" || normalized === "all platforms") {
    return "all";
  }

  if (normalized === "meta" || normalized === "facebook") {
    return "meta";
  }

  if (normalized === "tiktok" || normalized === "tik tok") {
    return "tiktok";
  }

  return null;
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

function resolveVideoProductionApiBaseUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_VIDEO_PRODUCTION_BACKEND_API_URL?.trim();

  if (explicit) {
    return normalizeVideoProductionApiBaseUrl(explicit);
  }

  const dashboardOrigin = resolveUrlOrigin(
    process.env.NEXT_PUBLIC_DASHBOARD_API_URL?.trim(),
  );

  if (dashboardOrigin) {
    return `${dashboardOrigin}${VIDEO_PRODUCTION_API_PATH}`;
  }

  const runtimeBackendOrigin = getRuntimeBackendOrigin();

  return `${runtimeBackendOrigin ?? LOCAL_BACKEND_ORIGIN}${VIDEO_PRODUCTION_API_PATH}`;
}

function normalizeVideoProductionApiBaseUrl(value: string): string {
  const normalized = value.replace(/\/+$/, "");

  return normalized.endsWith(VIDEO_PRODUCTION_API_PATH)
    ? normalized
    : `${normalized}${VIDEO_PRODUCTION_API_PATH}`;
}

function resolveUrlOrigin(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
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

function normalizeGradeParam(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();

  return normalized && GRADE_PATTERN.test(normalized) ? normalized : null;
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
