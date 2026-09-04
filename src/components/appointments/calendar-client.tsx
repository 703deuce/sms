"use client";

import {
  AppointmentStatusBadge,
  appointmentTone,
  formatAppointmentTime,
  formatAppointmentWhen,
} from "@/components/appointments/appointment-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Plus, X } from "lucide-react";
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

const VIEW_OPTIONS: Array<{ value: ViewMode; label: string }> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

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
    const count =
      view === "week"
        ? 7
        : new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
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
      list.sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
      map.set(key, list);
    }
    return map;
  }, [rows]);

  const title =
    view === "day"
      ? cursor.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : view === "week"
        ? `Week of ${cursor.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}`
        : cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  function shift(direction: -1 | 1) {
    setCursor((c) =>
      view === "day"
        ? addDays(c, direction)
        : view === "week"
          ? addDays(c, direction * 7)
          : new Date(c.getFullYear(), c.getMonth() + direction, 1),
    );
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
            Calendar
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{title}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Nav cluster */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCursor(startOfWeek(new Date()))}
            >
              Today
            </Button>
            <div className="flex items-center rounded-lg border border-border bg-card shadow-sm">
              <button
                type="button"
                aria-label="Previous"
                onClick={() => shift(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="h-4 w-px bg-border" aria-hidden />
              <button
                type="button"
                aria-label="Next"
                onClick={() => shift(1)}
                className="flex h-8 w-8 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Segmented view switcher */}
          <div
            role="tablist"
            aria-label="Calendar view"
            className="flex items-center rounded-lg border border-border bg-muted/60 p-0.5"
          >
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={view === opt.value}
                onClick={() => setView(opt.value)}
                className={cn(
                  "h-7 rounded-md px-3 text-[13px] font-semibold transition-all duration-150",
                  view === opt.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <Link href="/appointments/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New appointment
            </Button>
          </Link>
        </div>
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div
          className={cn(
            "grid gap-2.5",
            view === "week"
              ? "grid-cols-2 sm:grid-cols-4 md:grid-cols-7"
              : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7",
          )}
        >
          {days.map((day) => (
            <div
              key={day.toDateString()}
              className="min-h-[132px] animate-pulse rounded-xl border border-border bg-card/60 p-2.5"
            >
              <div className="h-3 w-14 rounded bg-muted" />
              <div className="mt-3 space-y-1.5">
                <div className="h-6 rounded-md bg-muted/70" />
                <div className="h-6 rounded-md bg-muted/50" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-2.5",
            view === "week"
              ? "grid-cols-2 sm:grid-cols-4 md:grid-cols-7"
              : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7",
          )}
        >
          {days.map((day) => {
            const key = day.toDateString();
            const items = byDay.get(key) || [];
            const isToday = key === new Date().toDateString();
            const isCurrentMonth =
              view !== "month" || day.getMonth() === cursor.getMonth();
            return (
              <div
                key={key}
                className={cn(
                  "group flex min-h-[132px] flex-col rounded-xl border bg-card p-2.5 transition-colors",
                  isToday
                    ? "border-primary/40 ring-1 ring-primary/25"
                    : "border-border",
                  !isCurrentMonth && "opacity-50",
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <p
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-wide",
                      isToday ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {day.toLocaleDateString(undefined, { weekday: "short" })}
                  </p>
                  <span
                    className={cn(
                      "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] font-semibold tabular-nums",
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground/80",
                    )}
                  >
                    {day.getDate()}
                  </span>
                </div>

                <div className="flex-1 space-y-1">
                  {items.slice(0, view === "day" ? 12 : 3).map((row) => {
                    const tone = appointmentTone(row.status);
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => setSelected(row)}
                        className={cn(
                          "block w-full truncate rounded-md border-l-2 bg-muted/50 px-2 py-1 text-left transition-colors hover:bg-muted",
                          tone.dot.replace("bg-", "border-"),
                        )}
                      >
                        <span className="block truncate text-[11px] font-medium leading-tight text-foreground">
                          <span className="tabular-nums text-muted-foreground">
                            {formatAppointmentTime(row.startsAt, row.timezone)}
                          </span>{" "}
                          {row.inviteeName || row.serviceName || "Appointment"}
                        </span>
                      </button>
                    );
                  })}
                  {items.length > (view === "day" ? 12 : 3) ? (
                    <p className="px-1 text-[10px] font-medium text-muted-foreground">
                      +{items.length - (view === "day" ? 12 : 3)} more
                    </p>
                  ) : null}
                  {items.length === 0 ? (
                    <div className="hidden h-full items-center justify-center pt-3 group-hover:flex">
                      <span className="text-[10px] font-medium text-muted-foreground/70">
                        No appointments
                      </span>
                    </div>
                  ) : null}
                </div>

                <Link
                  href={`/appointments/new?startsAt=${encodeURIComponent(
                    (() => {
                      const d = new Date(day);
                      d.setHours(9, 0, 0, 0);
                      return d.toISOString();
                    })(),
                  )}`}
                  className="mt-2 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[11px] font-medium text-primary opacity-0 transition-opacity hover:bg-primary/5 group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Range list */}
      {!loading && rows.length > 0 ? (
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 className="font-display text-sm font-semibold tracking-tight text-foreground">
              In this range
            </h2>
            <span className="text-xs tabular-nums text-muted-foreground">
              {rows.length} appointment{rows.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="divide-y divide-border/70">
            {rows.slice(0, 12).map((row) => {
              const tone = appointmentTone(row.status);
              return (
                <li key={row.id}>
                  <Link
                    href={`/appointments/${row.id}`}
                    className="flex items-center gap-3 px-5 py-3 no-underline transition-colors hover:bg-muted/40"
                  >
                    <span
                      className={cn("h-8 w-1 shrink-0 rounded-full", tone.dot)}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {row.inviteeName || "Customer"}
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {row.serviceName || "Appointment"}
                        </span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" aria-hidden />
                        {formatAppointmentWhen(row.startsAt, row.timezone)}
                      </p>
                    </div>
                    <AppointmentStatusBadge status={row.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
          {rows.length > 12 ? (
            <p className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground">
              Showing 12 of {rows.length} appointments in this range.
            </p>
          ) : null}
        </Card>
      ) : null}

      {!loading && rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
          <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays className="h-5 w-5" />
          </div>
          <h3 className="font-display text-sm font-semibold text-foreground">
            No appointments in this range
          </h3>
          <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
            Nothing is scheduled here yet. Create an appointment to fill this
            time.
          </p>
          <Link href="/appointments/new" className="mt-5">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New appointment
            </Button>
          </Link>
        </div>
      ) : null}

      {/* Detail modal */}
      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
          onClick={() => setSelected(null)}
        >
          <Card
            className="w-full max-w-md p-0 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate font-display text-[15px] font-semibold tracking-tight text-foreground">
                  {selected.inviteeName || "Customer"}
                </h2>
                <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                  {selected.serviceName || "Appointment"}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSelected(null)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div className="flex items-center gap-2 text-[13px] text-foreground">
                <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
                {formatAppointmentWhen(selected.startsAt, selected.timezone)}
              </div>
              <AppointmentStatusBadge status={selected.status} />
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border bg-muted/30 px-5 py-3.5">
              <Link href={`/appointments/${selected.id}`}>
                <Button size="sm">Open details</Button>
              </Link>
              <Link
                href={`/appointments/new?startsAt=${encodeURIComponent(selected.startsAt)}`}
              >
                <Button variant="outline" size="sm">
                  Reschedule
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
