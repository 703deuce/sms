"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import type { PersonalForwardSchedule } from "@/lib/numbers/personal-forward-schedule";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type SetupPayload = {
  callSettings?: {
    forwardScheduleMode?: "always" | "custom";
    forwardSchedule?: PersonalForwardSchedule | null;
    forwardTargets?: string[];
  };
};

export function CallForwardingBusinessHoursEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"always" | "custom">("always");
  const [timezone, setTimezone] = useState("America/New_York");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [destination, setDestination] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/call-forwarding/setup");
      const json = await res.json();
      const cs = (json.data as SetupPayload)?.callSettings;
      setScheduleMode(cs?.forwardScheduleMode === "custom" ? "custom" : "always");
      const sched = cs?.forwardSchedule;
      if (sched) {
        setTimezone(sched.timezone || "America/New_York");
        const block = sched.blocks?.[0];
        if (block) {
          setStartTime(block.startTime || "08:00");
          setEndTime(block.endTime || "18:00");
          setWeekdays(block.days?.length ? block.days : [1, 2, 3, 4, 5]);
        }
      }
      const target = cs?.forwardTargets?.[0] || blockTarget(sched);
      if (target) setDestination(target);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function blockTarget(sched: PersonalForwardSchedule | null | undefined): string {
    if (!sched?.blocks?.length) return "";
    return sched.blocks[0].targets?.[0] || "";
  }

  function toggleDay(day: number) {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const body =
        scheduleMode === "custom"
          ? {
              forwardScheduleMode: "custom" as const,
              forwardSchedule: {
                timezone,
                blocks: [
                  {
                    id: "weekdays",
                    days: weekdays,
                    startTime,
                    endTime,
                    handling: "forward",
                    targets: destination ? [destination] : [],
                  },
                ],
                outsideHandling: "voicemail_only",
                outsideTargets: [],
              },
            }
          : { forwardScheduleMode: "always" as const, forwardSchedule: null };

      const res = await fetch("/api/call-forwarding/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setMessage("Business hours saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading schedule…</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>When to forward</CardTitle>
        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant={scheduleMode === "always" ? "default" : "outline"}
            size="sm"
            onClick={() => setScheduleMode("always")}
          >
            Always forward
          </Button>
          <Button
            type="button"
            variant={scheduleMode === "custom" ? "default" : "outline"}
            size="sm"
            onClick={() => setScheduleMode("custom")}
          >
            Custom schedule
          </Button>
        </div>
        {scheduleMode === "custom" ? (
          <div className="mt-4 space-y-4">
            <div>
              <Label>Timezone</Label>
              <Input
                className="mt-1 max-w-xs"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="America/New_York"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map((label, day) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`rounded-md border px-3 py-1 text-sm ${
                    weekdays.includes(day)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-4">
              <div>
                <Label>Opens</Label>
                <Input
                  type="time"
                  className="mt-1 w-[140px]"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <Label>Closes</Label>
                <Input
                  type="time"
                  className="mt-1 w-[140px]"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              During open hours, calls forward to your destination. After hours, callers go to
              Transovo voicemail.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            All inbound calls forward immediately using your setup destination.
          </p>
        )}
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save hours"}</Button>
        {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
      </div>

      <Link href="/call-forwarding/setup" className="text-sm text-primary hover:underline">
        ← Back to setup
      </Link>
    </div>
  );
}
