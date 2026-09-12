"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";
import {
  PLATFORM_CATEGORY_ORDER,
  PLATFORM_INTEGRATION_CARDS,
  type PlatformIntegrationId,
} from "@/lib/integrations/platform-integrations";
import { CalendarIntegrationsCard } from "@/components/integrations/calendar-integrations-card";
import { MerchantPaymentsPanel } from "@/components/integrations/kimi-ui/payments/components/MerchantPaymentsPanel";
import type { MerchantConnectionView, MerchantPaymentProvider } from "@/components/integrations/kimi-ui/payments/types";

const CANONICAL_INTEGRATIONS_PATH = "/integrations";

type CalendarConn = { id: string; provider: string; status: string; config?: { email?: string } | null };

function calendarStatusLabel(connected: boolean, needsAttention: boolean) {
  if (needsAttention) return "Needs attention";
  if (connected) return "Connected";
  return "Not connected";
}

export function PlatformIntegrationCards({ focusProvider }: { focusProvider?: string | null }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [calendars, setCalendars] = useState<CalendarConn[]>([]);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [microsoftConfigured, setMicrosoftConfigured] = useState(false);
  const [merchantConnections, setMerchantConnections] = useState<MerchantConnectionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manageId, setManageId] = useState<PlatformIntegrationId | null>(null);
  const [pendingDisconnect, setPendingDisconnect] = useState<MerchantPaymentProvider | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [calRes, statusRes, merchantRes] = await Promise.all([
        fetch("/api/integrations/calendars"),
        fetch("/api/appointments/integrations/status"),
        fetch("/api/merchant-payments/status"),
      ]);
      if (calRes.ok) {
        const json = await calRes.json();
        setCalendars((json.data || []) as CalendarConn[]);
      }
      if (statusRes.ok) {
        const json = await statusRes.json();
        setGoogleConfigured(Boolean(json.data?.googleCalendarConfigured));
        setMicrosoftConfigured(Boolean(json.data?.microsoftCalendarConfigured));
      }
      if (merchantRes.ok) {
        const json = await merchantRes.json();
        setMerchantConnections(json.data?.connections || []);
      }
    } catch {
      setError("Couldn't load integrations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!focusProvider) return;
    if (focusProvider === "calendar") {
      document.getElementById("platform-integrations")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const map: Record<string, PlatformIntegrationId> = {
      microsoft: "microsoft_calendar",
      microsoft_calendar: "microsoft_calendar",
      google: "google_calendar",
      google_calendar: "google_calendar",
      stripe: "stripe",
      square: "square",
    };
    const id = map[focusProvider];
    if (id) setManageId(id);
  }, [focusProvider]);

  const stripeConn = merchantConnections.find((c) => c.provider === "STRIPE");
  const squareConn = merchantConnections.find((c) => c.provider === "SQUARE");

  function microsoftConnected() {
    return calendars.some((c) => c.provider === "microsoft" && c.status === "connected");
  }

  function googleConnected() {
    return calendars.some((c) => c.provider === "google" && c.status === "connected");
  }

  function statusFor(id: PlatformIntegrationId): string {
    if (id === "microsoft_calendar") {
      if (!microsoftConfigured) return "Unavailable";
      return calendarStatusLabel(microsoftConnected(), false);
    }
    if (id === "google_calendar") {
      if (!googleConfigured) return "Unavailable";
      return calendarStatusLabel(googleConnected(), false);
    }
    if (id === "stripe") {
      if (!stripeConn) return "Not connected";
      if (stripeConn.status === "needs_attention") return "Needs attention";
      return stripeConn.canAcceptPayments ? "Connected" : "Needs attention";
    }
    if (id === "square") {
      if (!squareConn) return "Not connected";
      return squareConn.canAcceptPayments ? "Connected" : squareConn.status === "needs_attention" ? "Needs attention" : "Not connected";
    }
    return "Not connected";
  }

  async function connectStripe() {
    setActing("stripe");
    const res = await fetch("/api/merchant-payments/stripe/connect", { method: "POST" });
    const json = await res.json();
    setActing(null);
    if (json.data?.url) window.location.href = json.data.url;
  }

  async function connectSquare() {
    setActing("square");
    const res = await fetch("/api/merchant-payments/square/connect");
    const json = await res.json();
    setActing(null);
    if (json.data?.url) window.location.href = json.data.url;
  }

  async function openStripeDashboard() {
    setActing("stripe-dashboard");
    const res = await fetch("/api/merchant-payments/stripe/dashboard", { method: "POST" });
    const json = await res.json();
    setActing(null);
    if (json.data?.url) window.location.href = json.data.url;
  }

  async function disconnectMerchant(provider: MerchantPaymentProvider) {
    const slug = provider === "STRIPE" ? "stripe" : "square";
    setActing(slug);
    await fetch(`/api/merchant-payments/${slug}/disconnect`, { method: "POST" });
    setActing(null);
    setPendingDisconnect(null);
    await load();
  }

  async function startCalendarOAuth(provider: "google" | "microsoft") {
    setActing(provider);
    try {
      const label = provider === "google" ? "Google Calendar" : "Microsoft Outlook";
      const existingCount = calendars.filter((c) => c.provider === provider).length;
      const res = await fetch("/api/integrations/calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: existingCount ? `${label} ${existingCount + 1}` : label,
          provider,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not create connection");
      const connectionId = json.data?.id as string;
      const returnTo = encodeURIComponent(`${CANONICAL_INTEGRATIONS_PATH}?provider=${provider === "microsoft" ? "microsoft" : "google"}`);
      window.location.href = `/api/integrations/calendars/oauth/${provider}?connectionId=${encodeURIComponent(connectionId)}&returnTo=${returnTo}`;
    } catch {
      setActing(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PLATFORM_INTEGRATION_CARDS.filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [category, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof PLATFORM_INTEGRATION_CARDS>();
    for (const cat of PLATFORM_CATEGORY_ORDER) map.set(cat, []);
    for (const p of filtered) {
      const list = map.get(p.category) || [];
      list.push(p);
      map.set(p.category, list);
    }
    return map;
  }, [filtered]);

  return (
    <div id="platform-integrations" className="space-y-4 scroll-mt-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[16px] font-bold tracking-tight text-foreground">Calendar & payments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Shared across Calendar, Appointments, MCTB Booking, and Payments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="h-9 rounded-lg border border-border px-3 text-sm"
            placeholder="Search integrations"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search integrations"
          />
          <select
            className="h-9 rounded-lg border border-border px-2 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Category filter"
          >
            <option value="All">All</option>
            {PLATFORM_CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}{" "}
          <button type="button" className="underline" onClick={() => void load()}>Retry</button>
        </p>
      ) : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-[170px] animate-pulse bg-muted/40 p-4" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No integrations match your search.{" "}
          <button type="button" className="underline" onClick={() => { setSearch(""); setCategory("All"); }}>
            Clear search
          </button>
        </p>
      ) : (
        PLATFORM_CATEGORY_ORDER.map((cat) => {
          const list = grouped.get(cat) || [];
          if (!list.length) return null;
          return (
            <section key={cat}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{cat}</h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((p) => {
                  const status = statusFor(p.id);
                  const connected = status === "Connected";
                  return (
                    <Card key={p.id} className="flex min-h-[170px] flex-col gap-3 p-5">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{p.name}</CardTitle>
                        <StatusChip status={status} />
                      </div>
                      <p className="text-sm text-muted-foreground">{p.description}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Used by: {p.usedBy.join(" · ")}
                      </p>
                      <div className="mt-auto flex flex-wrap gap-2">
                        {connected ? (
                          <Button size="sm" variant="outline" onClick={() => setManageId(p.id)}>
                            Manage
                          </Button>
                        ) : status === "Unavailable" ? (
                          <span className="text-xs text-muted-foreground">Not configured on platform</span>
                        ) : (
                          <Button
                            size="sm"
                            disabled={Boolean(acting)}
                            onClick={() => {
                              if (p.id === "stripe") void connectStripe();
                              else if (p.id === "square") void connectSquare();
                              else if (p.id === "microsoft_calendar") void startCalendarOAuth("microsoft");
                              else if (p.id === "google_calendar") void startCalendarOAuth("google");
                            }}
                          >
                            {acting ? "Connecting…" : "Connect"}
                          </Button>
                        )}
                        {connected && (p.id === "stripe" || p.id === "square") ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPendingDisconnect(p.id === "stripe" ? "STRIPE" : "SQUARE")}
                          >
                            Disconnect
                          </Button>
                        ) : null}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      {manageId === "microsoft_calendar" || manageId === "google_calendar" ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Calendar connection settings</h3>
            <Button size="sm" variant="ghost" onClick={() => setManageId(null)}>Close</Button>
          </div>
          <CalendarIntegrationsCard />
        </div>
      ) : null}

      {manageId === "stripe" || manageId === "square" ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Payment processor settings</h3>
            <Button size="sm" variant="ghost" onClick={() => setManageId(null)}>Close</Button>
          </div>
          <MerchantPaymentsPanel
            embedded
            connections={merchantConnections}
            loading={loading}
            acting={acting}
            error={error}
            pendingDisconnect={pendingDisconnect}
            onRetry={() => void load()}
            onConnectStripe={connectStripe}
            onConnectSquare={connectSquare}
            onReconnect={(prov) => (prov === "STRIPE" ? connectStripe() : connectSquare())}
            onManageStripeDashboard={openStripeDashboard}
            onDisconnect={setPendingDisconnect}
            onCancelDisconnect={() => setPendingDisconnect(null)}
            onConfirmDisconnect={() => pendingDisconnect && disconnectMerchant(pendingDisconnect)}
            onSimulateEmpty={() => {}}
            onSimulateError={() => setError("Payment connection status couldn't be loaded.")}
          />
        </div>
      ) : null}
    </div>
  );
}
