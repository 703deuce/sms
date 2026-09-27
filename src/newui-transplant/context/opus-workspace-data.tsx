"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { BusinessContext } from "@/newui-transplant/lib/view-models";
import { businessContextFromWorkspace } from "@/lib/newui-transplant/adapters/business-context";

type OpusWorkspaceData = {
  workspaceName: string;
  business: BusinessContext | null;
  loading: boolean;
};

const OpusWorkspaceContext = createContext<OpusWorkspaceData>({
  workspaceName: "Workspace",
  business: null,
  loading: true,
});

export function OpusWorkspaceDataProvider({
  workspaceName,
  children,
}: {
  workspaceName: string;
  children: ReactNode;
}) {
  const [business, setBusiness] = useState<BusinessContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/mctb/shell-context", { cache: "no-store" });
        const json = await res.json();
        const data = json.data ?? json;
        if (cancelled) return;
        setBusiness(
          businessContextFromWorkspace({
            name: data.workspaceName ?? workspaceName,
            businessLineE164: data.businessLineE164,
            senderE164: data.senderE164 ?? data.senderLabel,
            timezone: data.timezone,
            website: null,
          }),
        );
      } catch {
        if (!cancelled) {
          setBusiness(
            businessContextFromWorkspace({
              name: workspaceName,
            }),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceName]);

  const value = useMemo(
    () => ({ workspaceName, business, loading }),
    [workspaceName, business, loading],
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
