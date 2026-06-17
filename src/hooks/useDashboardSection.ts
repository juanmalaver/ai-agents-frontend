"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  DashboardSectionCacheMetadata,
  DashboardSectionResponse,
} from "@/src/types/dashboard";

interface UseDashboardSectionOptions<TResponse, TData> {
  errorMessage: string;
  mockData: TData;
  mockGeneratedAt?: string | null;
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
  mockData,
  mockGeneratedAt = null,
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
    const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true";

    if (useMock) {
      setState({
        cache: null,
        data: mockData,
        error: null,
        generatedAt: mockGeneratedAt,
        isLoading: false,
        isRefreshing: false,
      });
      return;
    }

    if (!url) {
      setState((current) => ({
        ...current,
        error:
          "Dashboard API URL is not configured. Set NEXT_PUBLIC_USE_MOCK=true to use mock data.",
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
          credentials: "include",
          signal: controller.signal,
        });

        if (!apiResponse.ok) {
          throw new Error(errorMessage);
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
    mockData,
    mockGeneratedAt,
    normalize,
    reloadKey,
    url,
  ]);

  return {
    ...state,
    retry,
  };
}
