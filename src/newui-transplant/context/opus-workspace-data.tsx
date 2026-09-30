"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { BusinessContext } from "@/newui-transplant/lib/view-models";
import { businessContextFromWorkspace } from "@/lib/newui-transplant/adapters/business-context";
import type { MctbPlanUsagePresentation } from "@/lib/mctb/plan-display";

type OpusWorkspaceData = {
  workspaceName: string;
  business: BusinessContext | null;
  planUsage: MctbPlanUsagePresentation | null;
  planUsageLoading: boolean;
  loading: boolean;
  refreshPlanUsage: () => void;
};

const OpusWorkspaceContext = createContext<OpusWorkspaceData>({
  workspaceName: "Workspace",
  business: null,
  planUsage: null,
  planUsageLoading: true,
  loading: true,
  refreshPlanUsage: () => undefined,
});

export function OpusWorkspaceDataProvider({
  workspaceName,
  children,
}: {
  workspaceName: string;
  children: ReactNode;
}) {
  const [business, setBusiness] = useState<BusinessContext | null>(null);
  const [planUsage, setPlanUsage] = useState<MctbPlanUsagePresentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [planUsageLoading, setPlanUsageLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  const refreshPlanUsage = () => setRefreshToken((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setPlanUsageLoading(true);
      try {
        const res = await fetch("/api/mctb/shell-context", { cache: "no-store" });
        const json = await res.json();
        const data = json.data ?? json;
        if (cancelled) return;
        setBusiness(
          businessContextFromWorkspace({
            name: data.workspaceName ?? workspaceName,
            businessLineE164: data.businessLineE164,
            forwardingIngressE164: data.forwardingIngressE164,
            forwardingIngressState: data.forwardingIngressState,
            senderMode: data.senderMode,
            senderLabel: data.senderLabel,
            senderDetail: data.senderDetail,
            senderE164: data.senderE164,
            timezone: data.timezone,
            website: null,
          }),
        );
        setPlanUsage(data.planUsage ?? null);
      } catch {
        if (!cancelled) {
          setBusiness(
            businessContextFromWorkspace({
              name: workspaceName,
            }),
          );
          setPlanUsage(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setPlanUsageLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceName, refreshToken]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshPlanUsage();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const value = useMemo(
    () => ({
      workspaceName,
      business,
      planUsage,
      planUsageLoading,
      loading,
      refreshPlanUsage,
    }),
    [workspaceName, business, planUsage, planUsageLoading, loading],
  );

  return <OpusWorkspaceContext.Provider value={value}>{children}</OpusWorkspaceContext.Provider>;
}

export function useOpusWorkspaceData() {
  return useContext(OpusWorkspaceContext);
}

export function workspaceInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  return (name.trim().slice(0, 2) || "WS").toUpperCase();
}
