"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/status-chip";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Cloud,
  Contact,
  CreditCard,
  GitBranch,
  RefreshCw,
  Sheet,
  ShoppingBag,
  Terminal,
  Webhook,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Connection = {
  provider: string;
  status: string;
  externalId: string | null;
  config: Record<string, unknown>;
  lastSyncAt: string | null;
};

type ConfigField = { key: string; label: string; placeholder?: string; type?: string };

type ProviderDef = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  tone: string;
  kind: "link" | "stripe" | "oauth" | "apikey";
  href?: string;
  links?: { label: string; href: string }[];
  fields?: ConfigField[];
  canSync?: boolean;
  hasWebhook?: boolean;
};

const PROVIDERS: ProviderDef[] = [
  { id: "api", name: "API", description: "REST API for contacts, campaigns, and messages.", icon: Terminal, tone: "bg-slate-900 text-white", kind: "link", href: "/integrations/api" },
  { id: "webhooks", name: "Webhooks", description: "Push delivery, inbound, and subscription events.", icon: Webhook, tone: "bg-blue-100 text-blue-700", kind: "link", href: "/integrations/webhooks" },
  { id: "zapier", name: "Zapier", description: "Connect Transovo SMS to 5,000+ apps.", icon: Zap, tone: "bg-orange-100 text-orange-600", kind: "link", href: "/integrations/api" },
  {
    id: "stripe",
    name: "Stripe",
    description: "Payments for text-to-pay and workspace billing.",
    icon: CreditCard,
    tone: "bg-violet-100 text-violet-700",
    kind: "stripe",
    links: [
      { label: "Text-to-pay", href: "/messaging/payments" },
      { label: "Billing", href: "/settings/billing" },
    ],
  },
  { id: "crm", name: "CRM Framework", description: "Salesforce, Zoho, Pipedrive — OAuth sync for calls, SMS, tasks.", icon: Cloud, tone: "bg-sky-100 text-sky-700", kind: "link", href: "/integrations/crm" },
  {
    id: "native",
    name: "Connect apps",
    description:
      "Salesforce, Zoho, Pipedrive, Calendly, Typeform, ActiveCampaign, WooCommerce, Jotform, Close, Freshdesk, Klaviyo, HighLevel (Mailchimp deferred).",
    icon: GitBranch,
    tone: "bg-teal-100 text-teal-700",
    kind: "link",
    href: "/integrations/native",
  },
  { id: "hubspot", name: "HubSpot", description: "Sync contacts and ingest CRM events.", icon: GitBranch, tone: "bg-orange-100 text-orange-700", kind: "apikey", fields: [{ key: "apiKey", label: "Private app token", placeholder: "pat-...", type: "password" }], canSync: true, hasWebhook: true },
  { id: "shopify", name: "Shopify", description: "Import customers & order events.", icon: ShoppingBag, tone: "bg-emerald-100 text-emerald-700", kind: "apikey", fields: [{ key: "shopDomain", label: "Shop domain", placeholder: "my-store.myshopify.com" }, { key: "accessToken", label: "Admin API token", placeholder: "shpat_...", type: "password" }], canSync: true, hasWebhook: true },
  { id: "google_contacts", name: "Google Contacts", description: "Import contacts securely via OAuth.", icon: Contact, tone: "bg-sky-100 text-sky-600", kind: "oauth", canSync: true },
  {
    id: "google_sheets",
    name: "Google Sheets",
    description: "Import contacts from a spreadsheet (phone/email columns).",
    icon: Sheet,
    tone: "bg-emerald-100 text-emerald-700",
    kind: "oauth",
    canSync: true,
    fields: [
      {
        key: "spreadsheetId",
        label: "Spreadsheet ID",
        placeholder: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      },
    ],
  },
];

