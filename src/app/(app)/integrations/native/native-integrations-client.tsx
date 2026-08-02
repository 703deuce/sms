"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CatalogItem = {
  id: string;
  displayName: string;
  category: string;
  authKind: "oauth" | "credentials";
  description: string;
  credentialHelp?: string;
  connection: {
    status: string;
    externalId: string | null;
    lastSyncAt: string | null;
    config?: Record<string, unknown>;
  } | null;
  env?: { ready: boolean; missing: string[]; callbackUrl: string } | null;
};

type CrmItem = {
  id: string;
  displayName: string;
  category: string;
  href: string;
  authKind: "oauth";
  connection: { status: string; lastSyncAt: string | null } | null;
};

const CATEGORY_ORDER = [
  "crm_sales",
  "scheduling_forms",
  "marketing",
  "ecommerce",
  "customer_support",
];

export function NativeIntegrationsClient() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [crmItems, setCrmItems] = useState<CrmItem[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    return fetch("/api/integrations/native")
      .then((r) => r.json())
      .then((j) => {
        setItems(j.data?.connections || []);
        setCrmItems(j.data?.crmConnections || []);
        setCategories(j.data?.categories || {});
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    const err = params.get("connected_error");
    const connected = params.get("connected");
    if (err) setMessage({ text: err, error: true });
    if (connected) setMessage({ text: `Connected ${connected}` });
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Array<(CatalogItem | CrmItem) & { isCrm?: boolean }>>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const c of crmItems) {
      const list = map.get(c.category) || [];
      list.push({ ...c, isCrm: true });
      map.set(c.category, list);
    }
    for (const item of items) {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [items, crmItems]);

  async function oauthConnect(provider: string) {
    setBusy(provider);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/native", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, action: "oauth_start" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not start OAuth");
      window.location.href = json.data.redirectUrl;
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Connect failed", error: true });
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Integrations"
        description="Connect Salesforce, Zoho, Pipedrive, Calendly, Typeform, ActiveCampaign, WooCommerce, Jotform, Close, Freshdesk, Klaviyo, and HighLevel. Mailchimp is deferred for this pass."
      />

      {message ? (
        <p className={`mb-4 text-sm ${message.error ? "text-red-600" : "text-emerald-700"}`}>
          {message.text}
        </p>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        <Link href="/integrations/crm" className="underline">
          CRM framework (Salesforce / Zoho / Pipedrive)
        </Link>
        <Link href="/integrations/native/leads" className="underline">
          Lead inbox
        </Link>
        <Link href="/integrations/native/appointments" className="underline">
          Appointments
        </Link>
        <Link href="/integrations/native/tasks" className="underline">
          Tasks
        </Link>
        <Link href="/integrations/native/orders" className="underline">
          Orders
        </Link>
        <Link href="/integrations/native/audit" className="underline">
          Action audit
        </Link>
        <Link href="/integrations/native/ai-policy" className="underline">
          AI safety
        </Link>
        <Link href="/reports/integrations" className="underline">
          Analytics
        </Link>
        <Link href="/integrations" className="underline">
          All integrations
        </Link>
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const list = grouped.get(cat) || [];
        if (!list.length) return null;
        return (
          <section key={cat} className="mb-10">
            <h2 className="mb-3 text-lg font-semibold tracking-tight">
              {categories[cat] || cat}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {list.map((p) => {
                const status = p.connection?.status || "disconnected";
                const authLabel = p.authKind === "oauth" ? "OAuth" : "API credentials";
                return (
                  <Card key={p.id} className="flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{p.displayName}</CardTitle>
                      <StatusChip
                        status={
                          status === "connected"
                            ? "Connected"
                            : status === "error"
                              ? "Error"
                              : status === "needs_reauth"
                                ? "Needs Reauthentication"
                                : "Disconnected"
                        }
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {"description" in p
                        ? (p as CatalogItem).description
                        : "CRM OAuth sync via the CRM framework."}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Auth: {authLabel}
                      {p.connection?.lastSyncAt
                        ? ` · Last sync ${new Date(p.connection.lastSyncAt).toLocaleString()}`
                        : ""}
                    </p>
                    <div className="mt-auto flex flex-wrap gap-2">
                      {p.isCrm ? (
                        <Link
                          href={(p as CrmItem).href}
                          className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground"
                        >
                          Open
                        </Link>
                      ) : (
                        <>
                          <Link
                            href={`/integrations/native/${p.id}`}
                            className="inline-flex h-8 items-center rounded-lg bg-muted px-3 text-xs font-medium"
                          >
                            Configure
                          </Link>
                          {p.authKind === "oauth" && status !== "connected" ? (
                            <Button
                              size="sm"
                              disabled={busy === p.id}
                              onClick={() => oauthConnect(p.id)}
                            >
                              {busy === p.id ? "Starting…" : "Connect"}
                            </Button>
                          ) : null}
                        </>
                      )}
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
