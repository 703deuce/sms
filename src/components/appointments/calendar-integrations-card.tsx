"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";

type CalendarConnection = {
  id: string;
  provider: string;
  name: string;
  connected: boolean;
};

export function CalendarIntegrationsCard() {
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [blockingEnabled, setBlockingEnabled] = useState(false);
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stripeConfigured] = useState(() => false);
  const [googleConfigured, setGoogleConfigured] = useState(false);

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
          (calJson.data || []).map((c: { id: string; provider: string; name?: string }) => ({
            id: c.id,
            provider: c.provider,
            name: c.name || c.provider,
            connected: true,
          })),
        );
      }

      if (statusRes?.ok) {
        const statusJson = await statusRes.json();
        setGoogleConfigured(Boolean(statusJson.data?.googleCalendarConfigured));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
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
          connectionIds: connections.map((c) => c.id),
        },
      }),
    });
    setSaving(false);
  }

  function startGoogleConnect(connectionId?: string) {
    if (!googleConfigured) return;
    const id = connectionId || "new";
    window.location.href = `/api/voice/calendars/oauth/google?connectionId=${encodeURIComponent(id)}&returnTo=/appointments/integrations`;
  }

  if (loading) return null;

  return (
    <div className="rounded-xl border border-[#ecedf2] bg-white p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#efecfd] text-[#5b45e0]">
          <Calendar className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold">Google Calendar</h3>
          <p className="text-[12px] text-[#8a8fa3]">
            Block availability when external calendars are busy.
          </p>
        </div>
      </div>

      {!googleConfigured ? (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-[12px] text-amber-800">
          Google Calendar OAuth is not configured. Set{" "}
          <code className="text-[11px]">GOOGLE_CALENDAR_CLIENT_ID</code> and{" "}
          <code className="text-[11px]">GOOGLE_CALENDAR_CLIENT_SECRET</code> to enable connections.
        </div>
      ) : null}

      {connections.length === 0 ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => startGoogleConnect()}
          disabled={!googleConfigured}
        >
          <Link2 className="h-4 w-4 mr-1" /> Connect Google Calendar
        </Button>
      ) : (
        <div className="space-y-2">
          {connections.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-[#ecedf2] px-4 py-3 text-[13px]"
            >
              <span className="font-medium">{c.name}</span>
              <span className="text-emerald-600 text-[12px] flex items-center gap-1">
                <Link2 className="h-3.5 w-3.5" /> Connected
              </span>
            </div>
          ))}
        </div>
      )}

      <label className="flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={blockingEnabled}
          onChange={(e) => setBlockingEnabled(e.target.checked)}
        />
        Use connected calendars to block availability
      </label>

      {blockingEnabled && connections.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[12px] font-semibold text-[#6b6f82]">Calendars that block availability</p>
          {connections.map((c) => (
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
        <Button size="sm" onClick={saveBlocking} disabled={saving}>
          {saving ? "Saving…" : "Save calendar settings"}
        </Button>
      </div>
    </div>
  );
}
