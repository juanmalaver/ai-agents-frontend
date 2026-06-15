"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import {
  AuthUser,
  getChallenge,
  getCurrentUser,
  getGoogleStartUrl,
  loginWithOtp,
  loginWithPassword,
  logout,
} from "@/src/utils/auth/authApi";

const IS_GOOGLE_SIGN_IN_ENABLED =
  process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true";

type AuthState =
  | "checking"
  | "authenticated"
  | "login"
  | "otp"
  | "forbidden";

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const loadSession = useCallback(async () => {
    setAuthState("checking");
    setError(null);

    try {
      const response = await getCurrentUser();

      setUser(response.user);
      setAuthState("authenticated");
    } catch (sessionError) {
      try {
        const challenge = await getChallenge();

        if (challenge.requiresOtp) {
          setAuthState("otp");
          return;
        }
      } catch {
        // Keep the primary session error as the useful state signal.
      }

      setUser(null);
      setAuthState(
        sessionError instanceof Error &&
          sessionError.message.toLowerCase().includes("forbidden")
          ? "forbidden"
          : "login",
      );
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await loginWithPassword({ email, password });

      if (response.status === "otp_required") {
        setPassword("");
        setAuthState("otp");
        return;
      }

      setUser(response.user);
      setPassword("");
      setAuthState("authenticated");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Login failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await loginWithOtp({ otp });

      setUser(response.user);
      setOtp("");
      setAuthState("authenticated");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Verification failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
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
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-950">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-700 shadow-sm">
          Checking access...
        </div>
      </main>
    );
  }

  if (authState === "authenticated") {
    return (
      <>
        <div className="border-b border-slate-200 bg-white px-4 py-2 text-slate-700 md:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 text-sm">
            <span className="truncate">
              {formatUserLabel(user)}
            </span>
            <button
              className="rounded-md border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              onClick={() => void handleLogout()}
              type="button"
            >
              Sign out
            </button>
          </div>
        </div>
        {children}
      </>
    );
  }

  if (authState === "otp") {
    return (
      <AuthLayout
        error={error}
        subtitle="Use the same verification code you use for intake."
        title="Two-factor verification"
      >
        <form className="grid gap-4" onSubmit={handleOtpSubmit}>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Verification code
            <input
              autoComplete="one-time-code"
              className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-950 outline-none focus:border-slate-900"
              inputMode="numeric"
              onChange={(event) => setOtp(event.target.value)}
              required
              value={otp}
            />
          </label>
          <button
            className="rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            Verify
          </button>
          <button
            className="text-sm font-semibold text-slate-600 hover:text-slate-950"
            onClick={() => setAuthState("login")}
            type="button"
          >
            Back to login
          </button>
        </form>
      </AuthLayout>
    );
  }

  if (authState === "forbidden") {
    return (
      <AuthLayout
        error="Your intake account does not have access to this workspace."
        subtitle="Use an intake account that belongs to the configured workspace."
        title="Access unavailable"
      >
        <button
          className="rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          onClick={() => void loadSession()}
          type="button"
        >
          Try again
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      error={error}
      subtitle="Use your intake account to access this dashboard."
      title="Sign in"
    >
      <form className="grid gap-4" onSubmit={handlePasswordSubmit}>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Email
          <input
            autoComplete="email"
            className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-950 outline-none focus:border-slate-900"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Password
          <input
            autoComplete="current-password"
            className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-950 outline-none focus:border-slate-900"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <button
          className="rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          Sign in
        </button>
      </form>
      {IS_GOOGLE_SIGN_IN_ENABLED ? (
        <>
          <div className="my-5 h-px bg-slate-200" />
          <button
            className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            onClick={() => {
              window.location.href = getGoogleStartUrl();
            }}
            type="button"
          >
            Continue with Google
          </button>
        </>
      ) : null}
    </AuthLayout>
  );
}

function AuthLayout({
  children,
  error,
  subtitle,
  title,
}: {
  children: ReactNode;
  error: string | null;
  subtitle: string;
  title: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8 text-slate-950">
      <section className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</p>
        {error ? (
          <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}
        <div className="mt-5">{children}</div>
      </section>
    </main>
  );
}

function formatUserLabel(user: AuthUser | null): string {
  if (!user) {
    return "Signed in with intake";
  }

  const fullName = [user.firstName, user.lastName]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");

  return fullName ? `${fullName} (${user.email})` : user.email;
}
