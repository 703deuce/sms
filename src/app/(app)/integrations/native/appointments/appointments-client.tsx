"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Appt = {
  id: string;
  serviceName: string | null;
  startsAt: string;
  endsAt: string | null;
  status: string;
  contactId: string | null;
  externalId: string | null;
  provider: string | null;
  inviteeName: string | null;
  inviteeEmail: string | null;
  cancelUrl?: string | null;
  rescheduleUrl?: string | null;
  eventTypeId?: string | null;
};

export function AppointmentsClient() {
  const [rows, setRows] = useState<Appt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");

  useEffect(() => {
    fetch("/api/integrations/native/appointments")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setRows(j.data?.appointments || []);
      })
      .catch(() => setError("Failed to load appointments"));
  }, []);

  const filtered = useMemo(() => {
    const now = Date.now();
    return rows.filter((a) => {
      const t = new Date(a.startsAt).getTime();
      if (filter === "upcoming") return t >= now && !/cancel/i.test(a.status);
      if (filter === "past") return t < now || /cancel|complete/i.test(a.status);
      return true;
    });
  }, [rows, filter]);

  return (
    <div>
      <PageHeader
        title="Appointments"
        description="Calendly bookings synced for SMS reminders, call context, CRM linking, and automations."
      />
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/integrations/native/calendly" className="underline">
          Calendly connection
        </Link>
        <Link href="/automations/templates" className="underline">
          Booking automation templates
        </Link>
        <div className="ml-auto flex gap-2">
          {(["upcoming", "past", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`rounded-lg border px-2.5 py-1 text-xs capitalize ${
                filter === f ? "border-primary bg-muted" : "border-border"
              }`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="space-y-3">
        {filtered.map((a) => {
          const metaCancel = a.cancelUrl;
          const metaReschedule = a.rescheduleUrl;
          return (
            <Card key={a.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{a.serviceName || "Appointment"}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {a.provider || "calendly"} · {new Date(a.startsAt).toLocaleString()}
                    {a.endsAt ? ` – ${new Date(a.endsAt).toLocaleString()}` : ""}
                  </p>
                </div>
                <StatusChip status={a.status} />
              </div>
              <p className="mt-2 text-sm">
                {a.inviteeName || "Invitee"}
                {a.inviteeEmail ? ` · ${a.inviteeEmail}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                {a.contactId ? (
                  <Link href={`/contacts/${a.contactId}`} className="underline">
                    Open contact
                  </Link>
                ) : null}
                {a.contactId ? (
                  <Link href={`/inbox?contactId=${a.contactId}`} className="underline">
                    SMS conversation
                  </Link>
                ) : null}
                {metaReschedule ? (
                  <a href={metaReschedule} target="_blank" rel="noreferrer" className="underline">
                    Reschedule link
                  </a>
                ) : null}
                {metaCancel ? (
                  <a href={metaCancel} target="_blank" rel="noreferrer" className="underline">
                    Cancel link
                  </a>
                ) : null}
                {a.externalId ? (
                  <span className="text-xs text-muted-foreground">
                    External: {a.externalId.replace(/^calendly:/, "").slice(0, 48)}
                  </span>
                ) : null}
              </div>
            </Card>
          );
        })}
        {!filtered.length && !error ? (
          <p className="text-sm text-muted-foreground">
            No appointments in this view. Connect Calendly, sync, or create a booking.
          </p>
        ) : null}
      </div>
    </div>
  );
}
