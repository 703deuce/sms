"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClientDetailPayload, ClientDirectoryRow } from "@/lib/appointments/clients/clients-workspace";

export function useClientsWorkspace() {
  const [data, setData] = useState<{
    directory: ClientDirectoryRow[];
    summary: { totalClients: number; active: number; upcomingBookings: number; openBalances: number; needsForms: number };
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/appointments/clients/workspace?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Load failed");
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload, q, setQ };
}

export function useClientDetail(clientId: string | null) {
  const [data, setData] = useState<ClientDetailPayload | null>(null);
  const [loading, setLoading] = useState(Boolean(clientId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/clients/${encodeURIComponent(clientId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Load failed");
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      if (!clientId) throw new Error("No client");
      const res = await fetch(`/api/appointments/clients/${encodeURIComponent(clientId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setData(json.data);
      return json.data as ClientDetailPayload;
    },
    [clientId],
  );

  return { data, loading, error, reload, patch };
}
