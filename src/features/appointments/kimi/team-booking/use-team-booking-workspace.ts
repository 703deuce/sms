"use client";

import { useCallback, useEffect, useState } from "react";

export function useTeamBookingWorkspace() {
  const [data, setData] = useState<Awaited<
    ReturnType<typeof import("@/lib/appointments/team-booking/team-booking-workspace").buildTeamBookingWorkspace>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<unknown>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/appointments/team-booking/workspace");
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

  const runSimulate = useCallback(async (body: Record<string, unknown>) => {
    setSimulating(true);
    setSimResult(null);
    try {
      const res = await fetch("/api/appointments/team-booking/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Simulation failed");
      setSimResult(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setSimulating(false);
    }
  }, []);

  return { data, loading, error, simulating, simResult, reload, runSimulate };
}
