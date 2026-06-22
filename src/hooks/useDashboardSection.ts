"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  DashboardSectionCacheMetadata,
  DashboardSectionResponse,
} from "@/src/types/dashboard";

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

export function useDashboardSection<TResponse, TData = TResponse>({
  errorMessage,
  normalize,
  url,
}: UseDashboardSectionOptions<TResponse, TData>): DashboardSectionState<TData> {
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<
    Omit<DashboardSectionState<TData>, "retry">
  >({
    cache: null,
    data: null,
    error: null,
    generatedAt: null,
    isLoading: true,
    isRefreshing: false,
  });

  const retry = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!url) {
      setState((current) => ({
        ...current,
        error: "Dashboard API URL is not configured.",
        isLoading: false,
        isRefreshing: false,
      }));
      return;
    }

    const controller = new AbortController();
    let staleRefreshTimer: number | null = null;

    setState((current) => ({
      ...current,
      error: null,
      isLoading: !current.data,
      isRefreshing: Boolean(current.data),
    }));

    async function loadSection() {
      try {
        const apiResponse = await fetch(url as string, {
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
        });

        if (response.cache.status === "stale") {
          staleRefreshTimer = window.setTimeout(() => {
            setReloadKey((current) => current + 1);
          }, 5000);
        }
      } catch (caughtError) {
        if (controller.signal.aborted) {
          return;
        }

        setState((current) => ({
          ...current,
          error:
            caughtError instanceof Error ? caughtError.message : errorMessage,
          isLoading: false,
          isRefreshing: false,
        }));
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
    normalize,
    reloadKey,
    url,
  ]);

  return {
    ...state,
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
