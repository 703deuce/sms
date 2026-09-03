"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { useEffect, useState } from "react";

type TimeWindow = { open: string; close: string };
type DateOverride = { date: string; closed?: boolean; windows?: TimeWindow[] };

const DAY_LABELS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
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
    setDateOverrides((prev) => [...prev.filter((o) => o.date !== overrideDate), entry]);
    setOverrideDate("");
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading availability…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Availability</h1>
        <p className="mt-1 text-sm text-slate-500">
          Control when customers can book. Public booking, manual booking, and slot validation all use
          these hours.
        </p>
      </div>

      <Card className="rounded-xl border-slate-200 p-4">
        <h2 className="mb-4 font-semibold text-slate-900">Booking rules</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="notice">Minimum notice (minutes)</Label>
            <Input
              id="notice"
              type="number"
              value={minimumNotice}
              onChange={(e) => setMinimumNotice(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label htmlFor="horizon">Maximum days ahead</Label>
            <Input
              id="horizon"
              type="number"
              value={maximumDays}
              onChange={(e) => setMaximumDays(Number(e.target.value) || 14)}
            />
          </div>
        </div>
      </Card>

      <Card className="rounded-xl border-slate-200 p-4">
        <h2 className="mb-4 font-semibold text-slate-900">Weekly hours</h2>
        <div className="space-y-4">
          {DAY_LABELS.map(({ key, label }) => (
            <div key={key} className="border-b border-slate-100 pb-4 last:border-0">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium text-slate-900">{label}</p>
                <Button variant="outline" size="sm" onClick={() => addWindow(key)}>
                  Add window
                </Button>
              </div>
              {(weeklyHours[key] || []).length === 0 ? (
                <p className="text-sm text-slate-500">Closed</p>
              ) : (
                (weeklyHours[key] || []).map((window, idx) => (
                  <div key={`${key}-${idx}`} className="mb-2 flex flex-wrap items-center gap-2">
                    <Input
                      className="w-28"
                      value={window.open}
                      onChange={(e) => updateWindow(key, idx, "open", e.target.value)}
                      placeholder="09:00"
                    />
                    <span className="text-slate-500">to</span>
                    <Input
                      className="w-28"
                      value={window.close}
                      onChange={(e) => updateWindow(key, idx, "close", e.target.value)}
                      placeholder="17:00"
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeWindow(key, idx)}>
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="rounded-xl border-slate-200 p-4">
        <h2 className="mb-4 font-semibold text-slate-900">Date overrides</h2>
        <p className="mb-3 text-sm text-slate-500">
          Close specific dates or set custom hours (vacations, holidays, special availability).
        </p>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="override-date">Date</Label>
            <Input
              id="override-date"
              type="date"
              value={overrideDate}
              onChange={(e) => setOverrideDate(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={overrideClosed}
              onChange={(e) => setOverrideClosed(e.target.checked)}
            />
            Closed all day
          </label>
          {!overrideClosed ? (
            <>
              <Input className="w-28" value={overrideOpen} onChange={(e) => setOverrideOpen(e.target.value)} />
              <span>to</span>
              <Input className="w-28" value={overrideClose} onChange={(e) => setOverrideClose(e.target.value)} />
            </>
          ) : null}
          <Button variant="outline" onClick={addOverride}>
            Add override
          </Button>
        </div>
        {dateOverrides.length === 0 ? (
          <p className="text-sm text-slate-500">No date overrides yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {dateOverrides.map((o) => (
              <li key={o.date} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                <span>
                  {o.date}:{" "}
                  {o.closed
                    ? "Closed"
                    : (o.windows || []).map((w) => `${w.open}–${w.close}`).join(", ")}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDateOverrides((prev) => prev.filter((x) => x.date !== o.date))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex items-center gap-3">
        <Button disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save availability"}
        </Button>
        {saved ? <span className="text-sm text-emerald-600">Saved</span> : null}
      </div>
    </div>
  );
}
