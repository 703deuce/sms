"use client";

import {
  AppointmentStatusBadge,
  formatAppointmentDate,
  formatAppointmentTime,
} from "@/components/appointments/appointment-ui";
import type { AppointmentTimelineEvent } from "@/lib/appointments/types";
import { formatPhone } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  ArrowLeft,
  Bell,
  BellOff,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  StickyNote,
  User,
  XCircle,
} from "lucide-react";
import { NotetakerPanel } from "@/components/meetings/notetaker-panel";
import { VideoMeetingPanel } from "@/components/video/video-meeting-panel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ReminderStep = { key: string; label: string; status: string };

type AppointmentDetail = {
  id: string;
  serviceName: string | null;
  staffName: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string | null;
  status: string;
  externalId: string | null;
  inviteeName: string | null;
  inviteeEmail: string | null;
  inviteePhone: string | null;
  reminderStatus: string | null;
  reminderSchedule?: ReminderStep[];
  metadata: {
    timeline?: AppointmentTimelineEvent[];
    notes?: string;
    smsConsent?: boolean;
    bookingAnswers?: Record<string, string>;
    internalNotes?: Array<{ id: string; at: string; authorName?: string; body: string }>;
    paymentStatus?: string;
    paymentAmountCents?: number;
    recurringSeriesId?: string;
    recurringOccurrenceIndex?: number;
    location?: string;
    locationId?: string;
    staffId?: string;
    attendeeCount?: number;
  };
  contact?: { id: string } | null;
};

