"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { INTEGRATIONS_DIRECTORY_PROVIDERS } from "@/app/(app)/integrations/integrations-directory";
import { Panel, Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { Input } from "@/newui-transplant/components/ui/input";
import { Label } from "@/newui-transplant/components/ui/label";

type Connection = {
  provider: string;
  status: string;
  lastSyncAt: string | null;
  config: Record<string, unknown>;
};

export function IntegrationsDirectoryOpus({
  connectedApi,
  connectedWebhooks,
  endpointsCount,
}: {
  connectedApi: boolean;
  connectedWebhooks: boolean;
  endpointsCount: number;
}) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const connByProvider = useMemo(() => {
    const map: Record<string, Connection> = {};
    for (const c of connections) map[c.provider] = c;
    return map;
  }, [connections]);

  function loadConnections() {
    return fetch("/api/integrations/connections")
      .then((r) => r.json())
      .then((json) => {
        const conns: Connection[] = json.data?.connections || [];
        setConnections(conns);
        const stripeConn = conns.find((c) => c.provider === "stripe");
        setStripeConnected(Boolean(json.data?.stripeEnvConfigured) || stripeConn?.status === "connected");
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    loadConnections();
  }, []);

  function isConnected(p: { id: string }) {
    if (p.id === "api") return connectedApi;
    if (p.id === "webhooks") return connectedWebhooks;
    if (p.id === "zapier") return endpointsCount > 0;
    if (p.id === "stripe") return stripeConnected;
    return connByProvider[p.id]?.status === "connected";
  }

  async function connectOAuth(provider: string) {
    setBusy(provider);
    try {
      const res = await fetch("/api/integrations/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, action: "oauth" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "OAuth failed");
      window.location.assign(json.data.redirectUrl);
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "OAuth failed", error: true });
      setBusy(null);
    }
  }

  async function saveConfig(provider: string, fields: { key: string; label: string }[]) {
    setBusy(provider);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, action: "connect", config: form }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setMessage({ text: "Connected." });
      setForm({});
      setOpenId(null);
      await loadConnections();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Save failed", error: true });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel title="Integration directory" description="Developer, billing, CRM, and native app connections.">
      {message ? (
        <p className={`mb-3 text-sm ${message.error ? "text-destructive" : "text-muted-foreground"}`} role="status">
          {message.text}
        </p>
      ) : null}
      <ul className="divide-y">
        {INTEGRATIONS_DIRECTORY_PROVIDERS.map((p) => {
          const connected = isConnected(p);
          const open = openId === p.id;
          return (
            <li key={p.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={connected ? "success" : "neutral"}>{connected ? "Connected" : "Not connected"}</Pill>
                  {p.kind === "link" && p.href ? (
                    <Button type="button" size="sm" variant="outline" asChild>
                      <Link href={p.href}>{connected ? "Manage" : "Configure"}</Link>
                    </Button>
                  ) : null}
                  {p.kind === "oauth" ? (
                    <Button type="button" size="sm" disabled={busy === p.id} onClick={() => void connectOAuth(p.id)}>
                      {connected ? "Reconnect" : "Connect"}
                    </Button>
                  ) : null}
                  {p.kind === "apikey" ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setOpenId(open ? null : p.id)}>
                      {open ? "Close" : "Configure"}
                    </Button>
                  ) : null}
                </div>
              </div>
              {open && p.fields?.length ? (
                <div className="mt-3 space-y-3 rounded-lg border bg-muted/20 p-4">
                  {p.fields.map((f) => (
                    <div key={f.key} className="space-y-1.5">
                      <Label htmlFor={`${p.id}-${f.key}`}>{f.label}</Label>
                      <Input
                        id={`${p.id}-${f.key}`}
                        type={f.type || "text"}
                        value={form[f.key] || ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <Button type="button" size="sm" disabled={busy === p.id} onClick={() => void saveConfig(p.id, p.fields || [])}>
                    Save connection
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
