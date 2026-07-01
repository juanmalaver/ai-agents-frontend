"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  AuthUser,
  getCurrentUser,
  getGoogleStartUrl,
  logout,
} from "@/src/utils/auth/authApi";
import { ThemeToggle } from "@/src/components/dashboard/ThemeToggle";

const DASHBOARD_NAME = "Marketing Dashboard";

type AuthState = "checking" | "authenticated" | "login";

interface AuthGateProps {
  children: ReactNode;
}

const AuthUserContext = createContext<AuthUser | null>(null);

export function useAuthUser(): AuthUser | null {
  return useContext(AuthUserContext);
}

export function AuthGate({ children }: AuthGateProps) {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const loadSession = useCallback(async () => {
    setAuthState("checking");
    setError(null);

    try {
      const response = await getCurrentUser();

      setUser(response.user);
      setAuthState("authenticated");
    } catch {
      const authRedirectError = readAuthRedirectError();

      setUser(null);
      setError(authRedirectError);
      setAuthState("login");
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const handleGoogleSignIn = () => {
    setIsSubmitting(true);
    setError(null);
    window.location.href = getGoogleStartUrl();
  };

  const handleLogout = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await logout();
    } finally {
      setUser(null);
      setAuthState("login");
      setIsSubmitting(false);
    }
  };

  if (authState === "checking") {
    return <AuthLoadingState />;
  }

  if (authState === "authenticated") {
    return (
      <AuthUserContext.Provider value={user}>
        <div className="sticky top-0 z-30 border-b border-[var(--color-app-border)] bg-[var(--color-app-surface-glass)] px-4 pb-2.5 pt-3.5 text-[var(--color-app-text)] shadow-sm backdrop-blur md:px-6 lg:px-8">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 flex h-1">
            <span className="flex-1 bg-teal-500" />
            <span className="flex-1 bg-sky-500" />
            <span className="flex-1 bg-amber-400" />
          </div>
          <div className="mx-auto flex w-full max-w-[100rem] items-center justify-between gap-3 text-sm">
            <div className="flex min-w-0 items-center gap-3">
              <UserAvatar user={user} />
              <span className="truncate font-medium text-[var(--color-app-text)]">
                {formatUserLabel(user)}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle />
              <button
                className="h-9 rounded-lg border border-[var(--color-control-border)] bg-[var(--color-control-bg)] px-3 font-semibold text-[var(--color-control-text)] shadow-sm transition hover:bg-[var(--color-control-hover-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
                onClick={() => void handleLogout()}
                type="button"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
        {children}
      </AuthUserContext.Provider>
    );
  }

  return (
    <AuthLayout error={error}>
      <button
        aria-busy={isSubmitting}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-[var(--color-control-border)] bg-[var(--color-control-bg)] px-4 text-sm font-semibold text-[var(--color-app-text)] shadow-sm transition hover:bg-[var(--color-control-hover-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isSubmitting}
        onClick={handleGoogleSignIn}
        type="button"
      >
        <GoogleMark />
        <span>
          {isSubmitting ? "Opening Google..." : "Continue with Google"}
        </span>
      </button>
      <p className="mt-4 text-center text-xs leading-5 text-[var(--color-app-text-muted)]">
        Access is limited to approved workspace accounts.
      </p>
    </AuthLayout>
  );
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--color-app-bg)] text-[var(--color-app-text)]">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 flex h-1">
        <span className="flex-1 bg-teal-500" />
        <span className="flex-1 bg-sky-500" />
        <span className="flex-1 bg-amber-400" />
      </div>
      <div className="mx-auto grid min-h-screen w-full max-w-3xl grid-cols-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  );
}

function AuthLoadingState() {
  return (
    <AuthShell>
      <section
        aria-label="Loading"
        className="col-span-full flex min-h-[calc(100vh-3rem)] items-center justify-center py-10"
      >
        <div className="flex flex-col items-center gap-5">
          <BrandMark />
          <div
            aria-hidden="true"
            className="size-8 animate-spin rounded-full border-2 border-slate-200 border-t-teal-500"
          />
          <span className="sr-only">Loading</span>
        </div>
      </section>
    </AuthShell>
  );
}

function AuthLayout({
  children,
  error,
}: {
  children: ReactNode;
  error: string | null;
}) {
  return (
    <AuthShell>
      <section className="flex min-h-[calc(100vh-3rem)] items-center justify-center py-10">
        <div className="w-full max-w-[420px]">
          <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-surface)] p-6 shadow-[0_18px_55px_rgba(15,23,42,0.10)] sm:p-8">
            <div className="flex items-center gap-3">
              <BrandMark />
              <div>
                <p className="text-sm font-semibold text-[var(--color-app-text)]">
                  {DASHBOARD_NAME}
                </p>
                <p className="text-xs text-[var(--color-app-text-muted)]">
                  Workspace access
                </p>
              </div>
            </div>

            <div>
              <h1 className="mt-8 text-2xl font-semibold text-[var(--color-app-text)]">
                Sign in
              </h1>
              <p className="mt-2 text-sm leading-6 text-[var(--color-app-text-muted)]">
                Use your Google account to sign in.
              </p>
            </div>

            {error ? (
              <div
                className="mt-5 flex gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-800"
                role="alert"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700">
                  !
                </span>
                <p className="leading-5">{error}</p>
              </div>
            ) : null}

            <div className="mt-6">{children}</div>
          </div>
        </div>
      </section>
    </AuthShell>
  );
}

function BrandMark() {
  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--color-nav-glyph-bg)] text-sm font-semibold text-[var(--color-nav-glyph-text)] shadow-sm">
      MD
    </div>
  );
}

function GoogleMark() {
  return (
    <span
      aria-hidden="true"
      className="flex size-5 shrink-0 items-center justify-center rounded-full"
      style={{
        background:
          "conic-gradient(from 45deg, #4285f4 0 25%, #34a853 0 50%, #fbbc05 0 75%, #ea4335 0 100%)",
      }}
    >
      <span className="flex size-3.5 items-center justify-center rounded-full bg-white text-[10px] font-bold leading-none text-slate-950">
        G
      </span>
    </span>
  );
}

function UserAvatar({ user }: { user: AuthUser | null }) {
  const label = formatUserInitials(user);

  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-nav-glyph-bg)] text-xs font-semibold text-[var(--color-nav-glyph-text)]">
      {label}
    </span>
  );
}

function formatUserLabel(user: AuthUser | null): string {
  if (!user) {
    return "Signed in with Google";
  }

  const fullName = [user.firstName, user.lastName]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");

  return fullName ? `${fullName} (${user.email})` : user.email;
}

function formatUserInitials(user: AuthUser | null): string {
  if (!user) {
    return "G";
  }

  const initials = [user.firstName, user.lastName]
    .map((value) => value?.trim().charAt(0))
    .filter(Boolean)
    .join("");

  return (initials || user.email.charAt(0) || "G").slice(0, 2).toUpperCase();
}

function readAuthRedirectError(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const url = new URL(window.location.href);
  const authError = url.searchParams.get("authError");

  if (!authError) {
    return null;
  }

  url.searchParams.delete("authError");
  window.history.replaceState({}, "", url.toString());

  if (authError === "google_sign_in_failed") {
    return "Google sign-in failed. Use the Google account attached to your intake workspace.";
  }

  return "Authentication failed. Please try again.";
}
