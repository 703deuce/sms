"use client";

import { useCallback, useEffect, useState } from "react";

export type PosSession = {
  id: string;
  status: string;
  subtotalCents: number;
  totalCents: number;
  contactId?: string | null;
  lineItems: Array<{
    id: string;
    description: string;
    quantity: number;
    totalCents: number;
    kind: string;
    referenceId?: string | null;
  }>;
};

export function usePosWorkspace() {
  const [workspace, setWorkspace] = useState<Awaited<
    ReturnType<typeof import("@/lib/appointments/pos/pos-workspace").buildPosWorkspace>
  > | null>(null);
  const [sessions, setSessions] = useState<PosSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [wsRes, cartRes] = await Promise.all([
        fetch("/api/appointments/point-of-sale/workspace"),
        fetch("/api/appointments/service-booking/pos-cart"),
      ]);
      const wsJson = await wsRes.json();
      const cartJson = await cartRes.json();
      if (!wsRes.ok) throw new Error(wsJson.error || "Failed to load POS");
      if (!cartRes.ok) throw new Error(cartJson.error || "Failed to load cart");
      setWorkspace(wsJson.data);
      const list = (cartJson.data || []) as PosSession[];
      setSessions(list);
      setActiveId((cur) => cur ?? list[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const active = sessions.find((s) => s.id === activeId) || null;

  const api = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError("");
      try {
        const res = await fetch("/api/appointments/service-booking/pos-cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Request failed");
        await reload();
        return json.data;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Request failed");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  return {
    workspace,
    sessions,
    active,
    activeId,
    setActiveId,
    loading,
    busy,
    error,
    setError,
    reload,
    api,
  };
}
