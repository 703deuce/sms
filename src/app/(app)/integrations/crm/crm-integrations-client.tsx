"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import Link from "next/link";
import { useEffect, useState } from "react";

type ProviderCard = {
  id: string;
  name: string;
  envConfigured: boolean;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
  lastRunStatus: string | null;
  externalId: string | null;
};

function statusLabel(status: string) {
  if (status === "connected") return "Connected";
  if (status === "syncing") return "Syncing";
  if (status === "needs_reauth") return "Needs Reauthentication";
  if (status === "pending_oauth") return "Pending";
  if (status === "error") return "Error";
  return "Disconnected";
}

export function CrmIntegrationsClient() {
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
      setMessage({
        text: e instanceof Error ? e.message : "Connect failed",
        error: true,
      });
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
      setMessage({
        text: e instanceof Error ? e.message : "Sync failed",
        error: true,
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="CRM Integrations"
        description="Connect Salesforce, Zoho CRM / Bigin, or Pipedrive so calls, SMS, voicemails, recordings, and tasks sync into the CRM you already use — without Zapier."
      />

      {message ? (
        <p
          className={`mb-4 text-sm ${message.error ? "text-danger" : "text-muted-foreground"}`}
        >
          {message.text}
        </p>
      ) : null}

      <div className="mb-6 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">How it works</p>
        <p className="mt-1">
          Transovo uses one provider-agnostic CRM framework. Each CRM is a thin adapter.
          Connect with OAuth, choose sync preferences, and communication history flows
          into your CRM automatically.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {providers.map((p) => (
          <Card key={p.id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <CardTitle>{p.name}</CardTitle>
              <StatusChip status={statusLabel(p.status)} />
            </div>
            <p className="text-xs text-muted-foreground">
              {p.envConfigured
                ? "OAuth app credentials configured"
                : "Set client ID/secret env vars to enable Connect"}
            </p>
            <p className="text-xs text-muted-foreground">
              Last sync:{" "}
              {p.lastSyncAt ? new Date(p.lastSyncAt).toLocaleString() : "Never"}
              {p.lastRunStatus ? ` · ${p.lastRunStatus}` : ""}
            </p>
            {p.lastError ? (
              <p className="text-xs text-danger line-clamp-2">{p.lastError}</p>
            ) : null}
            <div className="mt-auto flex flex-wrap gap-2">
              {p.status === "connected" || p.status === "syncing" ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy === `sync-${p.id}`}
                    onClick={() => void syncNow(p.id)}
                  >
                    Sync Now
                  </Button>
                  <Link
                    href={`/integrations/crm/${p.id}`}
                    className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted"
                  >
                    Settings
                  </Link>
                </>
              ) : p.status === "needs_reauth" ? (
                <Button
                  size="sm"
                  disabled={!p.envConfigured || busy === p.id}
                  onClick={() => void connect(p.id)}
                >
                  Reconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={!p.envConfigured || busy === p.id}
                  onClick={() => void connect(p.id)}
                >
                  Connect
                </Button>
              )}
              <Link
                href={`/integrations/crm/${p.id}?tab=diagnostics`}
                className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Diagnostics
              </Link>
              <Link
                href={`/integrations/crm/${p.id}?tab=logs`}
                className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Logs
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
