"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";
import {
  CONNECTABLE_CATEGORY_ORDER,
  CONNECTABLE_PROVIDERS,
  type ConnectableProviderCard,
} from "@/lib/integrations/connectable-providers";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Conn = { provider: string; status: string; lastSyncAt: string | null };

function statusLabel(status: string) {
  if (status === "connected") return "Connected";
  if (status === "syncing") return "Syncing";
  if (status === "needs_reauth") return "Needs Reauthentication";
  if (status === "pending_oauth") return "Pending";
  if (status === "error") return "Error";
  return "Disconnected";
}

export function ConnectableProvidersGrid({
  title = "Connect your apps",
  description = "Connect each provider before running acceptance tests. Mailchimp is deferred for this pass.",
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
      const endpoint =
        p.framework === "crm" ? "/api/crm/oauth/start" : "/api/integrations/native";
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
    <div className="space-y-6">
      <div>
        <h2 className="text-[16px] font-bold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Showing {CONNECTABLE_PROVIDERS.length} providers · Mailchimp hidden
        </p>
      </div>

      {message ? (
        <p className={`text-sm ${message.error ? "text-red-600" : "text-emerald-700"}`}>
          {message.text}
        </p>
      ) : null}

      {CONNECTABLE_CATEGORY_ORDER.map((cat) => {
        const list = grouped.get(cat) || [];
        if (!list.length) return null;
        return (
          <section key={cat}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {cat}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((p) => {
                const status = byProvider.get(p.id)?.status || "disconnected";
                const lastSync = byProvider.get(p.id)?.lastSyncAt;
                return (
                  <Card key={p.id} className="flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <StatusChip status={statusLabel(status)} />
                    </div>
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.authKind === "oauth" ? "OAuth" : "API credentials"}
                      {lastSync ? ` · Last sync ${new Date(lastSync).toLocaleString()}` : ""}
                    </p>
                    <div className="mt-auto flex flex-wrap gap-2">
                      <Link
                        href={p.href}
                        className="inline-flex h-8 items-center rounded-lg bg-muted px-3 text-xs font-medium"
                      >
                        {p.authKind === "credentials" ? "Enter credentials" : "Open"}
                      </Link>
                      {p.authKind === "oauth" && status !== "connected" && status !== "syncing" ? (
                        <Button
                          size="sm"
                          disabled={busy === p.id}
                          onClick={() => void connectOAuth(p)}
                        >
                          {busy === p.id ? "Starting…" : status === "needs_reauth" ? "Reconnect" : "Connect"}
                        </Button>
                      ) : null}
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