const reminderToneMap: Record<string, string> = {
  sent: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  failed: "bg-rose-50 text-rose-700 ring-rose-600/20",
  scheduled: "bg-sky-50 text-sky-800 ring-sky-600/20",
  disabled: "bg-slate-100 text-slate-600 ring-slate-500/20",
  skipped: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

function reminderStatusLabel(status: string) {
  if (status === "sent") return "Sent";
  if (status === "failed") return "Failed";
  if (status === "scheduled") return "Scheduled";
  if (status === "disabled") return "Disabled";
  if (status === "skipped") return "Skipped";
  return status;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function AppointmentDetailClient({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [appt, setAppt] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [internalNote, setInternalNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleSlots, setRescheduleSlots] = useState<Array<{ startsAt: string; endsAt: string }>>(
    [],
  );
  const [rescheduleSlot, setRescheduleSlot] = useState("");
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState("");

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

  const [refunding, setRefunding] = useState(false);

  async function refundPayment() {
    setRefunding(true);
    const res = await fetch("/api/merchant-payments/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId }),
    });
    setRefunding(false);
    if (res.ok) await load();
  }

  async function addNote() {
    if (!internalNote.trim()) return;
    setAddingNote(true);
    await fetch(`/api/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ internalNote }),
    });
    setInternalNote("");
    setAddingNote(false);
    await load();
  }

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

  async function openReschedule() {
    if (!appt?.serviceName) return;
    setRescheduleOpen(true);
    setRescheduleError("");
    setRescheduleSlot("");
    setLoadingRescheduleSlots(true);
    try {
      const res = await fetch(
        `/api/appointments/availability?serviceName=${encodeURIComponent(appt.serviceName)}&daysAhead=14`,
      );
      const json = await res.json();
      setRescheduleSlots(json.data?.slots || []);
    } finally {
      setLoadingRescheduleSlots(false);
    }
  }

  async function saveReschedule() {
    if (!rescheduleSlot) {
      setRescheduleError("Select a new time slot.");
      return;
    }
    setRescheduling(true);
    setRescheduleError("");
    const res = await fetch(`/api/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startsAt: rescheduleSlot }),
    });
    const json = await res.json().catch(() => ({}));
    setRescheduling(false);
    if (!res.ok) {
      setRescheduleError(json.error || "Could not reschedule");
      return;
    }
    setRescheduleOpen(false);
    await load();
  }

  function externalCalendarLabel(externalId: string | null | undefined) {
    if (!externalId) return null;
    if (externalId.startsWith("microsoft:")) return `Microsoft · ${externalId.replace("microsoft:", "")}`;
    if (externalId.startsWith("google:")) return `Google · ${externalId.replace("google:", "")}`;
    if (externalId.startsWith("calendly:")) return `Calendly · ${externalId.replace("calendly:", "")}`;
    return externalId;
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Loading appointment…</p>
      </div>
    );
  }

  if (!appt) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
          <XCircle className="h-5 w-5" />
        </div>
        <div>
          <p className="font-display text-sm font-semibold text-foreground">Appointment not found</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            It may have been deleted, or the link is invalid.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push("/appointments")}>
          Back to appointments
        </Button>
      </div>
    );
  }

  const timeline = appt.metadata.timeline || [];
  const bookingAnswers = appt.metadata.bookingAnswers || {};
  const internalNotes = appt.metadata.internalNotes || [];
  const name = appt.inviteeName || "Customer";
  const isCanceled = ["canceled", "cancelled"].includes(appt.status.toLowerCase());
  const messageHref = appt.contact?.id
    ? `/conversations?contactId=${encodeURIComponent(appt.contact.id)}`
    : appt.inviteePhone
      ? `/conversations?phone=${encodeURIComponent(appt.inviteePhone)}`
      : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Breadcrumb / back */}
      <button
        onClick={() => router.push("/appointments")}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to appointments
      </button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-semibold text-primary">
            {initials(name) || <User className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">
                {name}
              </h1>
              <AppointmentStatusBadge status={appt.status} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {appt.serviceName || "Appointment"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {formatAppointmentDate(appt.startsAt, appt.timezone)} ·{" "}
                {formatAppointmentTime(appt.startsAt, appt.timezone)}
                {appt.endsAt ? ` – ${formatAppointmentTime(appt.endsAt, appt.timezone)}` : ""}
              </span>
              {appt.timezone ? (
                <span className="text-muted-foreground/70">{appt.timezone}</span>
              ) : null}
              {appt.staffName ? (
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  {appt.staffName}
                </span>
              ) : null}
              {appt.metadata.location ? (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {appt.metadata.location}
                </span>
              ) : null}
              {appt.metadata.recurringSeriesId ? (
                <span className="text-primary">
                  Recurring #{appt.metadata.recurringOccurrenceIndex || "?"}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {messageHref ? (
            <Link href={messageHref}>
              <Button size="sm">
                <MessageSquare className="h-4 w-4" />
                Message
              </Button>
            </Link>
          ) : null}
          {appt.status !== "confirmed" && !isCanceled ? (
            <Button
              variant="outline"
              size="sm"
              disabled={acting}
              onClick={() => patch({ status: "confirmed" })}
            >
              Mark confirmed
            </Button>
          ) : null}
          {appt.status !== "completed" && !isCanceled ? (
            <Button
              variant="outline"
              size="sm"
              disabled={acting}
              onClick={() => patch({ status: "completed" })}
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark complete
            </Button>
          ) : null}
          {!isCanceled ? (
            <Button
              variant="outline"
              size="sm"
              disabled={acting}
              onClick={openReschedule}
            >
              <Calendar className="h-4 w-4" />
              Reschedule
            </Button>
          ) : null}
          {!isCanceled ? (
            <Button
              variant="outline"
              size="sm"
              disabled={acting}
              className="text-danger hover:bg-danger/5"
              onClick={() => patch({ action: "cancel" })}
            >
              Cancel
            </Button>
          ) : null}
          {appt.contact?.id ? (
            <Link href={`/contacts/${appt.contact.id}`}>
              <Button variant="ghost" size="sm">
                View contact
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      {rescheduleOpen ? (
        <Card className="border-primary/20 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <CardTitle>Reschedule appointment</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setRescheduleOpen(false)}>
              Close
            </Button>
          </div>
          <p className="mb-4 text-[13px] text-muted-foreground">
            Pick a new time. Reminders reset and linked calendar events update in place.
          </p>
          {loadingRescheduleSlots ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading available times…
            </div>
          ) : rescheduleSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open slots in the next 14 days.</p>
          ) : (
            <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {rescheduleSlots.map((slot) => (
                <button
                  key={slot.startsAt}
                  type="button"
                  onClick={() => setRescheduleSlot(slot.startsAt)}
                  className={`rounded-lg border px-3 py-2 text-left text-[13px] transition-colors ${
                    rescheduleSlot === slot.startsAt
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  {formatAppointmentDate(slot.startsAt, appt.timezone)}
                  <span className="block text-muted-foreground">
                    {formatAppointmentTime(slot.startsAt, appt.timezone)}
                  </span>
                </button>
              ))}
            </div>
          )}
          {rescheduleError ? (
            <p className="mt-3 text-sm font-medium text-rose-600">{rescheduleError}</p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <Button size="sm" disabled={rescheduling || !rescheduleSlot} onClick={saveReschedule}>
              {rescheduling ? "Saving…" : "Save new time"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRescheduleOpen(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      {/* Content grid */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Customer */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>Customer</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <dl className="space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <dt className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                Phone
              </dt>
              <dd className="text-[13px] font-medium tabular-nums text-foreground">
                {appt.inviteePhone ? formatPhone(appt.inviteePhone) : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                Email
              </dt>
              <dd className="truncate text-[13px] font-medium text-foreground">
                {appt.inviteeEmail || "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                SMS consent
              </dt>
              <dd>
                <span
                  className={
                    appt.metadata.smsConsent
                      ? "inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                      : "inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-500/20"
                  }
                >
                  {appt.metadata.smsConsent ? "Opted in" : "Not opted in"}
                </span>
              </dd>
            </div>
          </dl>
          {appt.metadata.notes ? (
            <div className="mt-4 rounded-lg bg-muted/40 p-3">
              <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <StickyNote className="h-3 w-3" />
                Customer notes
              </p>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
                {appt.metadata.notes}
              </p>
            </div>
          ) : null}
          {Object.keys(bookingAnswers).length > 0 ? (
            <div className="mt-4 rounded-lg border border-border/70 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Booking answers
              </p>
              <dl className="space-y-2">
                {Object.entries(bookingAnswers).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-3 text-[13px]">
                    <dt className="text-muted-foreground">{key}</dt>
                    <dd className="font-medium text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
          {appt.metadata.paymentStatus ? (
            <div className="mt-4 rounded-lg bg-muted/40 p-3 text-[13px] space-y-2">
              <p className="font-semibold">
                Payment: {appt.metadata.paymentStatus}
                {appt.metadata.paymentProvider ? ` via ${appt.metadata.paymentProvider}` : ""}
              </p>
              {appt.metadata.totalPriceCents ? (
                <p className="text-muted-foreground">
                  Service price: ${(appt.metadata.totalPriceCents / 100).toFixed(2)}
                </p>
              ) : null}
              {appt.metadata.paymentAmountCents ? (
                <p className="text-muted-foreground">
                  Amount paid: ${(appt.metadata.paymentAmountCents / 100).toFixed(2)}
                </p>
              ) : null}
              {appt.metadata.balanceDueCents ? (
                <p className="text-muted-foreground">
                  Balance due: ${(appt.metadata.balanceDueCents / 100).toFixed(2)}
                </p>
              ) : null}
              {appt.metadata.refundStatus ? (
                <p className="text-muted-foreground">Refund: {appt.metadata.refundStatus}</p>
              ) : null}
              {appt.metadata.paymentStatus === "succeeded" && !appt.metadata.refundStatus ? (
                <Button size="sm" variant="outline" disabled={refunding || acting} onClick={refundPayment}>
                  {refunding ? "Refunding…" : "Refund payment"}
                </Button>
              ) : null}
            </div>
          ) : null}
        </Card>

        {/* Internal notes */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>Internal notes</CardTitle>
            <StickyNote className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mb-3 text-[12px] text-muted-foreground">
            Staff-only notes — never shown to customers.
          </p>
          {internalNotes.length > 0 ? (
            <ul className="mb-4 max-h-48 space-y-3 overflow-y-auto">
              {[...internalNotes].reverse().map((note) => (
                <li key={note.id} className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
                  <p className="text-[13px] whitespace-pre-wrap">{note.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {note.authorName || "Staff"} · {new Date(note.at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-[13px] text-muted-foreground">No internal notes yet.</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="internal-note">Add note</Label>
            <Textarea
              id="internal-note"
              rows={3}
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder="Add a private staff note…"
            />
            <Button size="sm" disabled={addingNote || !internalNote.trim()} onClick={addNote}>
              {addingNote ? "Saving…" : "Add note"}
            </Button>
          </div>
        </Card>

        {/* Reminders */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>Reminders</CardTitle>
            {appt.reminderSchedule?.length ? (
              <Bell className="h-4 w-4 text-muted-foreground" />
            ) : (
              <BellOff className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          {appt.reminderSchedule?.length ? (
            <ul className="space-y-2">
              {appt.reminderSchedule.map((step) => (
                <li
                  key={step.key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5"
                >
                  <span className="text-[13px] font-medium text-foreground">{step.label}</span>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                      reminderToneMap[step.status] ||
                      "bg-slate-100 text-slate-600 ring-slate-500/20"
                    }`}
                  >
                    {reminderStatusLabel(step.status)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
              <BellOff className="mb-2 h-5 w-5 text-muted-foreground" />
              <p className="text-[13px] font-medium text-foreground">No reminders configured</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Enable reminders in Reminder Settings.
              </p>
            </div>
          )}
          {appt.reminderStatus === "failed" ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20">
              <XCircle className="h-3.5 w-3.5" />
              A reminder failed to deliver — check the timeline.
            </p>
          ) : null}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>Calendar sync</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          {appt.externalId ? (
            <p className="text-[13px] font-medium text-foreground">
              {externalCalendarLabel(appt.externalId)}
            </p>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              No external calendar event linked yet.
            </p>
          )}
        </Card>

        <NotetakerPanel appointmentId={appt.id} />
        <VideoMeetingPanel appointmentId={appt.id} />

        {/* Timeline */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>Timeline</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          {timeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
              <Clock className="mb-2 h-5 w-5 text-muted-foreground" />
              <p className="text-[13px] font-medium text-foreground">No activity yet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Booking and reminder events will appear here.
              </p>
            </div>
          ) : (
            <ol className="relative max-h-80 space-y-4 overflow-y-auto pr-1 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-px before:bg-border">
              {[...timeline].reverse().map((event, idx) => (
                <li key={`${event.at}-${idx}`} className="relative pl-5">
                  <span className="absolute left-0 top-[5px] h-[11px] w-[11px] rounded-full border-2 border-card bg-primary" />
                  <p className="text-[13px] font-medium leading-snug text-foreground">
                    {event.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(event.at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {event.detail ? ` · ${event.detail}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
