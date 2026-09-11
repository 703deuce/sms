"use client";

import { useCallback, useEffect, useState } from "react";
import type { StaffDetailPayload, StaffDirectoryRow } from "@/lib/appointments/staff/staff-workspace";

export type StaffWorkspacePayload = {
  directory: StaffDirectoryRow[];
  summary: {
    activeStaff: number;
    bookable: number;
    needsSetup: number;
    calendarConnected: number;
    calendarTotal: number;
    locations: number;
  };
};

export function useStaffWorkspace() {
  const [data, setData] = useState<StaffWorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments/staff/workspace");
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

  return { data, loading, error, reload };
}

export function useStaffDetail(staffId: string | null) {
  const [data, setData] = useState<StaffDetailPayload | null>(null);
  const [loading, setLoading] = useState(Boolean(staffId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!staffId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/staff/${encodeURIComponent(staffId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Load failed");
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      if (!staffId) throw new Error("No staff");
      const res = await fetch(`/api/appointments/staff/${encodeURIComponent(staffId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        const err = new Error(json.error || "Save failed") as Error & { code?: string; futureAppointmentCount?: number };
        err.code = json.code;
        err.futureAppointmentCount = json.futureAppointmentCount;
        throw err;
      }
      setData(json.data);
      return json.data as StaffDetailPayload;
    },
    [staffId],
  );

  return { data, loading, error, reload, patch };
}
