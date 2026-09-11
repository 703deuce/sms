"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ResourceDetailPayload, ResourceDirectoryRow } from "@/lib/appointments/resources/resources-workspace";

export function useResourcesWorkspace() {
  const [data, setData] = useState<{
    directory: ResourceDirectoryRow[];
    summary: {
      total: number;
      active: number;
      pools: number;
      locations: number;
      servicesUsing: number;
      needsAttention: number;
    };
    locations: Array<{ id: string; name: string }>;
    types: Array<{ id: string; name: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments/resources/workspace");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Load failed");
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const rows = useMemo(() => {
    if (!data?.directory) return [];
    return data.directory.filter((row) => {
      if (typeFilter && row.typeLabel !== typeFilter) return false;
      if (statusFilter && row.status !== statusFilter) return false;
      if (!q.trim()) return true;
      const needle = q.toLowerCase();
      return (
        row.name.toLowerCase().includes(needle) ||
        row.typeLabel.toLowerCase().includes(needle) ||
        row.locationLabel.toLowerCase().includes(needle)
      );
    });
  }, [data, q, typeFilter, statusFilter]);

  const typeOptions = useMemo(() => {
    if (!data?.directory) return [];
    return [...new Set(data.directory.map((r) => r.typeLabel))].sort();
  }, [data]);

  return {
    data,
    loading,
    error,
    reload,
    q,
    setQ,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    typeOptions,
    rows,
  };
}

export function useResourceDetail(resourceId: string | null) {
  const [data, setData] = useState<ResourceDetailPayload | null>(null);
  const [loading, setLoading] = useState(Boolean(resourceId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!resourceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/resources/${encodeURIComponent(resourceId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Load failed");
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [resourceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      if (!resourceId) throw new Error("No resource");
      const res = await fetch(`/api/appointments/resources/${encodeURIComponent(resourceId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        const err = new Error(json.error || "Save failed") as Error & {
          code?: string;
          futureReservationCount?: number;
          peakUsage?: number;
        };
        err.code = json.code;
        err.futureReservationCount = json.futureReservationCount;
        err.peakUsage = json.peakUsage;
        throw err;
      }
      setData(json.data);
      return json.data as ResourceDetailPayload;
    },
    [resourceId],
  );

  const testAvailability = useCallback(
    async (input: { startsAt: string; endsAt: string; serviceId?: string }) => {
      if (!resourceId) throw new Error("No resource");
      const res = await fetch(
        `/api/appointments/resources/${encodeURIComponent(resourceId)}/test-availability`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Test failed");
      return json.data as {
        resourceName: string;
        serviceName: string | null;
        capacity: number;
        reserved: number;
        available: number;
        result: string;
      };
    },
    [resourceId],
  );

  return { data, loading, error, reload, patch, testAvailability };
}
