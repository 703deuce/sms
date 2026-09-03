"use client";

import { AppointmentStatusBadge, formatAppointmentWhen } from "@/components/appointments/appointment-ui";
import { lastCommunicationLabel } from "@/lib/appointments/types";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Scheduled Appointments</h1>
          <p className="mt-1 text-sm text-slate-500">Operational list of booked events.</p>
        </div>
        <Link href="/appointments/new">
          <Button>New Appointment</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              tab === t.id ? "border-sky-500 bg-sky-50 text-sky-900" : "border-slate-200 text-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        <Label htmlFor="search">Search</Label>
        <Input
          id="search"
          className="mt-1 max-w-md"
          placeholder="Name, phone, email, or service"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading appointments…</p>
      ) : rows.length === 0 ? (
        <Card className="rounded-xl border-dashed p-8 text-center">
          <p className="text-sm text-slate-500">No appointments match this view.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-xl border-slate-200">
          <div className="hidden grid-cols-[1.2fr_1fr_0.8fr_0.7fr_1fr_0.8fr] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 md:grid">
            <span>Date / time</span>
            <span>Customer</span>
            <span>Service</span>
            <span>Status</span>
            <span>Last communication</span>
            <span>Actions</span>
          </div>
          <div className="divide-y">
            {rows.map((row) => (
              <div
                key={row.id}
                className="grid gap-2 px-4 py-3 md:grid-cols-[1.2fr_1fr_0.8fr_0.7fr_1fr_0.8fr] md:items-center"
              >
                <div className="text-sm">{formatAppointmentWhen(row.startsAt, row.timezone)}</div>
                <div className="text-sm font-medium">{row.inviteeName || "Customer"}</div>
                <div className="text-sm text-slate-600">{row.serviceName || "Appointment"}</div>
                <div>
                  <AppointmentStatusBadge status={row.status} />
                </div>
                <div className="text-xs text-slate-500">
                  {lastCommunicationLabel(row.metadata) || row.reminderStatus || "—"}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/appointments/${row.id}`} className="text-xs text-sky-700 hover:underline">
                    Open
                  </Link>
                  {row.contact?.id ? (
                    <Link
                      href={`/conversations?contactId=${row.contact.id}`}
                      className="text-xs text-sky-700 hover:underline"
                    >
                      Message
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {grouped.length > 1 ? (
        <p className="text-xs text-slate-500">{rows.length} appointment(s) in this view.</p>
      ) : null}
    </div>
  );
}
