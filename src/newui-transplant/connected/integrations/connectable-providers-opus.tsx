"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CONNECTABLE_CATEGORY_ORDER,
  CONNECTABLE_PROVIDERS,
  type ConnectableProviderCard,
} from "@/lib/integrations/connectable-providers";
import { Panel, Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";

type Conn = { provider: string; status: string; lastSyncAt: string | null };

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "connected") return "success";
  if (status === "needs_reauth" || status === "error") return "danger";
  if (status === "syncing" || status === "pending_oauth") return "warning";
  return "neutral";
}

function statusLabel(status: string) {
  if (status === "connected") return "Connected";
  if (status === "syncing") return "Syncing";
  if (status === "needs_reauth") return "Needs reauthentication";
  if (status === "pending_oauth") return "Pending";
  if (status === "error") return "Error";
  return "Disconnected";
}

export function ConnectableProvidersOpus({
  title = "Connect your apps",
  description = "CRM, scheduling, commerce, and marketing integrations.",
}: {
  title?: string;
  description?: string;
}) {
  const [connections, setConnections] = useState<Conn[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/integrations/connections")
      .then((r) => r.json())
      .then((j) => setConnections(j.data?.connections || []))
      .catch(() => undefined);
  }, []);

  const byProvider = useMemo(() => {
    const map = new Map<string, Conn>();
    for (const c of connections) map.set(c.provider, c);
    return map;
  }, [connections]);

  const grouped = useMemo(() => {
    const map = new Map<string, ConnectableProviderCard[]>();
    for (const cat of CONNECTABLE_CATEGORY_ORDER) map.set(cat, []);
    for (const p of CONNECTABLE_PROVIDERS) {
      const list = map.get(p.category) || [];
      list.push(p);
      map.set(p.category, list);
    }
    return map;
  }, []);

  async function connectOAuth(p: ConnectableProviderCard) {
    setBusy(p.id);
    setMessage(null);
    try {
      const endpoint = p.framework === "crm" ? "/api/crm/oauth/start" : "/api/integrations/native";
      const body =
        p.framework === "crm"
          ? { provider: p.id }
          : { provider: p.id, action: "oauth_start" };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not start OAuth");
      window.location.href = json.data.redirectUrl;
    } catch (e) {
      setMessage({
        text: e instanceof Error ? e.message : "Connect failed",
        error: true,
      });
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {message ? (
        <p className={`text-sm ${message.error ? "text-destructive" : "text-muted-foreground"}`} role="status">
          {message.text}
        </p>
      ) : null}
      {CONNECTABLE_CATEGORY_ORDER.map((cat) => {
        const list = grouped.get(cat) || [];
        if (!list.length) return null;
        return (
          <Panel key={cat} title={cat}>
            <ul className="divide-y">
              {list.map((p) => {
                const status = byProvider.get(p.id)?.status || "disconnected";
                const lastSync = byProvider.get(p.id)?.lastSyncAt;
                return (
                  <li key={p.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.authKind === "oauth" ? "OAuth" : "API credentials"}
                        {lastSync ? ` · Last sync ${new Date(lastSync).toLocaleString()}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={statusTone(status)}>{statusLabel(status)}</Pill>
                      <Button type="button" variant="outline" size="sm" asChild>
                        <Link href={p.href}>{p.authKind === "credentials" ? "Enter credentials" : "Open"}</Link>
                      </Button>
                      {p.authKind === "oauth" && status !== "connected" && status !== "syncing" ? (
                        <Button type="button" size="sm" disabled={busy === p.id} onClick={() => void connectOAuth(p)}>
                          {busy === p.id ? "Starting…" : status === "needs_reauth" ? "Reconnect" : "Connect"}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        );
      })}
    </div>
  );
}
