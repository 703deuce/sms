"use client";

import { CloseNowControl } from "@/components/smart-routing/close-now-control";
import { SrPageShell, srCard } from "@/components/smart-routing/shared";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  defaultBusinessHours,
  type BusinessHoursJson,
  type MessagingRuntimeSettings,
} from "@/lib/messaging/messaging-settings";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const DAY_LABELS: Record<string, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

type ActiveFlow = { id: string; name: string; status: string } | null;

export function SmartRoutingBusinessHoursView() {
  const [runtime, setRuntime] = useState<MessagingRuntimeSettings | null>(null);
  const [hours, setHours] = useState<BusinessHoursJson>(defaultBusinessHours());
  const [scheduleOverride, setScheduleOverride] = useState<{
    mode?: string;
    expiresAt?: string;
  } | null>(null);
  const [activeFlow, setActiveFlow] = useState<ActiveFlow>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [runtimeRes, setupRes] = await Promise.all([
        fetch("/api/settings/messaging-runtime"),
        fetch("/api/smart-routing/setup", { cache: "no-store" }),
      ]);
      const runtimeJson = await runtimeRes.json();
      const setupJson = await setupRes.json();
      if (runtimeRes.ok) {
        setRuntime(runtimeJson.data);
        setHours(runtimeJson.data?.businessHoursJson ?? defaultBusinessHours());
      }
      const setup = setupJson.data;
      if (setup) {
        setScheduleOverride(setup.scheduleOverride ?? null);
        const flow = (setup.flows ?? []).find((f: { status: string }) => f.status === "active");
        setActiveFlow(flow ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveHours() {
    if (!runtime) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings/messaging-runtime", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awayEnabled: runtime.awayEnabled,
          awayAlways: runtime.awayAlways,
          awayMessage: runtime.awayMessage,
          timezone: runtime.timezone,
          quietHoursStart: runtime.quietHoursStart,
          quietHoursEnd: runtime.quietHoursEnd,
          reviewLinkUrl: runtime.reviewLinkUrl,
          optOutKeywords: runtime.optOutKeywords,
          optInKeywords: runtime.optInKeywords,
          helpKeywords: runtime.helpKeywords,
          businessHoursJson: hours,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setRuntime(json.data);
      setMessage("Business hours saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function patchDay(day: string, patch: Partial<BusinessHoursJson[string]>) {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...patch },
    }));
  }

  return (
    <SrPageShell
      title="Business Hours"
      description="Weekly schedule, temporary closures, and after-hours routing — without reopening your call flow for every schedule change."
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading hours…</p>
      ) : (
        <div className="space-y-6">
          <CloseNowControl scheduleOverride={scheduleOverride} onUpdated={load} />

          <div className={cn(srCard, "p-5")}>
            <h2 className="text-sm font-semibold">Weekly schedule</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Timezone: {runtime?.timezone ?? "America/Los_Angeles"}. Change timezone in{" "}
              <Link href="/settings/messaging" className="text-primary hover:underline">
                Messaging settings
              </Link>
              .
            </p>
            <div className="mt-4 space-y-3">
              {Object.keys(DAY_LABELS).map((day) => {
                const row = hours[day] ?? { start: "09:00", end: "17:00", enabled: false };
                return (
                  <div
                    key={day}
                    className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2"
                  >
                    <label className="flex items-center gap-2 text-sm font-medium min-w-[120px]">
                      <input
                        type="checkbox"
                        checked={row.enabled ?? false}
                        onChange={(e) => patchDay(day, { enabled: e.target.checked })}
                      />
                      {DAY_LABELS[day]}
                    </label>
                    <Input
                      type="time"
                      className="h-9 w-[130px]"
                      value={row.start}
                      disabled={!row.enabled}
                      onChange={(e) => patchDay(day, { start: e.target.value })}
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      type="time"
                      className="h-9 w-[130px]"
                      value={row.end}
                      disabled={!row.enabled}
                      onChange={(e) => patchDay(day, { end: e.target.value })}
                    />
                  </div>
                );
              })}
            </div>
            <Button className="mt-4" disabled={saving} onClick={() => void saveHours()}>
              {saving ? "Saving…" : "Save weekly hours"}
            </Button>
            {message ? <p className="mt-2 text-sm text-muted-foreground">{message}</p> : null}
          </div>

          <div className={cn(srCard, "p-5")}>
            <h2 className="text-sm font-semibold">After-hours behavior</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              When you are closed, Smart Routing follows the after-hours branch in your active call
              flow — voicemail, alternate routing, or text recovery.
            </p>
            {activeFlow ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/smart-routing/${activeFlow.id}`}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Edit after-hours in {activeFlow.name} →
                </Link>
                <Link
                  href={`/smart-routing/${activeFlow.id}/test`}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Test after-hours routing →
                </Link>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Publish a call flow first, then configure after-hours routing in the flow builder.
              </p>
            )}
          </div>

          <div className={cn(srCard, "p-5")}>
            <h2 className="text-sm font-semibold">Holidays & special hours</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use{" "}
              <Link href="/smart-routing/ai" className="text-primary hover:underline">
                AI Routing Assistant
              </Link>{" "}
              for quick changes like &quot;We&apos;re closing at 3 tomorrow&quot; or ask it to add
              holiday closures. Close Now above handles immediate temporary closures.
            </p>
          </div>
        </div>
      )}
    </SrPageShell>
  );
}
