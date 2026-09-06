"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type CalendarRow = {
  id: string;
  provider: string;
  name: string;
  status: string;
};

const RETURN_PATH = "/appointments/integrations";

export function CalendarIntegrationsCard() {
  const [connections, setConnections] = useState<CalendarRow[]>([]);
  const [blockingEnabled, setBlockingEnabled] = useState(false);
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [microsoftConfigured, setMicrosoftConfigured] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, calendarsRes, statusRes] = await Promise.all([
        fetch("/api/appointments/settings"),
        fetch("/api/voice/calendars").catch(() => null),
        fetch("/api/appointments/integrations/status").catch(() => null),
      ]);
      const settingsJson = settingsRes.ok ? await settingsRes.json() : { data: {} };
      const blocking = settingsJson.data?.externalCalendarBlocking;
      setBlockingEnabled(Boolean(blocking?.enabled));
      setSelectedCalendars(blocking?.calendarIds || []);

      if (calendarsRes?.ok) {
        const calJson = await calendarsRes.json();
        setConnections(
          (calJson.data || [])
            .filter((c: { provider?: string }) =>
              ["google", "microsoft"].includes(String(c.provider || "")),
            )
            .map(
              (c: { id: string; provider: string; name?: string; status?: string }) => ({
                id: c.id,
                provider: c.provider,
                name: c.name || c.provider,
                status: c.status || "pending",
              }),
            ),
        );
      }

      if (statusRes?.ok) {
        const statusJson = await statusRes.json();
        setGoogleConfigured(Boolean(statusJson.data?.googleCalendarConfigured));
        setMicrosoftConfigured(Boolean(statusJson.data?.microsoftCalendarConfigured));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("oauth") || params.get("oauth_error")) {
      void load();
    }
  }, [load]);

  async function saveBlocking() {
    setSaving(true);
    await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        externalCalendarBlocking: {
          enabled: blockingEnabled,
          calendarIds: selectedCalendars,
          connectionIds: connections
            .filter((c) => c.status === "connected")
            .map((c) => c.id),
        },
      }),
    });
    setSaving(false);
  }

  async function startConnect(provider: "google" | "microsoft") {
    const configured = provider === "google" ? googleConfigured : microsoftConfigured;
    if (!configured) return;

    setBusyProvider(provider);
    try {
      const existing = connections.find((c) => c.provider === provider);
      let connectionId = existing?.id;
      if (!connectionId) {
        const res = await fetch("/api/voice/calendars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: provider === "google" ? "Google Calendar" : "Microsoft Outlook",
            provider,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not create calendar connection");
        connectionId = json.data?.id as string;
      }
      if (!connectionId) throw new Error("Missing calendar connection id");
      const returnTo = encodeURIComponent(RETURN_PATH);
      window.location.href = `/api/voice/calendars/oauth/${provider}?connectionId=${encodeURIComponent(connectionId)}&returnTo=${returnTo}`;
    } catch {
      setBusyProvider(null);
    }
  }

  const connected = connections.filter((c) => c.status === "connected");
  const pending = connections.filter((c) => c.status !== "connected");

  if (loading) {
    return (
      <div className="rounded-xl border border-[#ecedf2] bg-white p-5 text-[13px] text-[#8a8fa3]">
        Loading calendar connections…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#ecedf2] bg-white p-5 space-y-5">
      <div>
        <h3 className="text-[14px] font-semibold">Calendar sync</h3>
        <p className="mt-1 text-[12px] text-[#8a8fa3]">
          Connect Google or Outlook so booked appointments sync to your calendar and busy times
          block availability.
        </p>
      </div>

      <ProviderSection
        title="Google Calendar"
        description="Sync bookings and read busy times from Google Calendar."
        configured={googleConfigured}
        envHint="GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET"
        rows={connections.filter((c) => c.provider === "google")}
        busy={busyProvider === "google"}
        onConnect={() => void startConnect("google")}
      />

      <ProviderSection
        title="Microsoft Outlook"
        description="Sync bookings and read busy times from Outlook / Microsoft 365."
        configured={microsoftConfigured}
        envHint="MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET"
        rows={connections.filter((c) => c.provider === "microsoft")}
        busy={busyProvider === "microsoft"}
        onConnect={() => void startConnect("microsoft")}
      />

      {connected.length > 0 ? (
        <div className="space-y-3 border-t border-[#ecedf2] pt-4">
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={blockingEnabled}
              onChange={(e) => setBlockingEnabled(e.target.checked)}
            />
            Use connected calendars to block availability
          </label>

          {blockingEnabled ? (
            <div className="space-y-1">
              <p className="text-[12px] font-semibold text-[#6b6f82]">
                Calendars that block availability
              </p>
              {connected.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={selectedCalendars.includes(c.id)}
                    onChange={(e) => {
                      setSelectedCalendars((prev) =>
                        e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                      );
                    }}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button size="sm" onClick={() => void saveBlocking()} disabled={saving}>
              {saving ? "Saving…" : "Save calendar settings"}
            </Button>
          </div>
        </div>
      ) : pending.length > 0 ? (
        <p className="text-[12px] text-amber-700">
          Finish connecting a calendar above to enable sync and availability blocking.
        </p>
      ) : null}
    </div>
  );
}

function ProviderSection({
  title,
  description,
  configured,
  envHint,
  rows,
  busy,
  onConnect,
}: {
  title: string;
  description: string;
  configured: boolean;
  envHint: string;
  rows: CalendarRow[];
  busy: boolean;
  onConnect: () => void;
}) {
  const connected = rows.filter((r) => r.status === "connected");
  const pending = rows.filter((r) => r.status !== "connected");

  return (
    <div className="rounded-lg border border-[#ecedf2] p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#efecfd] text-[#5b45e0]">
          <Calendar className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">{title}</p>
          <p className="text-[12px] text-[#8a8fa3]">{description}</p>
        </div>
      </div>

      {!configured ? (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-800">
          {title} OAuth is not configured on the server. Set <code className="text-[11px]">{envHint}</code>.
        </div>
      ) : null}

      {connected.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between rounded-lg border border-[#ecedf2] px-3 py-2 text-[13px]"
        >
          <span className="font-medium">{c.name}</span>
          <span className="text-emerald-600 text-[12px] flex items-center gap-1">
            <Link2 className="h-3.5 w-3.5" /> Connected
          </span>
        </div>
      ))}

      {pending.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between rounded-lg border border-dashed border-[#ecedf2] px-3 py-2 text-[13px]"
        >
          <span className="text-[#6b6f82]">{c.name || title}</span>
          <Button size="sm" variant="outline" disabled={!configured || busy} onClick={onConnect}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finish connect"}
          </Button>
        </div>
      ))}

      {rows.length === 0 ? (
        <Button variant="outline" size="sm" disabled={!configured || busy} onClick={onConnect}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
          Connect {title}
        </Button>
      ) : null}
    </div>
  );
}
