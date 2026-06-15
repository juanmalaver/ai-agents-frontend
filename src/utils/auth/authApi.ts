export interface AuthUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  currentWorkspace?: {
    id: string;
    displayName?: string | null;
  } | null;
}

export interface AuthenticatedResponse {
  status: "authenticated";
  user: AuthUser;
}

export interface OtpRequiredResponse {
  status: "otp_required";
}

export type LoginResponse = AuthenticatedResponse | OtpRequiredResponse;

export async function getCurrentUser(): Promise<AuthenticatedResponse> {
  return requestAuth<AuthenticatedResponse>("/me");
}

export async function getChallenge(): Promise<{ requiresOtp: boolean }> {
  return requestAuth<{ requiresOtp: boolean }>("/challenge");
}

export async function loginWithPassword(input: {
  email: string;
  password: string;
}): Promise<LoginResponse> {
  return requestAuth<LoginResponse>("/password", {
    body: JSON.stringify(input),
    method: "POST",
  });
}

export async function loginWithOtp(input: {
  otp: string;
}): Promise<AuthenticatedResponse> {
  return requestAuth<AuthenticatedResponse>("/otp", {
    body: JSON.stringify(input),
    method: "POST",
  });
}

export async function logout(): Promise<void> {
  await requestAuth<{ status: "ok" }>("/logout", {
    method: "POST",
  });
}

export function getGoogleStartUrl(): string {
  return buildAuthUrl("/google/start");
}

async function requestAuth<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(buildAuthUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = await readJson(response);

  if (!response.ok) {
    throw new Error(
      isMessageResponse(body) && body.message
        ? body.message
        : "Authentication request failed.",
    );
  }

  return body as T;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

function buildAuthUrl(path: string): string {
  const baseUrl = resolveAuthBaseUrl();
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${normalizedBase}${normalizedPath}`;
}

function resolveAuthBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_AUTH_API_URL?.trim();

  if (explicit) {
    return explicit.endsWith("/auth") ? explicit : `${explicit}/auth`;
  }

  const dashboardApiUrl = process.env.NEXT_PUBLIC_DASHBOARD_API_URL?.trim();

  if (dashboardApiUrl) {
    const url = new URL(dashboardApiUrl);

    return `${url.origin}/auth`;
  }

  return "http://localhost:3002/auth";
}

function isMessageResponse(value: unknown): value is { message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
  );
}
