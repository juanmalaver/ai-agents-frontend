"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDashboardHardRefresh } from "@/src/components/dashboard/DashboardHardRefresh";
import type {
  DashboardSectionCacheMetadata,
  DashboardSectionResponse,
} from "@/src/types/dashboard";
import { appendHardRefreshQueryParam } from "@/src/utils/runtimeApiUrls";

interface UseDashboardSectionOptions<TResponse, TData> {
  errorMessage: string;
  normalize?: (data: TResponse) => TData;
  url?: string;
}

export interface DashboardSectionState<TData> {
  cache: DashboardSectionCacheMetadata | null;
  data: TData | null;
  error: string | null;
  generatedAt: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  retry: () => void;
}

const STALE_SECTION_REFRESH_RETRY_MS = 60_000;

interface DashboardSectionInternalState<TData>
  extends Omit<DashboardSectionState<TData>, "retry"> {
  sourceUrl: string | null;
}

export function useDashboardSection<TResponse, TData = TResponse>({
  errorMessage,
  normalize,
  url,
}: UseDashboardSectionOptions<TResponse, TData>): DashboardSectionState<TData> {
  const { hardRefreshToken, trackHardRefresh } = useDashboardHardRefresh();
  const observedHardRefreshTokenRef = useRef(hardRefreshToken);
  const pendingHardRefreshTokenRef = useRef(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [hardRefreshReloadKey, setHardRefreshReloadKey] = useState(0);
  const [state, setState] = useState<DashboardSectionInternalState<TData>>({
    cache: null,
    data: null,
    error: null,
    generatedAt: null,
    isLoading: true,
    isRefreshing: false,
    sourceUrl: null,
  });

  const retry = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (
      hardRefreshToken > 0 &&
      hardRefreshToken !== observedHardRefreshTokenRef.current
    ) {
      pendingHardRefreshTokenRef.current = hardRefreshToken;
      observedHardRefreshTokenRef.current = hardRefreshToken;
      setHardRefreshReloadKey((current) => current + 1);
      return;
    }

    observedHardRefreshTokenRef.current = hardRefreshToken;
  }, [hardRefreshToken]);

  useEffect(() => {
    if (!url) {
      setState((current) => ({
        ...current,
        error: "Dashboard API URL is not configured.",
        isLoading: false,
        isRefreshing: false,
        sourceUrl: null,
      }));
      return;
    }

    const controller = new AbortController();
    let staleRefreshTimer: number | null = null;
    const forceRefreshToken = pendingHardRefreshTokenRef.current;
    const requestUrl = forceRefreshToken
      ? appendHardRefreshQueryParam(url)
      : url;
    const completeHardRefresh = forceRefreshToken
      ? trackHardRefresh(forceRefreshToken)
      : () => undefined;

    pendingHardRefreshTokenRef.current = 0;

    setState((current) => ({
      ...current,
      error: null,
      isLoading: !current.data,
      isRefreshing:
        Boolean(forceRefreshToken) ||
        (Boolean(current.data) &&
          (current.sourceUrl === url ? current.isRefreshing : true)),
    }));

    async function loadSection() {
      try {
        const apiResponse = await fetch(requestUrl as string, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });

        if (!apiResponse.ok) {
          throw new Error(await buildDashboardFetchError(apiResponse, errorMessage));
        }

        const response =
          (await apiResponse.json()) as DashboardSectionResponse<TResponse>;
        const normalizedData = normalize
          ? normalize(response.data)
          : (response.data as unknown as TData);

        if (controller.signal.aborted) {
          return;
        }

        setState({
          cache: response.cache,
          data: normalizedData,
          error: null,
          generatedAt: response.generatedAt,
          isLoading: false,
          isRefreshing: response.cache.status === "stale",
          sourceUrl: url as string,
        });

        if (response.cache.status === "stale") {
          staleRefreshTimer = window.setTimeout(() => {
            setReloadKey((current) => current + 1);
          }, STALE_SECTION_REFRESH_RETRY_MS);
        }
      } catch (caughtError) {
        if (controller.signal.aborted) {
          return;
        }

        setState((current) => ({
          ...current,
          error:
            current.data && !isAuthenticationError(caughtError)
              ? null
              : caughtError instanceof Error
                ? caughtError.message
                : errorMessage,
          isLoading: false,
          isRefreshing: false,
        }));
      } finally {
        completeHardRefresh();
      }
    }

    void loadSection();

    return () => {
      controller.abort();

      if (staleRefreshTimer != null) {
        window.clearTimeout(staleRefreshTimer);
      }
    };
  }, [
    errorMessage,
    hardRefreshReloadKey,
    normalize,
    reloadKey,
    trackHardRefresh,
    url,
  ]);

  return {
    cache: state.cache,
    data: state.data,
    error: state.error,
    generatedAt: state.generatedAt,
    isLoading: state.isLoading,
    isRefreshing: state.isRefreshing,
    retry,
  };
}

async function buildDashboardFetchError(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  const responseMessage = await readResponseMessage(response);

  if (response.status === 401) {
    return "Authentication expired. Sign out and sign in again.";
  }

  if (responseMessage) {
    return responseMessage;
  }

  return `${fallbackMessage} (${response.status})`;
}

function isAuthenticationError(caughtError: unknown): boolean {
  return (
    caughtError instanceof Error &&
    caughtError.message.toLowerCase().includes("authentication expired")
  );
}

async function readResponseMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as unknown;

    if (
      typeof body === "object" &&
      body !== null &&
      "message" in body
    ) {
      const { message } = body as { message?: unknown };

      if (Array.isArray(message)) {
        return message.filter((item) => typeof item === "string").join(" ");
      }

      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }
  } catch {
    return null;
  }

  return null;
}
