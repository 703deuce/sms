"use client";

import {
  AppointmentStatusBadge,
  formatAppointmentDay,
  formatAppointmentTime,
} from "@/components/appointments/appointment-ui";
import { lastCommunicationLabel } from "@/lib/appointments/types";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { cn, formatPhone } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CalendarPlus,
  CalendarX2,
  ChevronRight,
  MessageSquare,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AppointmentRow = {
  id: string;
  inviteeName: string | null;
  serviceName: string | null;
  startsAt: string;
  status: string;
  timezone: string | null;
  inviteePhone: string | null;
  reminderStatus: string | null;
  metadata: AppointmentMetadata;
  contact?: { id: string } | null;
};

const TABS = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "awaiting_confirmation", label: "Awaiting" },
  { id: "confirmed", label: "Confirmed" },
  { id: "reschedule_requested", label: "Reschedule" },
  { id: "canceled", label: "Canceled" },
  { id: "past", label: "Past" },
  { id: "all", label: "All" },
] as const;

function tabQuery(tab: string) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const params = new URLSearchParams();
  if (tab === "today") {
    params.set("from", startOfDay.toISOString());
    params.set("to", endOfDay.toISOString());
  } else if (tab === "upcoming") {
    params.set("from", now.toISOString());
  } else if (tab === "past") {
    params.set("to", now.toISOString());
  } else if (tab !== "all") {
    params.set("status", tab);
  }
  return params;
}

function initials(name: string | null) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

const GRID_COLS =
  "md:grid-cols-[minmax(150px,1.1fr)_minmax(170px,1.2fr)_minmax(120px,0.9fr)_minmax(120px,0.9fr)_minmax(140px,1fr)_minmax(110px,0.7fr)]";

export function AppointmentsListClient() {
  const [tab, setTab] = useState<string>("upcoming");
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = tabQuery(tab);
    if (q.trim()) params.set("q", q.trim());
    fetch(`/api/appointments?${params}`)
      .then((r) => r.json())
      .then((json) => setRows(json.data || []))
      .finally(() => setLoading(false));
  }, [tab, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();
    for (const row of rows) {
      const key = new Date(row.startsAt).toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
        timeZone: row.timezone || undefined,
      });
      const list = map.get(key) || [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [rows]);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
            Scheduled Appointments
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Operational list of booked events and their reminder status.
          </p>
        </div>
        <Link href="/appointments/new" className="shrink-0">
          <Button>
            <CalendarPlus className="h-4 w-4" />
            New Appointment
          </Button>
        </Link>
      </div>

      {/* Filters: tabs + search */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="flex flex-wrap items-center gap-1 rounded-xl bg-muted/60 p-1"
          role="tablist"
          aria-label="Appointment filters"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab === t.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative w-full lg:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
            aria-hidden
          />
          <Input
            id="search"
            type="search"
            aria-label="Search appointments"
            className="h-9 pl-9"
            placeholder="Name, phone, email, or service"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="surface overflow-hidden rounded-xl bg-card">
          <div className="divide-y divide-border/70">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={cn("grid animate-pulse items-center gap-4 px-4 py-3.5", GRID_COLS)}
              >
                <div className="space-y-1.5">
                  <div className="h-3 w-24 rounded bg-muted" />
                  <div className="h-3 w-16 rounded bg-muted" />
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-muted" />
                  <div className="h-3 w-28 rounded bg-muted" />
                </div>
                <div className="h-3 w-20 rounded bg-muted" />
                <div className="h-5 w-24 rounded-full bg-muted" />
                <div className="h-3 w-24 rounded bg-muted" />
                <div className="h-3 w-14 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<CalendarX2 className="h-5 w-5" />}
          title="No appointments found"
          description={
            q.trim()
              ? "No appointments match your search in this view. Try a different filter or clear the search."
              : "There are no appointments in this view yet. Book your first appointment to get started."
          }
          actionLabel="New Appointment"
          actionHref="/appointments/new"
        />
      ) : (
        <div className="surface overflow-hidden rounded-xl bg-card">
          {/* Table header */}
          <div
            className={cn(
              "hidden gap-3 border-b border-border bg-muted/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid",
              GRID_COLS,
            )}
          >
            <span>Date / time</span>
            <span>Customer</span>
            <span>Service</span>
            <span>Status</span>
            <span>Last communication</span>
            <span className="text-right">Actions</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border/70">
            {rows.map((row) => (
              <div
                key={row.id}
                className={cn(
                  "group relative grid gap-2 px-4 py-3.5 transition-colors hover:bg-muted/40 md:items-center md:gap-3",
                  GRID_COLS,
                )}
              >
                {/* Date / time */}
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-tight text-foreground">
                    {formatAppointmentDay(row.startsAt, row.timezone)}
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                    {formatAppointmentTime(row.startsAt, row.timezone)}
                  </p>
                </div>

                {/* Customer */}
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary"
                    aria-hidden
                  >
                    {initials(row.inviteeName)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
                      {row.inviteeName || "Customer"}
                    </p>
                    {row.inviteePhone ? (
                      <p className="mt-0.5 truncate text-xs tabular-nums text-muted-foreground">
                        {formatPhone(row.inviteePhone)}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Service */}
                <div className="min-w-0 truncate text-[13px] text-foreground/80">
                  {row.serviceName || "Appointment"}
                </div>

                {/* Status */}
                <div>
                  <AppointmentStatusBadge status={row.status} />
                </div>

                {/* Last communication */}
                <div className="min-w-0 truncate text-xs text-muted-foreground">
                  {lastCommunicationLabel(row.metadata) || row.reminderStatus || "—"}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 md:justify-end">
                  <Link
                    href={`/appointments/${row.id}`}
                    className="inline-flex h-7 items-center gap-0.5 rounded-md px-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    Open
                    <ChevronRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                  </Link>
                  {row.contact?.id ? (
                    <Link
                      href={`/conversations?contactId=${row.contact.id}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Message customer"
                      aria-label="Message customer"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {/* Footer count */}
          <div className="border-t border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
            {rows.length} appointment{rows.length === 1 ? "" : "s"} in this view
            {grouped.length > 1 ? ` across ${grouped.length} days` : ""}
          </div>
        </div>
      )}
    </div>
  );
}
