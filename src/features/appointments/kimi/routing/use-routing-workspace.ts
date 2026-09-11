"use client";

import { useCallback, useEffect, useState } from "react";
import type { RoutingWorkspacePayload } from "@/lib/appointments/routing/routing-workspace";
import type { StaffRoutingConfig } from "@/lib/appointments/types";
import type { RoutingSimulateResult } from "@/lib/appointments/routing/routing-simulator";

export function useRoutingWorkspace() {
  const [data, setData] = useState<RoutingWorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulateResult, setSimulateResult] = useState<RoutingSimulateResult | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/appointments/routing/workspace");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load routing");
      setData(json.data as RoutingWorkspacePayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveWorkspaceRouting = useCallback(
    async (patch: { staffRouting: StaffRoutingConfig; workspaceStaffPriorityOrder?: string[] }) => {
      setSaving(true);
      setError("");
      try {
        const res = await fetch("/api/appointments/routing/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Save failed");
        await reload();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [reload],
  );

  const updateServiceRouting = useCallback(
    async (body: Record<string, unknown>) => {
      setSaving(true);
      try {
        const res = await fetch("/api/appointments/routing/service", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Update failed");
        await reload();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [reload],
  );

  const runSimulate = useCallback(async (input: Record<string, unknown>) => {
    setSimulating(true);
    setSimulateResult(null);
    try {
      const res = await fetch("/api/appointments/routing/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Simulation failed");
      setSimulateResult(json.data as RoutingSimulateResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setSimulating(false);
    }
  }, []);

  return {
    data,
    loading,
    error,
    saving,
    simulating,
    simulateResult,
    reload,
    saveWorkspaceRouting,
    updateServiceRouting,
    runSimulate,
  };
}
