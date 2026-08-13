"use client";

import { StatusChip } from "@/components/ui/status-chip";
import {
  CONNECTABLE_PROVIDERS,
  type ConnectableProviderCard,
} from "@/lib/integrations/connectable-providers";
import {
  isLiveCalendarStatus,
  resolveLiveCalendar,
} from "@/lib/solutions/appointment-receptionist/live-calendar";
import { cn } from "@/lib/utils";
import { CheckCircle2, ExternalLink, Link2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const CALENDAR_PROVIDERS = [
  { id: "calendly", label: "Calendly", description: "Recommended for live booking" },
  { id: "google", label: "Google Calendar" },
  { id: "microsoft", label: "Microsoft Outlook" },
] as const;

const CRM_PROVIDER_IDS = ["zoho", "salesforce", "pipedrive"] as const;

function statusLabel(status: string) {
  if (status === "connected") return "Connected";
  if (status === "syncing") return "Syncing";
  if (status === "needs_reauth") return "Needs reauth";
  if (status === "pending_oauth") return "Pending";
  if (status === "error") return "Error";
  return "Not connected";
}

type Conn = {
  provider: string;
  status: string;
  lastSyncAt?: string | null;
  config?: Record<string, unknown> | null;
};

type CalendarRow = {
  id: string;
  name: string;
  provider: string;
  status: string;
};

export function ReceptionistIntegrationsPanel({
  agentId,
  showCalendar = true,
  showCrm = true,
  onCalendarConnectedChange,
  className,
}: {
  agentId?: string;
  showCalendar?: boolean;
  showCrm?: boolean;
  onCalendarConnectedChange?: (connected: boolean) => void;
  className?: string;
}) {
  const [calendars, setCalendars] = useState<CalendarRow[]>([]);
  const [connections, setConnections] = useState<Conn[]>([]);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [calRes, intRes] = await Promise.all([
        fetch("/api/voice/calendars"),
        fetch("/api/integrations/connections"),
      ]);
      const calJson = await calRes.json();
      const intJson = await intRes.json().catch(() => ({ data: {} }));
      const rows = (calJson.data || []) as CalendarRow[];
      const conns = (intJson.data?.connections || []) as Conn[];
      setCalendars(rows);
      setConnections(conns);
      const live = resolveLiveCalendar({
        voiceCalendars: rows,
        integrationConnections: conns,
      });
      onCalendarConnectedChange?.(live.connected);
    } catch {
      onCalendarConnectedChange?.(false);
    }
  }, [onCalendarConnectedChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const liveCalendar = useMemo(
    () =>
      resolveLiveCalendar({
        voiceCalendars: calendars,
        integrationConnections: connections,
      }),
    [calendars, connections],
  );

  const crmProviders = useMemo(
    () =>
      CONNECTABLE_PROVIDERS.filter(
        (p) => p.framework === "crm" && CRM_PROVIDER_IDS.includes(p.id as typeof CRM_PROVIDER_IDS[number]),
      ),
    [],
  );

  const crmConnected = connections.some(
    (c) =>
      CRM_PROVIDER_IDS.includes(c.provider as typeof CRM_PROVIDER_IDS[number]) &&
      isLiveCalendarStatus(c.status),
  );

  async function connectCalendar(providerId: string) {
    setBusyProvider(providerId);
    setMessage(null);
    try {
      const provider = providerId === "outlook" ? "microsoft" : providerId;

      if (provider === "calendly") {
        const live = resolveLiveCalendar({
          voiceCalendars: calendars,
          integrationConnections: connections,
        });
        if (live.connected && live.provider === "calendly") {
          onCalendarConnectedChange?.(true);
          return;
        }
        const returnPath = agentId
          ? `/voice/agents/${agentId}/capabilities`
          : "/voice/agents";
        window.location.href = `/integrations/native/calendly?return=${encodeURIComponent(returnPath)}`;
        return;
      }

      const existing = calendars.find((c) => c.provider === provider);
      let connectionId = existing?.id;
      if (!connectionId) {
        const label =
          CALENDAR_PROVIDERS.find((c) => c.id === providerId)?.label || "Calendar";
        const res = await fetch("/api/voice/calendars", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: label, provider }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not create calendar connection");
        connectionId = json.data.id as string;
      }

      if (provider === "google" || provider === "microsoft") {
        window.location.href = `/api/voice/calendars/oauth/${provider}?connectionId=${connectionId}`;
        return;
      }

      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Calendar connect failed");
    } finally {
      setBusyProvider(null);
    }
  }

  function isCalendarConnected(providerId: string) {
    const provider = providerId === "outlook" ? "microsoft" : providerId;
    if (provider === "calendly") {
      return liveCalendar.connected && liveCalendar.provider === "calendly";
    }
    const row = calendars.find((c) => c.provider === provider);
    return row && isLiveCalendarStatus(row.status);
  }

  async function connectCrmOAuth(p: ConnectableProviderCard) {
    setBusyProvider(p.id);
    setMessage(null);
    try {
      const res = await fetch("/api/crm/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: p.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not start OAuth");
      window.location.href = json.data.redirectUrl;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "CRM connect failed");
      setBusyProvider(null);
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      {message ? (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {message}
        </p>
      ) : null}

      {showCalendar ? (
        <section className="voice-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Booking calendar</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Connect Calendly (recommended) or Google / Outlook so your receptionist can check
                availability and book appointments.
              </p>
            </div>
            {liveCalendar.connected ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <CheckCircle2 className="h-4 w-4" />
                {liveCalendar.name || liveCalendar.provider}
              </span>
            ) : null}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {CALENDAR_PROVIDERS.map((cal) => {
              const connected = isCalendarConnected(cal.id);
              return (
                <button
                  key={cal.id}
                  type="button"
                  disabled={busyProvider === cal.id}
                  onClick={() => void connectCalendar(cal.id)}
                  className={cn(
                    "rounded-xl border p-4 text-left transition",
                    connected
                      ? "border-primary bg-primary/[0.04] shadow-[0_0_0_1px_rgba(99,102,241,0.35)]"
                      : "border-border hover:border-primary/40 hover:bg-muted/30",
                  )}
                >
                  <p className="text-sm font-semibold">{cal.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {busyProvider === cal.id
                      ? "Connecting…"
                      : connected
                        ? "Connected"
                        : cal.id === "calendly"
                          ? "Connect via OAuth"
                          : "Connect"}
                  </p>
                </button>
              );
            })}
          </div>
          {!liveCalendar.connected ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Booking is enabled but no live calendar is connected yet.
            </p>
          ) : null}
        </section>
      ) : null}

      {showCrm ? (
        <section className="voice-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">CRM &amp; pipeline</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Sync callers, messages, and bookings to your CRM. Zoho is fully supported today;
                connect once for all receptionists in this workspace.
              </p>
            </div>
            {crmConnected ? (
              <Link
                href="/integrations/crm/pipeline"
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Open pipeline
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {crmProviders.map((p) => {
              const conn = connections.find((c) => c.provider === p.id);
              const status = conn?.status || "disconnected";
              const connected = isLiveCalendarStatus(status);
              return (
                <div
                  key={p.id}
                  className={cn(
                    "rounded-xl border p-4",
                    connected ? "border-primary/40 bg-primary/[0.03]" : "border-border",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{p.name}</p>
                    <StatusChip status={statusLabel(status)} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {p.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={p.href}
                      className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted"
                    >
                      Settings
                    </Link>
                    {!connected ? (
                      <button
                        type="button"
                        disabled={busyProvider === p.id}
                        onClick={() => void connectCrmOAuth(p)}
                        className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
                      >
                        {busyProvider === p.id ? "Starting…" : "Connect"}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <Link
              href="/integrations"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <Link2 className="h-3.5 w-3.5" />
              All integrations
            </Link>
            <span>·</span>
            <Link href="/integrations/crm/pipeline" className="hover:text-foreground">
              Pipeline board
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
