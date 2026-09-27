"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarIntegrationsCard } from "@/components/integrations/calendar-integrations-card";
import {
  PLATFORM_CATEGORY_ORDER,
  PLATFORM_INTEGRATION_CARDS,
  type PlatformIntegrationId,
} from "@/lib/integrations/platform-integrations";
import { FieldRow, Panel, Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { Input } from "@/newui-transplant/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/newui-transplant/components/ui/select";

type CalendarConn = { id: string; provider: string; status: string };

const CANONICAL_INTEGRATIONS_PATH = "/integrations";

function calendarStatusLabel(connected: boolean) {
  return connected ? "Connected" : "Not connected";
}

export function PlatformIntegrationsOpus({ focusProvider }: { focusProvider?: string | null }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [calendars, setCalendars] = useState<CalendarConn[]>([]);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [microsoftConfigured, setMicrosoftConfigured] = useState(false);
  const [merchantConnections, setMerchantConnections] = useState<
    Array<{ provider: string; status: string; canAcceptPayments?: boolean }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manageId, setManageId] = useState<PlatformIntegrationId | null>(null);

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
    const map: Record<string, PlatformIntegrationId> = {
      microsoft: "microsoft_calendar",
      microsoft_calendar: "microsoft_calendar",
      google: "google_calendar",
      google_calendar: "google_calendar",
      stripe: "stripe",
      square: "square",
      calendar: "microsoft_calendar",
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
      return calendarStatusLabel(microsoftConnected());
    }
    if (id === "google_calendar") {
      if (!googleConfigured) return "Unavailable";
      return calendarStatusLabel(googleConnected());
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Calendar & payments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Shared across Calendar, Appointments, MCTB Booking, and Payments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            className="h-9 w-full sm:w-48"
            placeholder="Search integrations"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search integrations"
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              {PLATFORM_CATEGORY_ORDER.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}{" "}
          <button type="button" className="underline" onClick={() => void load()}>Retry</button>
        </p>
      ) : null}

      {loading ? <p className="text-sm text-muted-foreground">Loading platform integrations…</p> : null}

      {!loading &&
        PLATFORM_CATEGORY_ORDER.map((cat) => {
          const list = grouped.get(cat) || [];
          if (!list.length) return null;
          return (
            <Panel key={cat} title={cat}>
              <ul className="divide-y">
                {list.map((p) => {
                  const status = statusFor(p.id);
                  const connected = status === "Connected";
                  return (
                    <li
                      key={p.id}
                      className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.description}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Used by: {p.usedBy.join(" · ")}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone={connected ? "success" : status === "Unavailable" ? "neutral" : "warning"}>
                          {status}
                        </Pill>
                        {connected ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => setManageId(p.id)}>
                            Manage
                          </Button>
                        ) : status === "Unavailable" ? null : (
                          <Button
                            type="button"
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
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          );
        })}

      {manageId === "microsoft_calendar" || manageId === "google_calendar" ? (
        <Panel
          title="Calendar connection settings"
          action={
            <Button type="button" variant="ghost" size="sm" onClick={() => setManageId(null)}>Close</Button>
          }
        >
          <CalendarIntegrationsCard />
        </Panel>
      ) : null}

      {manageId === "stripe" || manageId === "square" ? (
        <Panel
          title="Payment processor"
          action={
            <Button type="button" variant="ghost" size="sm" onClick={() => setManageId(null)}>Close</Button>
          }
        >
          <FieldRow label="Stripe" description="Merchant Connect for text-to-pay.">
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void connectStripe()}>Connect Stripe</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => void fetch("/api/merchant-payments/stripe/dashboard", { method: "POST" }).then((r) => r.json()).then((j) => j.data?.url && (window.location.href = j.data.url))}>
                Dashboard
              </Button>
            </div>
          </FieldRow>
          <FieldRow label="Square" description="Alternative merchant processor.">
            <Button type="button" size="sm" variant="outline" onClick={() => void connectSquare()}>Connect Square</Button>
          </FieldRow>
        </Panel>
      ) : null}
    </div>
  );
}
