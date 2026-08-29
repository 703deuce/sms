"use client";

import { MctbWeeklyScheduleEditor } from "@/components/mctb/weekly-schedule-editor";
import { MctbPausedNotice } from "@/components/mctb/mctb-paused-notice";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import {
  addPauseUntil,
  defaultWeeklySchedule,
  type MctbScheduleMode,
  type MctbWeeklySchedule,
} from "@/lib/mctb/schedule-shared";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type SchedulePayload = {
  scheduleMode: MctbScheduleMode;
  weeklySchedule: MctbWeeklySchedule | null;
  pauseUntil: string | null;
  manuallyPaused?: boolean;
  pauseKind?: "manual" | "timed" | null;
  paused: boolean;
};

export function MctbScheduleView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [savedWhilePaused, setSavedWhilePaused] = useState(false);
  const [pauseKind, setPauseKind] = useState<"manual" | "timed" | null>(null);
  const [scheduleMode, setScheduleMode] = useState<MctbScheduleMode>("always_on");
  const [weeklySchedule, setWeeklySchedule] = useState<MctbWeeklySchedule>(
    defaultWeeklySchedule(),
  );
  const [pauseUntil, setPauseUntil] = useState<string | null>(null);
  const [allowedStartTime, setAllowedStartTime] = useState("09:00");
  const [allowedEndTime, setAllowedEndTime] = useState("17:00");
  const [timezone, setTimezone] = useState("America/New_York");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mctb/setup", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.data?.runtime) return;
      const r = json.data.runtime;
      const sch = json.data.schedule as SchedulePayload | undefined;
      setPauseKind(sch?.pauseKind ?? (sch?.paused ? "manual" : null));
      setTimezone(r.timezone || "America/New_York");
      setAllowedStartTime(r.allowedStartTime || "09:00");
      setAllowedEndTime(r.allowedEndTime || "17:00");
      if (sch) {
        setScheduleMode(sch.scheduleMode || "always_on");
        setPauseUntil(sch.pauseUntil);
        if (sch.weeklySchedule) {
          setWeeklySchedule(sch.weeklySchedule);
        } else {
          setWeeklySchedule(defaultWeeklySchedule(r.timezone || "America/New_York"));
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const statusLabel = useMemo(() => {
    if (pauseKind === "manual") {
      return "Missed Call Text Back is PAUSED until you resume";
    }
    if (pauseKind === "timed" && pauseUntil && new Date(pauseUntil) > new Date()) {
      return `Paused until ${new Date(pauseUntil).toLocaleString(undefined, {
        timeZone: timezone,
        dateStyle: "medium",
        timeStyle: "short",
      })}`;
    }
    return "Missed Call Text Back is ACTIVE";
  }, [pauseKind, pauseUntil, timezone]);

  async function save() {
    setSaving(true);
    setMessage("");
    setSavedWhilePaused(false);
    const wasPaused =
      pauseKind === "manual" ||
      Boolean(pauseKind === "timed" && pauseUntil && new Date(pauseUntil) > new Date());
    try {
      let weekly: MctbWeeklySchedule | null =
        scheduleMode === "custom" ? weeklySchedule : null;

      if (scheduleMode === "business_hours" || scheduleMode === "after_hours") {
        weekly = {
          timezone,
          days: weeklySchedule.days.map((d) => ({
            ...d,
            enabled: true,
            startTime: allowedStartTime,
            endTime: allowedEndTime,
          })),
        };
      }

      const res = await fetch("/api/mctb/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessHoursOnly: scheduleMode === "business_hours",
          allowedStartTime:
            scheduleMode === "business_hours" || scheduleMode === "after_hours"
              ? allowedStartTime
              : null,
          allowedEndTime:
            scheduleMode === "business_hours" || scheduleMode === "after_hours"
              ? allowedEndTime
              : null,
          timezone,
          scheduleMode,
          weeklySchedule: weekly,
          pauseUntil,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      if (wasPaused || json.data?.schedule?.paused) {
        setSavedWhilePaused(true);
      } else {
        setMessage("Schedule saved.");
      }
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function pauseFor(duration: "1h" | "4h" | "tomorrow") {
    setSaving(true);
    setMessage("");
    try {
      const until = addPauseUntil(duration, timezone);
      const res = await fetch("/api/mctb/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pauseUntil: until }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Pause failed");
      setPauseUntil(until);
      setPauseKind("timed");
      setMessage(`Paused until ${new Date(until).toLocaleString()}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Pause failed");
    } finally {
      setSaving(false);
    }
  }

  async function pauseManual() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/mctb/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false, pauseUntil: null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Pause failed");
      setPauseUntil(null);
      setPauseKind("manual");
      setMessage("Missed Call Text Back paused until you resume.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Pause failed");
    } finally {
      setSaving(false);
    }
  }

  async function resume() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/mctb/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true, pauseUntil: null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Resume failed");
      setPauseUntil(null);
      setPauseKind(null);
      setMessage("Missed Call Text Back is active.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Resume failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading schedule…</p>;
  }

  const modeOptions: Array<{ id: MctbScheduleMode; label: string }> = [
    { id: "always_on", label: "Always On" },
    { id: "business_hours", label: "Only During Business Hours" },
    { id: "after_hours", label: "Only After Business Hours" },
    { id: "custom", label: "Custom Schedule" },
  ];

  const isPaused =
    pauseKind === "manual" ||
    Boolean(pauseKind === "timed" && pauseUntil && new Date(pauseUntil) > new Date());

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          When should Missed Call Text Back run?
        </p>
      </div>

      <Card className="p-4">
        <p className="text-sm font-semibold">{statusLabel}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {isPaused ? (
            <Button type="button" size="sm" onClick={resume} disabled={saving}>
              Resume
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => pauseFor("1h")} disabled={saving}>
                Pause 1 hour
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => pauseFor("4h")} disabled={saving}>
                Pause 4 hours
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => pauseFor("tomorrow")} disabled={saving}>
                Until tomorrow 8 AM
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={pauseManual} disabled={saving}>
                Pause until resumed
              </Button>
            </>
          )}
        </div>
      </Card>

      {isPaused ? (
        <MctbPausedNotice
          pauseKind={pauseKind}
          pauseUntil={pauseUntil}
          variant="banner"
        />
      ) : null}

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold">When to send text-backs</h2>
        <div className="flex flex-wrap gap-2">
          {modeOptions.map((opt) => (
            <Button
              key={opt.id}
              type="button"
              size="sm"
              variant={scheduleMode === opt.id ? "primary" : "outline"}
              onClick={() => setScheduleMode(opt.id)}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        {scheduleMode === "business_hours" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Opens</Label>
              <Input
                type="time"
                className="mt-1"
                value={allowedStartTime}
                onChange={(e) => setAllowedStartTime(e.target.value)}
              />
            </div>
            <div>
              <Label>Closes</Label>
              <Input
                type="time"
                className="mt-1"
                value={allowedEndTime}
                onChange={(e) => setAllowedEndTime(e.target.value)}
              />
            </div>
            <div>
              <Label>Timezone</Label>
              <Input className="mt-1" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </div>
          </div>
        ) : null}

        {scheduleMode === "custom" ? (
          <MctbWeeklyScheduleEditor schedule={weeklySchedule} onChange={setWeeklySchedule} />
        ) : null}

        {scheduleMode === "always_on" ? (
          <p className="text-sm text-muted-foreground">
            Text-backs can run any time a missed call is detected (subject to consent and compliance).
          </p>
        ) : null}

        {scheduleMode === "after_hours" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Business opens</Label>
              <Input
                type="time"
                className="mt-1"
                value={allowedStartTime}
                onChange={(e) => setAllowedStartTime(e.target.value)}
              />
            </div>
            <div>
              <Label>Business closes</Label>
              <Input
                type="time"
                className="mt-1"
                value={allowedEndTime}
                onChange={(e) => setAllowedEndTime(e.target.value)}
              />
            </div>
            <div>
              <Label>Timezone</Label>
              <Input className="mt-1" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </div>
            <p className="text-sm text-muted-foreground sm:col-span-3">
              Text-backs run outside this daily window on all days.
            </p>
          </div>
        ) : null}
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save schedule"}</Button>
          {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
        </div>
        {savedWhilePaused ? (
          <MctbPausedNotice
            pauseKind={pauseKind}
            pauseUntil={pauseUntil}
            variant="saved"
          />
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        Consent prompts, first message, and recovery rules live in{" "}
        <Link href="/voice/setup" className="text-primary hover:underline">Text Back Setup</Link>.
      </p>
    </div>
  );
}
