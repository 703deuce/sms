"use client";

import { useCallback, useEffect, useState } from "react";
import type { LocationDetailPayload, LocationDirectoryRow } from "@/lib/appointments/locations/locations-workspace";

export function useLocationsWorkspace() {
  const [data, setData] = useState<{
    directory: LocationDirectoryRow[];
    summary: { total: number; active: number; physical: number; virtual: number; needsSetup: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments/locations/workspace");
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

  const filtered = data?.directory.filter((row) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return row.name.toLowerCase().includes(needle) || row.addressLabel.toLowerCase().includes(needle);
  });

  return { data, loading, error, reload, q, setQ, rows: filtered || [] };
}

export function useLocationDetail(locationId: string | null) {
  const [data, setData] = useState<LocationDetailPayload | null>(null);
  const [loading, setLoading] = useState(Boolean(locationId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/locations/${encodeURIComponent(locationId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Load failed");
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      if (!locationId) throw new Error("No location");
      const res = await fetch(`/api/appointments/locations/${encodeURIComponent(locationId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        const err = new Error(json.error || "Save failed") as Error & {
          code?: string;
          futureAppointmentCount?: number;
        };
        err.code = json.code;
        err.futureAppointmentCount = json.futureAppointmentCount;
        throw err;
      }
      setData(json.data);
      return json.data as LocationDetailPayload;
    },
    [locationId],
  );

  return { data, loading, error, reload, patch };
}
