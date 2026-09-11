"use client";

import { useCallback, useEffect, useState } from "react";

export type PortalWorkspace = {
  business: { id: string; name: string; slug: string; logoUrl: string | null; accentColor: string };
  profile: {
    id: string;
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string;
    timezone: string | null;
  };
  nextAppointment: null | Record<string, unknown>;
  tasks: Array<{ id: string; label: string; detail: string; href: string; kind: string }>;
  appointments: { upcoming: unknown[]; past: unknown[]; cancelled: unknown[] };
  forms: unknown[];
  packages: unknown[];
  memberships: unknown[];
  payments: {
    outstandingCents: number;
    walletCreditCents: number;
    transactions: Array<{ id: string; at: string; amountCents: number; status: string }>;
  };
  bookUrl: string;
  bookUrlWithContact: string;
};

export function useClientPortalSession() {
  const [data, setData] = useState<PortalWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/client/portal/auth/session", { credentials: "include" });
      if (res.status === 401) {
        setData(null);
        setError("unauthorized");
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Load failed");
      setData(json.data as PortalWorkspace);
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

  const logout = useCallback(async () => {
    await fetch("/api/client/portal/auth/session", { method: "DELETE", credentials: "include" });
    setData(null);
    setError("unauthorized");
  }, []);

  return { data, loading, error, reload, logout };
}
