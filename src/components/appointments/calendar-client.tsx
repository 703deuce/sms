"use client";

import { AppointmentStatusBadge, formatAppointmentWhen } from "@/components/appointments/appointment-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ViewMode = "day" | "week" | "month";

type AppointmentRow = {
  id: string;
  inviteeName: string | null;
  serviceName: string | null;
  startsAt: string;
  status: string;
  timezone: string | null;
};

function startOfWeek(d: Date) {
  const copy = new Date(d);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, days: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function AppointmentsCalendarClient() {
  const [cursor, setCursor] = useState(() => startOfWeek(new Date()));
  const [view, setView] = useState<ViewMode>("week");
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AppointmentRow | null>(null);

  const range = useMemo(() => {
    if (view === "day") {
      const from = new Date(cursor);
      from.setHours(0, 0, 0, 0);
      const to = new Date(cursor);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    }
    if (view === "week") {
      return { from: cursor, to: addDays(cursor, 7) };
    }
    const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from, to };
  }, [cursor, view]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    });
    fetch(`/api/appointments?${params}`)
      .then((r) => r.json())
      .then((json) => setRows(json.data || []))
      .finally(() => setLoading(false));
  }, [range.from, range.to]);

  const days = useMemo(() => {
    if (view === "day") return [cursor];
    const count = view === "week" ? 7 : new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const start =
      view === "week" ? cursor : new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    return Array.from({ length: count }, (_, i) => addDays(start, i));
  }, [cursor, view]);

  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();
    for (const row of rows) {
      const key = new Date(row.startsAt).toDateString();
      const list = map.get(key) || [];
      list.push(row);
      map.set(key, list);
    }
    for (const [key, list] of map) {
      list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
      map.set(key, list);
    }
    return map;
  }, [rows]);

  const title =
    view === "day"
      ? cursor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : view === "week"
      ? `Week of ${cursor.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
      : cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Calendar</h1>
          <p className="mt-1 text-sm text-slate-500">{title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setCursor(startOfWeek(new Date()))}>
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCursor((c) =>
                view === "day"
                  ? addDays(c, -1)
                  : view === "week"
                    ? addDays(c, -7)
                    : new Date(c.getFullYear(), c.getMonth() - 1, 1),
              )
            }
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCursor((c) =>
                view === "day"
                  ? addDays(c, 1)
                  : view === "week"
                    ? addDays(c, 7)
                    : new Date(c.getFullYear(), c.getMonth() + 1, 1),
              )
            }
          >
            Next
          </Button>
          <Button variant={view === "day" ? "default" : "outline"} size="sm" onClick={() => setView("day")}>
            Day
          </Button>
          <Button variant={view === "week" ? "default" : "outline"} size="sm" onClick={() => setView("week")}>
            Week
          </Button>
          <Button variant={view === "month" ? "default" : "outline"} size="sm" onClick={() => setView("month")}>
            Month
          </Button>
          <Link href="/appointments/new">
            <Button size="sm">New</Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading calendar…</p>
      ) : (
        <div
          className={
            view === "week"
              ? "grid gap-3 md:grid-cols-7"
              : "grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7"
          }
        >
          {days.map((day) => {
            const key = day.toDateString();
            const items = byDay.get(key) || [];
            const isToday = key === new Date().toDateString();
            return (
              <Card
                key={key}
                className={`min-h-[120px] rounded-xl border-slate-200 p-2 ${isToday ? "ring-2 ring-sky-200" : ""}`}
              >
                <p className="mb-2 text-xs font-semibold text-slate-500">
                  {day.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
                </p>
                <Link
                  href={`/appointments/new?startsAt=${encodeURIComponent(
                    (() => {
                      const d = new Date(day);
                      d.setHours(9, 0, 0, 0);
                      return d.toISOString();
                    })(),
                  )}`}
                  className="mb-2 block text-[10px] text-sky-700 hover:underline"
                >
                  + New appointment
                </Link>
                <div className="space-y-1">
                  {items.slice(0, 4).map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelected(row)}
                      className="block w-full rounded-md bg-sky-50 px-2 py-1 text-left text-[11px] hover:bg-sky-100"
                    >
                      <span className="font-medium text-sky-900">
                        {new Date(row.startsAt).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                          timeZone: row.timezone || undefined,
                        })}
                      </span>
                      <span className="block truncate text-sky-800">
                        {row.inviteeName || row.serviceName || "Appt"}
                      </span>
                    </button>
                  ))}
                  {items.length > 4 ? (
                    <p className="px-1 text-[10px] text-slate-500">+{items.length - 4} more</p>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {rows.length > 0 ? (
        <Card className="rounded-xl border-slate-200 p-4">
          <h2 className="mb-3 font-semibold text-slate-900">In this range</h2>
          <div className="space-y-2">
            {rows.slice(0, 12).map((row) => (
              <Link
                key={row.id}
                href={`/appointments/${row.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 no-underline hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {row.inviteeName || "Customer"} · {row.serviceName || "Appointment"}
                  </p>
                  <p className="text-xs text-slate-500">{formatAppointmentWhen(row.startsAt, row.timezone)}</p>
                </div>
                <AppointmentStatusBadge status={row.status} />
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <Card className="w-full max-w-md rounded-xl border-slate-200 p-4 shadow-lg">
            <h2 className="font-semibold text-slate-900">
              {selected.inviteeName || "Customer"} · {selected.serviceName || "Appointment"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {formatAppointmentWhen(selected.startsAt, selected.timezone)}
            </p>
            <div className="mt-3">
              <AppointmentStatusBadge status={selected.status} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/appointments/${selected.id}`}>
                <Button size="sm">Open details</Button>
              </Link>
              <Link href={`/appointments/new?startsAt=${encodeURIComponent(selected.startsAt)}`}>
                <Button variant="outline" size="sm">
                  Reschedule
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