export function IntegrationsDirectory({
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
  const [message, setMessage] = useState<{ id: string; text: string; error?: boolean } | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const err = params.get("connected_error");
    if (connected) return { id: connected, text: `Connected ${connected.replace(/_/g, " ")}` };
    if (err) return { id: "error", text: `Connect failed: ${err}`, error: true };
    return null;
  });

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
        // Stripe is connected when a workspace customer or env key exists.
        const stripeConn = conns.find((c) => c.provider === "stripe");
        setStripeConnected(Boolean(json.data?.stripeEnvConfigured) || stripeConn?.status === "connected");
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    loadConnections();
  }, []);

  function isConnected(p: ProviderDef) {
    if (p.id === "api") return connectedApi;
    if (p.id === "webhooks") return connectedWebhooks;
    if (p.id === "zapier") return endpointsCount > 0;
    if (p.id === "stripe") return stripeConnected;
    return connByProvider[p.id]?.status === "connected";
  }

  function openConfig(p: ProviderDef) {
    setOpenId(openId === p.id ? null : p.id);
    setForm({});
    setMessage(null);
  }

  async function connectOAuth(p: ProviderDef) {
    setBusy(p.id);
    try {
      const res = await fetch("/api/integrations/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: p.id, action: "oauth" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "OAuth failed");
      window.location.assign(json.data.redirectUrl);
    } catch (e) {
      setMessage({ id: p.id, text: e instanceof Error ? e.message : "OAuth failed", error: true });
      setBusy(null);
    }
  }

  async function saveConfig(p: ProviderDef) {
    setBusy(p.id);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: p.id, action: "connect", config: form }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      const wh = json.data?.webhookUrl ? ` Webhook: ${json.data.webhookUrl}` : "";
      setMessage({ id: p.id, text: `Connected.${wh}` });
      setForm({});
      await loadConnections();
    } catch (e) {
      setMessage({ id: p.id, text: e instanceof Error ? e.message : "Save failed", error: true });
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(p: ProviderDef) {
    setBusy(p.id);
    try {
      await fetch("/api/integrations/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: p.id, action: "disconnect" }),
      });
      await loadConnections();
      setOpenId(null);
    } finally {
      setBusy(null);
    }
  }

  async function sync(p: ProviderDef) {
    setBusy(p.id);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: p.id, action: "sync" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Sync failed");
      setMessage({ id: p.id, text: `Imported ${json.data.imported} contacts (${json.data.created} new).` });
      await loadConnections();
    } catch (e) {
      setMessage({ id: p.id, text: e instanceof Error ? e.message : "Sync failed", error: true });
    } finally {
      setBusy(null);
    }
  }

  function webhookUrlFor(p: ProviderDef) {
    const conn = connByProvider[p.id];
    const token = conn?.config?.webhookToken as string | undefined;
    if (!token) return null;
    return `${window.location.origin}/api/integrations/${p.id}/webhook?token=${token}`;
  }

  return (
    <Card>
      <h2 className="mb-4 text-[14px] font-bold text-foreground">Integration directory</h2>
      {message && (
        <p className={cn("mb-3 rounded-lg border px-3 py-2 text-[13px]", message.error ? "border-red-200 bg-red-50 text-red-700" : "border-violet-200 bg-violet-50 text-violet-700")}>
          {message.text}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PROVIDERS.map((p) => {
          const Icon = p.icon;
          const connected = isConnected(p);
          const open = openId === p.id;
          const conn = connByProvider[p.id];

          return (
            <div key={p.id} className="rounded-[12px] border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]", p.tone)}>
                  <Icon className="h-5 w-5" />
                </span>
                <StatusChip status={connected ? "Connected" : "Disconnected"} />
              </div>
              <p className="mt-3 text-[14px] font-semibold text-foreground">{p.name}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{p.description}</p>
              {conn?.lastSyncAt && (
                <p className="mt-1 text-[11px] text-muted-foreground">Last sync {new Date(conn.lastSyncAt).toLocaleString()}</p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                {p.kind === "link" && p.href && (
                  <Link href={p.href} className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary">
                    {connected ? "Manage" : "Configure"} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}

                {p.kind === "stripe" && (
                  <>
                    {p.links?.map((l) => (
                      <Link key={l.href} href={l.href} className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary">
                        {l.label}
                      </Link>
                    ))}
                  </>
                )}

                {p.kind === "oauth" && (
                  <>
                    {connected ? (
                      <>
                        {p.fields?.length ? (
                          <Button size="sm" variant="outline" onClick={() => openConfig(p)}>
                            Configure
                          </Button>
                        ) : null}
                        {p.canSync && (
                          <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => sync(p)} className="gap-1">
                            <RefreshCw className="h-3.5 w-3.5" /> Sync
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" disabled={busy === p.id} onClick={() => disconnect(p)}>Disconnect</Button>
                      </>
                    ) : (
                      <Button size="sm" disabled={busy === p.id} onClick={() => connectOAuth(p)}>Connect</Button>
                    )}
                  </>
                )}

                {p.kind === "apikey" && (
                  <>
                    <Button size="sm" variant={connected ? "outline" : "primary"} onClick={() => openConfig(p)}>
                      {connected ? "Manage" : "Connect"}
                    </Button>
                    {connected && p.canSync && (
                      <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => sync(p)} className="gap-1">
                        <RefreshCw className="h-3.5 w-3.5" /> Sync
                      </Button>
                    )}
                    {connected && (
                      <Button size="sm" variant="ghost" disabled={busy === p.id} onClick={() => disconnect(p)}>Disconnect</Button>
                    )}
                  </>
                )}
              </div>

              {open && (p.kind === "apikey" || (p.kind === "oauth" && p.fields?.length)) && (
                <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                  {p.fields?.map((f) => (
                    <div key={f.key}>
                      <Label className="text-xs">{f.label}</Label>
                      <Input
                        type={f.type || "text"}
                        value={form[f.key] || ""}
                        placeholder={f.placeholder}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        className="h-9 text-sm"
                      />
                    </div>
                  ))}
                  <Button size="sm" disabled={busy === p.id} onClick={() => saveConfig(p)}>Save & connect</Button>
                  {p.hasWebhook && webhookUrlFor(p) && (
                    <div className="pt-1">
                      <Label className="text-xs">Inbound webhook URL</Label>
                      <code className="block break-all rounded bg-card px-2 py-1 text-[11px]">{webhookUrlFor(p)}</code>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
