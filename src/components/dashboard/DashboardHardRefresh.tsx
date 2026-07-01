"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { LoadingSpinner } from "./LoadingSpinner";

const HARD_REFRESH_COOLDOWN_MS = 60_000;

interface DashboardHardRefreshContextValue {
  cooldownRemainingMs: number;
  hardRefreshToken: number;
  isHardRefreshing: boolean;
  requestHardRefresh: () => void;
  trackHardRefresh: (token: number) => () => void;
}

const DashboardHardRefreshContext =
  createContext<DashboardHardRefreshContextValue>({
    cooldownRemainingMs: 0,
    hardRefreshToken: 0,
    isHardRefreshing: false,
    requestHardRefresh: () => undefined,
    trackHardRefresh: () => () => undefined,
  });

export function DashboardHardRefreshProvider({
  children,
}: {
  children: ReactNode;
}) {
  const activeTokenRef = useRef(0);
  const pendingCountRef = useRef(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [hardRefreshToken, setHardRefreshToken] = useState(0);
  const [isHardRefreshing, setIsHardRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const cooldownRemainingMs = Math.max(0, cooldownUntil - now);

  useEffect(() => {
    if (cooldownRemainingMs <= 0) {
      return;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, [cooldownRemainingMs]);

  const requestHardRefresh = useCallback(() => {
    const requestedAt = Date.now();

    if (isHardRefreshing || cooldownUntil > requestedAt) {
      return;
    }

    pendingCountRef.current = 0;
    activeTokenRef.current = requestedAt;
    setHardRefreshToken(requestedAt);
    setIsHardRefreshing(true);
    setCooldownUntil(requestedAt + HARD_REFRESH_COOLDOWN_MS);
    setNow(requestedAt);

    window.setTimeout(() => {
      if (
        activeTokenRef.current === requestedAt &&
        pendingCountRef.current === 0
      ) {
        setIsHardRefreshing(false);
      }
    }, 750);
  }, [cooldownUntil, isHardRefreshing]);

  const trackHardRefresh = useCallback((token: number) => {
    if (!token || token !== activeTokenRef.current) {
      return () => undefined;
    }

    let isDone = false;

    pendingCountRef.current += 1;
    setIsHardRefreshing(true);

    return () => {
      if (isDone) {
        return;
      }

      isDone = true;

      if (token !== activeTokenRef.current) {
        return;
      }

      pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);

      if (pendingCountRef.current === 0) {
        setIsHardRefreshing(false);
      }
    };
  }, []);

  const value = useMemo(
    () => ({
      cooldownRemainingMs,
      hardRefreshToken,
      isHardRefreshing,
      requestHardRefresh,
      trackHardRefresh,
    }),
    [
      cooldownRemainingMs,
      hardRefreshToken,
      isHardRefreshing,
      requestHardRefresh,
      trackHardRefresh,
    ],
  );

  return (
    <DashboardHardRefreshContext.Provider value={value}>
      {children}
    </DashboardHardRefreshContext.Provider>
  );
}

export function useDashboardHardRefresh(): DashboardHardRefreshContextValue {
  return useContext(DashboardHardRefreshContext);
}

export function DashboardHardRefreshButton() {
  const pathname = usePathname();
  const {
    cooldownRemainingMs,
    isHardRefreshing,
    requestHardRefresh,
  } = useDashboardHardRefresh();
  const isMarketingDashboard = pathname?.startsWith("/marketing-dashboard");

  if (!isMarketingDashboard) {
    return null;
  }

  const cooldownSeconds = Math.ceil(cooldownRemainingMs / 1000);
  const isCoolingDown = cooldownSeconds > 0;
  const isDisabled = isHardRefreshing || isCoolingDown;
  const label = isHardRefreshing
    ? "Refreshing"
    : isCoolingDown
      ? `Refresh in ${cooldownSeconds}s`
      : "Refresh data";
  const title = isCoolingDown
    ? `Refresh available in ${cooldownSeconds} seconds to protect Meta and TikTok request limits.`
    : "Hard refresh dashboard data from Meta and TikTok.";

  return (
    <button
      aria-busy={isHardRefreshing}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--color-control-border)] bg-[var(--color-control-bg)] px-2.5 text-xs font-semibold text-[var(--color-control-text)] shadow-sm transition hover:bg-[var(--color-control-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-65"
      disabled={isDisabled}
      onClick={requestHardRefresh}
      title={title}
      type="button"
    >
      {isHardRefreshing ? (
        <LoadingSpinner
          className="h-3.5 w-3.5 text-teal-600"
          label="Hard refreshing dashboard data"
        />
      ) : (
        <RefreshIcon />
      )}
      <span>{label}</span>
    </button>
  );
}

function RefreshIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M21 12a9 9 0 0 1-15.3 6.4" />
      <path d="M3 12A9 9 0 0 1 18.3 5.6" />
      <path d="M18 3v4h-4" />
      <path d="M6 21v-4h4" />
    </svg>
  );
}
