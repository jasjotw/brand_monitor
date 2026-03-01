"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { clearAuthToken, getAuthToken } from "@/lib/auth";

type SectionName =
  | "dashboard"
  | "overview"
  | "visibility"
  | "competitors"
  | "prompts"
  | "alerts"
  | "sources"
  | "diagnostics";

export interface ApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

async function requestSection<T>(section: SectionName): Promise<T> {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Authentication required");
  }

  const baseUrl = process.env.NEXT_PUBLIC_BRAND_MONITOR_URL || "http://localhost:4001";
  const response = await fetch(`${baseUrl}/api/brand-monitor/analytics/${section}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await response.json().catch(() => ({}));
  if (response.status === 401) {
    clearAuthToken();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Session expired");
  }
  if (!response.ok) {
    const message =
      json?.error?.message ||
      json?.error ||
      `Failed to load ${section} analytics`;
    throw new Error(message);
  }
  return json as T;
}

export function useAnalyticsSection<T>(section: SectionName): ApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await requestSection<T>(section);
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to load ${section} analytics`;
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return useMemo(
    () => ({
      data,
      loading,
      error,
      refresh: fetchData,
    }),
    [data, loading, error, fetchData],
  );
}
