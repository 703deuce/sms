"use client";

import { AppointmentStatusBadge, formatAppointmentWhen } from "@/components/appointments/appointment-ui";
import type { AppointmentTimelineEvent } from "@/lib/appointments/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ReminderStep = { key: string; label: string; status: string };

type AppointmentDetail = {
  id: string;
  serviceName: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string | null;
  status: string;
  inviteeName: string | null;
  inviteeEmail: string | null;
  inviteePhone: string | null;
  reminderStatus: string | null;
  reminderSchedule?: ReminderStep[];
  metadata: {
    timeline?: AppointmentTimelineEvent[];
    notes?: string;
    smsConsent?: boolean;
  };
  contact?: { id: string } | null;
};

function reminderStatusLabel(status: string) {
  if (status === "sent") return "Sent";
  if (status === "failed") return "Failed";
  if (status === "scheduled") return "Scheduled";
  if (status === "disabled") return "Disabled";
  if (status === "skipped") return "Skipped";
  return status;
}

export function AppointmentDetailClient({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [appt, setAppt] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/appointments/${appointmentId}`);
    const json = await res.json();
    setAppt(json.data || null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [appointmentId]);

  async function patch(body: Record<string, unknown>) {
    setActing(true);
    await fetch(`/api/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setActing(false);
    await load();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading appointment…</p>;
  if (!appt) return <p className="text-sm text-rose-600">Appointment not found.</p>;

  const timeline = appt.metadata.timeline || [];
  const messageHref = appt.contact?.id
    ? `/conversations?contactId=${encodeURIComponent(appt.contact.id)}`
    : appt.inviteePhone
      ? `/conversations?phone=${encodeURIComponent(appt.inviteePhone)}`
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-semibold text-slate-900">
              {appt.inviteeName || "Customer"}
            </h1>
            <AppointmentStatusBadge status={appt.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {appt.serviceName || "Appointment"} · {formatAppointmentWhen(appt.startsAt, appt.timezone)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {messageHref ? (
            <Link href={messageHref}>
              <Button variant="outline">Message customer</Button>
            </Link>
          ) : null}
          {appt.status !== "confirmed" ? (
            <Button variant="outline" disabled={acting} onClick={() => patch({ status: "confirmed" })}>
              Mark confirmed
            </Button>
          ) : null}
          {appt.status !== "completed" ? (
            <Button variant="outline" disabled={acting} onClick={() => patch({ status: "completed" })}>
              Mark complete
            </Button>
          ) : null}
          {!["canceled", "cancelled"].includes(appt.status.toLowerCase()) ? (
            <Button variant="outline" disabled={acting} onClick={() => patch({ action: "cancel" })}>
              Cancel
            </Button>
          ) : null}
          {appt.contact?.id ? (
            <Link href={`/contacts/${appt.contact.id}`}>
              <Button variant="outline">View contact</Button>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-xl border-slate-200 p-4 lg:col-span-1">
          <h2 className="mb-3 font-semibold text-slate-900">Customer</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Phone</dt>
              <dd className="font-medium text-slate-900">{appt.inviteePhone || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium text-slate-900">{appt.inviteeEmail || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">SMS consent</dt>
              <dd className="font-medium text-slate-900">{appt.metadata.smsConsent ? "Yes" : "No"}</dd>
            </div>
            {appt.metadata.notes ? (
              <div>
                <dt className="text-slate-500">Notes</dt>
                <dd className="text-slate-900">{appt.metadata.notes}</dd>
              </div>
            ) : null}
          </dl>
        </Card>

        <Card className="rounded-xl border-slate-200 p-4 lg:col-span-1">
          <h2 className="mb-3 font-semibold text-slate-900">Reminder schedule</h2>
          {appt.reminderSchedule?.length ? (
            <ul className="space-y-2 text-sm">
              {appt.reminderSchedule.map((step) => (
                <li key={step.key} className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2">
                  <span>{step.label}</span>
                  <span className="text-xs font-medium text-slate-600">{reminderStatusLabel(step.status)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No reminder configuration.</p>
          )}
          {appt.reminderStatus === "failed" ? (
            <p className="mt-3 text-xs text-rose-600">A reminder failed to deliver — check timeline.</p>
          ) : null}
        </Card>

        <Card className="rounded-xl border-slate-200 p-4 lg:col-span-1">
          <h2 className="mb-3 font-semibold text-slate-900">Timeline</h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-slate-500">No activity yet.</p>
          ) : (
            <ol className="max-h-72 space-y-3 overflow-y-auto">
              {[...timeline].reverse().map((event, idx) => (
                <li key={`${event.at}-${idx}`} className="border-l-2 border-slate-200 pl-3">
                  <p className="text-sm font-medium text-slate-900">{event.label}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(event.at).toLocaleString()}
                    {event.detail ? ` · ${event.detail}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Button variant="ghost" onClick={() => router.push("/appointments")}>
        ← Back to scheduled list
      </Button>
    </div>
  );
}
