"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CalendarX, Check, Clock, Globe, Plus, Timer, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

type TimeWindow = { open: string; close: string };
type DateOverride = { date: string; closed?: boolean; windows?: TimeWindow[] };

const DAY_LABELS = [
  { key: "monday", label: "Monday", short: "Mon" },
  { key: "tuesday", label: "Tuesday", short: "Tue" },
  { key: "wednesday", label: "Wednesday", short: "Wed" },
  { key: "thursday", label: "Thursday", short: "Thu" },
  { key: "friday", label: "Friday", short: "Fri" },
  { key: "saturday", label: "Saturday", short: "Sat" },
  { key: "sunday", label: "Sunday", short: "Sun" },
];

function defaultWeeklyHours(): Record<string, TimeWindow[]> {
  return {
    monday: [{ open: "09:00", close: "17:00" }],
    tuesday: [{ open: "09:00", close: "17:00" }],
    wednesday: [{ open: "09:00", close: "17:00" }],
    thursday: [{ open: "09:00", close: "17:00" }],
    friday: [{ open: "09:00", close: "17:00" }],
    saturday: [],
    sunday: [],
  };
}

function formatOverrideDate(date: string) {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AppointmentAvailabilityClient() {
  const [weeklyHours, setWeeklyHours] = useState<Record<string, TimeWindow[]>>(defaultWeeklyHours());
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([]);
  const [timezone, setTimezone] = useState("America/New_York");
  const [minimumNotice, setMinimumNotice] = useState(60);
  const [maximumDays, setMaximumDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideClosed, setOverrideClosed] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState("10:00");
  const [overrideClose, setOverrideClose] = useState("14:00");

  useEffect(() => {
    fetch("/api/appointments/settings")
      .then((r) => r.json())
      .then((json) => {
        const data = json.data || {};
        if (data.weeklyHours && Object.keys(data.weeklyHours).length) {
          setWeeklyHours(data.weeklyHours);
        }
        setDateOverrides(data.dateOverrides || []);
        setTimezone(data.timezone || "America/New_York");
        setMinimumNotice(data.minimumBookingNoticeMinutes ?? 60);
        setMaximumDays(data.maximumBookingDaysAhead ?? 14);
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weeklyHours,
        dateOverrides,
        timezone,
        minimumBookingNoticeMinutes: minimumNotice,
        maximumBookingDaysAhead: maximumDays,
      }),
    });
    setSaving(false);
    setSaved(true);
  }

  function updateWindow(day: string, index: number, field: "open" | "close", value: string) {
    setWeeklyHours((prev) => {
      const next = { ...prev };
      const windows = [...(next[day] || [])];
      windows[index] = { ...windows[index], [field]: value };
      next[day] = windows;
      return next;
    });
  }

  function addWindow(day: string) {
    setWeeklyHours((prev) => ({
      ...prev,
      [day]: [...(prev[day] || []), { open: "09:00", close: "12:00" }],
    }));
  }

  function removeWindow(day: string, index: number) {
    setWeeklyHours((prev) => ({
      ...prev,
      [day]: (prev[day] || []).filter((_, i) => i !== index),
    }));
  }

  function addOverride() {
    if (!overrideDate) return;
    const entry: DateOverride = overrideClosed
      ? { date: overrideDate, closed: true }
      : { date: overrideDate, windows: [{ open: overrideOpen, close: overrideClose }] };
    setDateOverrides((prev) =>
      [...prev.filter((o) => o.date !== overrideDate), entry].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    );
    setOverrideDate("");
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
          <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded-md bg-muted" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="surface h-40 animate-pulse rounded-xl bg-card" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
          Availability
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          Control when customers can book. Public booking, manual booking, and slot validation all
          use these hours.
        </p>
      </div>

      {/* Booking rules */}
      <Card className="p-0">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Globe className="h-3.5 w-3.5" />
            </span>
            <CardTitle>Booking rules</CardTitle>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Applied to every booking channel for this workspace.
          </p>
        </div>
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-3">
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              className="h-9"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">All times below use this zone.</p>
          </div>
          <div>
            <Label htmlFor="notice">Minimum notice</Label>
            <div className="relative">
              <Input
                id="notice"
                type="number"
                min={0}
                className="h-9 pr-16"
                value={minimumNotice}
                onChange={(e) => setMinimumNotice(Number(e.target.value) || 0)}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                minutes
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">How far ahead bookings must be made.</p>
          </div>
          <div>
            <Label htmlFor="horizon">Booking horizon</Label>
            <div className="relative">
              <Input
                id="horizon"
                type="number"
                min={1}
                className="h-9 pr-16"
                value={maximumDays}
                onChange={(e) => setMaximumDays(Number(e.target.value) || 14)}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                days
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">Furthest date customers can book.</p>
          </div>
        </div>
      </Card>

      {/* Weekly hours */}
      <Card className="p-0">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock className="h-3.5 w-3.5" />
            </span>
            <CardTitle>Weekly hours</CardTitle>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Your recurring schedule. Add multiple windows for split shifts.
          </p>
        </div>
        <div className="divide-y divide-border/70">
          {DAY_LABELS.map(({ key, label }) => {
            const windows = weeklyHours[key] || [];
            const closed = windows.length === 0;
            return (
              <div
                key={key}
                className={cn(
                  "flex flex-col gap-3 px-5 py-3.5 transition-colors sm:flex-row sm:items-start sm:gap-4",
                  closed && "bg-muted/30",
                )}
              >
                <div className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-36 sm:justify-start sm:pt-1.5">
                  <p className="text-[13px] font-semibold tracking-tight text-foreground">{label}</p>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      closed
                        ? "bg-muted text-muted-foreground"
                        : "bg-emerald-50 text-emerald-700",
                    )}
                  >
                    {closed ? "Closed" : "Open"}
                  </span>
                </div>
                <div className="flex-1 space-y-2">
                  {closed ? (
                    <p className="pt-1.5 text-[13px] text-muted-foreground">
                      No availability on {label}s.
                    </p>
                  ) : (
                    windows.map((window, idx) => (
                      <div key={`${key}-${idx}`} className="flex flex-wrap items-center gap-2">
                        <Input
                          type="time"
                          aria-label={`${label} opens`}
                          className="h-8 w-[7.25rem] px-2.5 text-[13px] tabular-nums"
                          value={window.open}
                          onChange={(e) => updateWindow(key, idx, "open", e.target.value)}
                        />
                        <span className="text-xs font-medium text-muted-foreground">to</span>
                        <Input
                          type="time"
                          aria-label={`${label} closes`}
                          className="h-8 w-[7.25rem] px-2.5 text-[13px] tabular-nums"
                          value={window.close}
                          onChange={(e) => updateWindow(key, idx, "close", e.target.value)}
                        />
                        <button
                          type="button"
                          aria-label={`Remove window ${idx + 1} on ${label}`}
                          onClick={() => removeWindow(key, idx)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 self-start text-primary hover:bg-primary/10 hover:text-primary sm:mt-0.5"
                  onClick={() => addWindow(key)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add window
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Date overrides */}
      <Card className="p-0">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarX className="h-3.5 w-3.5" />
            </span>
            <CardTitle>Date overrides</CardTitle>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Close specific dates or set custom hours — vacations, holidays, special availability.
          </p>
        </div>

        <div className="border-b border-border/70 bg-muted/20 px-5 py-4">
          <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
            <div>
              <Label htmlFor="override-date">Date</Label>
              <Input
                id="override-date"
                type="date"
                className="h-9 w-40 text-[13px]"
                value={overrideDate}
                onChange={(e) => setOverrideDate(e.target.value)}
              />
            </div>
            <label className="flex h-9 cursor-pointer items-center gap-2 rounded-[10px] border border-border bg-card px-3 text-[13px] font-medium text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:bg-muted/60">
              <input
                type="checkbox"
                checked={overrideClosed}
                onChange={(e) => setOverrideClosed(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-[#6366f1]"
              />
              Closed all day
            </label>
            {!overrideClosed ? (
              <div className="flex items-end gap-2">
                <div>
                  <Label htmlFor="override-open">Open</Label>
                  <Input
                    id="override-open"
                    type="time"
                    className="h-9 w-[7.25rem] px-2.5 text-[13px] tabular-nums"
                    value={overrideOpen}
                    onChange={(e) => setOverrideOpen(e.target.value)}
                  />
                </div>
                <span className="pb-2 text-xs font-medium text-muted-foreground">to</span>
                <div>
                  <Label htmlFor="override-close">Close</Label>
                  <Input
                    id="override-close"
                    type="time"
                    className="h-9 w-[7.25rem] px-2.5 text-[13px] tabular-nums"
                    value={overrideClose}
                    onChange={(e) => setOverrideClose(e.target.value)}
                  />
                </div>
              </div>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={!overrideDate}
              onClick={addOverride}
            >
              <Plus className="h-3.5 w-3.5" />
              Add override
            </Button>
          </div>
        </div>

        {dateOverrides.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-6">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <CalendarX className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-medium text-foreground">No date overrides</p>
              <p className="text-xs text-muted-foreground">
                Your weekly hours apply to every date until you add one.
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border/70">
            {dateOverrides.map((o) => (
              <li
                key={o.date}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-card leading-none">
                    <span className="text-[9px] font-semibold uppercase text-muted-foreground">
                      {new Date(`${o.date}T12:00:00`).toLocaleDateString("en-US", { month: "short" })}
                    </span>
                    <span className="text-[13px] font-semibold tabular-nums text-foreground">
                      {new Date(`${o.date}T12:00:00`).getDate()}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground">
                      {formatOverrideDate(o.date)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {o.closed ? (
                        <span className="inline-flex items-center gap-1 text-danger">
                          <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                          Closed all day
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          {(o.windows || []).map((w) => `${w.open} – ${w.close}`).join(", ")}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-muted-foreground hover:text-danger"
                  onClick={() =>
                    setDateOverrides((prev) => prev.filter((x) => x.date !== o.date))
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Save bar */}
      <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
        <p className="text-xs text-muted-foreground">
          Changes apply immediately to all booking channels.
        </p>
        <div className="flex items-center gap-3">
          {saved ? (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-600">
              <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-3 w-3" />
              </span>
              Saved
            </span>
          ) : null}
          <Button disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save availability"}
          </Button>
        </div>
      </div>
    </div>
  );
}
