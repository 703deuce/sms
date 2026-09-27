"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ConnectableProvidersOpus } from "@/newui-transplant/connected/integrations/connectable-providers-opus";
import { Panel, Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";

type ProviderCard = {
  id: string;
  name: string;
  envConfigured: boolean;
  oauthReady?: boolean;
  missingEnv?: string[];
  callbackUrl?: string;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
  lastRunStatus: string | null;
};

function statusLabel(status: string) {
  if (status === "connected") return "Connected";
  if (status === "syncing") return "Syncing";
  if (status === "needs_reauth") return "Needs reauthentication";
  if (status === "pending_oauth") return "Pending";
  if (status === "error") return "Error";
  return "Disconnected";
}

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "connected") return "success";
  if (status === "needs_reauth" || status === "error") return "danger";
  if (status === "syncing") return "warning";
  return "neutral";
}

export function CrmIntegrationsOpus() {
  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    return fetch("/api/crm/providers")
      .then((r) => r.json())
      .then((j) => setProviders(j.data || []))
      .catch(() => undefined);
  }

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    const err = params.get("connected_error");
    if (err) setMessage({ text: err, error: true });
  }, []);

  async function connect(provider: string) {
    setBusy(provider);
    setMessage(null);
    try {
      const res = await fetch("/api/crm/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't start CRM connection");
      window.location.href = json.data.redirectUrl;
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Connect failed", error: true });
      setBusy(null);
    }
  }

  async function syncNow(provider: string) {
    setBusy(`sync-${provider}`);
    try {
      const res = await fetch("/api/crm/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, kind: "manual" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Sync failed");
      setMessage({ text: `Sync queued for ${provider}` });
      await load();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Sync failed", error: true });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p className={`text-sm ${message.error ? "text-destructive" : "text-muted-foreground"}`} role="status">
          {message.text}
        </p>
      ) : null}

      <Panel title="CRM providers" description="Salesforce, Zoho CRM / Bigin, and Pipedrive OAuth sync.">
        <ul className="divide-y">
          {providers.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.envConfigured
                    ? p.oauthReady
                      ? "OAuth credentials configured"
                      : `Missing: ${(p.missingEnv || []).join(", ") || "APP_URL / INTEGRATION_SECRET_KEY"}`
                    : "Set client ID/secret env vars on the web service"}
                </p>
                {p.callbackUrl ? (
                  <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">Callback: {p.callbackUrl}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  Last sync: {p.lastSyncAt ? new Date(p.lastSyncAt).toLocaleString() : "Never"}
                  {p.lastRunStatus ? ` · ${p.lastRunStatus}` : ""}
                </p>
                {p.lastError ? <p className="mt-1 text-xs text-destructive line-clamp-2">{p.lastError}</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={statusTone(p.status)}>{statusLabel(p.status)}</Pill>
                {p.status === "connected" || p.status === "syncing" ? (
                  <>
                    <Button type="button" size="sm" variant="outline" disabled={busy === `sync-${p.id}`} onClick={() => void syncNow(p.id)}>
                      Sync now
                    </Button>
                    <Button type="button" size="sm" variant="outline" asChild>
                      <Link href={`/integrations/crm/${p.id}`}>Settings</Link>
                    </Button>
                  </>
                ) : (
                  <Button type="button" size="sm" disabled={!p.envConfigured || busy === p.id} onClick={() => void connect(p.id)}>
                    {p.status === "needs_reauth" ? "Reconnect" : "Connect"}
                  </Button>
                )}
                <Button type="button" size="sm" variant="ghost" asChild>
                  <Link href={`/integrations/crm/${p.id}?tab=diagnostics`}>Diagnostics</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <ConnectableProvidersOpus
        title="All connectable apps"
        description="Calendly, Typeform, Jotform, ActiveCampaign, Klaviyo, Close, HighLevel, WooCommerce, and Freshdesk."
      />
    </div>
  );
}
