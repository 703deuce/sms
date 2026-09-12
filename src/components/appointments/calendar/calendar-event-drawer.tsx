"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  X,
  DollarSign,
  FileWarning,
  MessageSquare,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";
import type { CalendarApiAppointment } from "@/features/appointments/kimi/calendar/map-calendar";
import { CalendarRescheduleSheet } from "@/components/appointments/calendar/calendar-reschedule-sheet";

type AppointmentDetail = {
  id: string;
  inviteeName: string | null;
  serviceName: string | null;
  startsAt: string;
  endsAt: string | null;
  status: string;
  staffName: string | null;
  contactId: string | null;
  metadata: Record<string, unknown>;
  contact?: { phone?: string; email?: string; firstName?: string; lastName?: string } | null;
  policySnapshot?: {
    cancellation?: { allowed?: string; cutoffHours?: number };
    reschedule?: { allowed?: string; cutoffHours?: number };
  };
  reminderSchedule?: Array<{ label?: string; status?: string }>;
  contracts?: Array<{ status: string }>;
  source?: string | null;
};

import type { OpenSlotSummary } from "@/components/appointments/calendar/calendar-waitlist-match-drawer";

type Props = {
  event: CalendarApiAppointment | null;
  onClose: () => void;
  onRefresh: () => void;
  onReschedule?: (appointmentId: string, startsAt: string) => void;
  onCanceled?: (slot: OpenSlotSummary) => void;
};

function fmtRange(startsAt: string, endsAt: string | null, tz: string | null) {
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : null;
  const d = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const t1 = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: tz || undefined });
  const t2 = end?.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: tz || undefined });
  return `${d} · ${t1}${t2 ? ` – ${t2}` : ""}`;
}

function DrawerSection({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="cal-drawer-section">
      <button type="button" className="cal-drawer-section-head" onClick={() => setOpen((v) => !v)}>
        <span>{title}</span>
        <ChevronDown size={14} className={open ? "rotate-180" : ""} aria-hidden />
      </button>
      {open ? <div className="cal-drawer-section-body">{children}</div> : null}
    </section>
  );
}

export function CalendarEventDrawer({ event, onClose, onRefresh, onReschedule, onCanceled }: Props) {
  const [detail, setDetail] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

  useEffect(() => {
    if (!event || event.id.startsWith("class:") || event.id.startsWith("video:") || event.id.startsWith("meeting:")) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError("");
    fetch(`/api/appointments/${encodeURIComponent(event.id)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.data) throw new Error(json.error || "Load failed");
        setDetail(json.data as AppointmentDetail);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [event]);

  if (!event) return null;

  const isClass = event.id.startsWith("class:");
  const classOccId = event.occurrenceId || event.id.replace("class:", "");

  async function patchStatus(status: string) {
    if (!event || isClass) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/appointments/${encodeURIComponent(event.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Update failed");
      }
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
      setMoreOpen(false);
    }
  }

  async function cancelAppt() {
    if (!event || isClass) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/appointments/${encodeURIComponent(event.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Cancel failed");
      }
      onCanceled?.({
        startsAt: event.startsAt,
        endsAt: event.endsAt || undefined,
        serviceName: event.serviceName || undefined,
        staffLabel: event.staffLabel,
        locationLabel: event.locationLabel || undefined,
      });
      onRefresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  }

  const meta = (detail?.metadata || event.metadata || {}) as Record<string, unknown>;
  const teamIds = (meta.teamStaffIds as string[]) || event.staffIds || [];
  const balance = event.balanceDueCents ?? (meta.balanceDueCents as number) ?? (meta.amountDueCents as number);
  const contactId = event.contactId || detail?.contactId;
  const phone = detail?.contact?.phone || event.inviteePhone;
  const email = detail?.contact?.email;
  const pendingForms = event.pendingFormsCount ?? (meta.pendingFormsCount as number) ?? 0;
  const packageLabel = meta.packageName as string | undefined;
  const membershipLabel = meta.membershipName as string | undefined;
  const sourceLabel = (detail?.source || meta.source || meta.bookingSource || "—") as string;
  const syncLabel = (meta.calendarSyncStatus as string) || (meta.googleCalendarSync as string) || null;
  const videoUrl = event.meeting?.videoJoinUrl;

  return (
    <>
      <div className="cal-drawer-backdrop" role="presentation" onClick={onClose}>
        <aside
          className="cal-drawer cal-drawer-operational"
          role="dialog"
          aria-label="Event details"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="cal-drawer-head">
            <div>
              <p className="cal-drawer-kicker">{(event.domainType || "booking").toUpperCase()}</p>
              <h2 className="cal-drawer-title">{event.serviceName || event.inviteeName || "Scheduled event"}</h2>
              <p className="cal-drawer-sub">{event.inviteeName}</p>
              <span className="ws-chip mt-1 inline-block">{event.status}</span>
            </div>
            <button type="button" aria-label="Close" onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {!isClass && !event.id.startsWith("video:") ? (
            <div className="cal-drawer-primary-actions">
              {contactId ? (
                <Link
                  href={`/conversations?contactId=${encodeURIComponent(contactId)}`}
                  className="cal-drawer-action-btn"
                >
                  <MessageSquare size={14} aria-hidden />
                  Message
                </Link>
              ) : null}
              <button type="button" className="cal-drawer-action-btn" onClick={() => setRescheduleOpen(true)}>
                Reschedule
              </button>
              <div className="relative">
                <button type="button" className="cal-drawer-action-btn" onClick={() => setMoreOpen((v) => !v)}>
                  <MoreHorizontal size={14} aria-hidden />
                  More
                </button>
                {moreOpen ? (
                  <div className="cal-more-menu" role="menu">
                    <button type="button" role="menuitem" disabled={busy} onClick={() => void patchStatus("confirmed")}>
                      Mark confirmed
                    </button>
                    <button type="button" role="menuitem" disabled={busy} onClick={() => void patchStatus("checked_in")}>
                      Check in
                    </button>
                    <button type="button" role="menuitem" disabled={busy} onClick={() => void patchStatus("completed")}>
                      Mark complete
                    </button>
                    <button type="button" role="menuitem" disabled={busy} onClick={() => void patchStatus("no_show")}>
                      Mark no-show
                    </button>
                    <button type="button" role="menuitem" className="text-red-700" disabled={busy} onClick={() => void cancelAppt()}>
                      Cancel appointment
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {error && <p className="px-4 text-xs text-red-600">{error}</p>}
          {loading && <p className="px-4 text-xs text-[var(--text-muted)]">Loading details…</p>}

          <div className="cal-drawer-body text-xs">
            <DrawerSection title="Summary">
              <p className="cal-drawer-row">
                <span>When</span>
                <span>{fmtRange(event.startsAt, event.endsAt || null, event.timezone)}</span>
              </p>
              {event.staffLabel ? (
                <p className="cal-drawer-row">
                  <span>Staff</span>
                  <span>{event.staffLabel}</span>
                </p>
              ) : null}
              {teamIds.length > 1 ? (
                <p className="cal-drawer-row">
                  <span>Team</span>
                  <span>{teamIds.length} providers</span>
                </p>
              ) : null}
              {event.locationLabel ? (
                <p className="cal-drawer-row">
                  <span>Location</span>
                  <span>{event.locationLabel}</span>
                </p>
              ) : null}
              {event.resourceLabels?.length ? (
                <p className="cal-drawer-row">
                  <span>Resources</span>
                  <span>{event.resourceLabels.join(", ")}</span>
                </p>
              ) : null}
              {event.registrationSummary ? (
                <p className="cal-drawer-row">
                  <span>Capacity</span>
                  <span>{event.registrationSummary}</span>
                </p>
              ) : null}
              <p className="cal-drawer-row">
                <span>Source</span>
                <span>{String(sourceLabel)}</span>
              </p>
            </DrawerSection>

            {(contactId || event.inviteeName) && (
              <DrawerSection title="Customer">
                <p className="font-medium text-[var(--fg)]">{event.inviteeName || "Client"}</p>
                {phone ? <p className="text-[var(--muted)]">{phone}</p> : null}
                {email ? <p className="text-[var(--muted)]">{email}</p> : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {contactId ? (
                    <Link href={`/contacts/${contactId}`} className="appt-pilot-secondary-btn text-[11px] px-2 py-1">
                      Open client
                    </Link>
                  ) : null}
                  {contactId ? (
                    <Link href={`/conversations?contactId=${contactId}`} className="appt-pilot-secondary-btn text-[11px] px-2 py-1">
                      Message
                    </Link>
                  ) : null}
                </div>
              </DrawerSection>
            )}

            {!isClass && (
              <DrawerSection title="Payment">
                {balance && balance > 0 ? (
                  <p className="flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    ${(balance / 100).toFixed(2)} balance due
                  </p>
                ) : (
                  <p>{event.paymentLabel || "No payment due"}</p>
                )}
                {balance && balance > 0 ? (
                  <Link
                    href={`/appointments/point-of-sale?appointmentId=${encodeURIComponent(event.id)}`}
                    className="mt-2 inline-block appt-pilot-secondary-btn text-[11px] px-2 py-1"
                  >
                    Collect / POS
                  </Link>
                ) : null}
              </DrawerSection>
            )}

            {(packageLabel || membershipLabel) && (
              <DrawerSection title="Package / membership">
                {packageLabel ? <p>{packageLabel}</p> : null}
                {membershipLabel ? <p>{membershipLabel}</p> : null}
              </DrawerSection>
            )}

            {!isClass && (
              <DrawerSection title="Forms & documents" defaultOpen={pendingForms > 0}>
                {pendingForms > 0 ? (
                  <p className="flex items-center gap-1 text-amber-800">
                    <FileWarning className="h-3.5 w-3.5" />
                    {pendingForms} outstanding
                  </p>
                ) : (
                  <p>
                    {(detail?.contracts?.length || 0) > 0
                      ? `${detail?.contracts?.filter((c) => c.status === "signed").length || 0} signed`
                      : "No forms required"}
                  </p>
                )}
                <Link href={`/appointments/${event.id}#forms`} className="mt-2 inline-block text-[11px] font-semibold text-[var(--fg)] underline">
                  Open forms
                </Link>
              </DrawerSection>
            )}

            {!isClass && (
              <DrawerSection title="Reminders" defaultOpen={false}>
                {detail?.reminderSchedule?.length ? (
                  <ul className="list-disc pl-4 space-y-1">
                    {detail.reminderSchedule.slice(0, 4).map((r, i) => (
                      <li key={i}>{r.label || r.status || "Reminder"}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[var(--muted)]">See appointment for reminder schedule</p>
                )}
                <Link href={`/appointments/reminders`} className="mt-2 inline-block text-[11px] underline">
                  Open reminders
                </Link>
              </DrawerSection>
            )}

            {detail?.policySnapshot && (
              <DrawerSection title="Policy" defaultOpen={false}>
                <p className="text-[var(--muted)]">
                  Cancel: {detail.policySnapshot.cancellation?.allowed || "—"}
                  {detail.policySnapshot.cancellation?.cutoffHours
                    ? ` (${detail.policySnapshot.cancellation.cutoffHours}h)`
                    : ""}
                </p>
                <p className="text-[var(--muted)]">
                  Reschedule: {detail.policySnapshot.reschedule?.allowed || "—"}
                </p>
              </DrawerSection>
            )}

            {syncLabel && (
              <DrawerSection title="Calendar sync" defaultOpen={false}>
                <p>{syncLabel}</p>
              </DrawerSection>
            )}

            {videoUrl && (
              <DrawerSection title="Video">
                <Link href={videoUrl} className="appt-pilot-primary-btn text-center text-[11px] px-2 py-1" target="_blank" rel="noreferrer">
                  Join video
                </Link>
              </DrawerSection>
            )}

            {event.attentionFlags?.includes("unconfirmed") && (
              <p className="flex items-center gap-1 text-amber-700 px-1">
                <FileWarning className="h-3.5 w-3.5" /> Needs confirmation
              </p>
            )}
          </div>

          <div className="cal-drawer-actions">
            {isClass ? (
              <Link href={`/appointments/classes?occurrence=${classOccId}`} className="appt-pilot-primary-btn w-full text-center">
                Open class
              </Link>
            ) : event.id.startsWith("video:") ? (
              <Link href={`/video/rooms/${event.id.slice(6)}/host`} className="appt-pilot-primary-btn w-full text-center">
                Open video
              </Link>
            ) : (
              <Link href={`/appointments/${event.id}`} className="appt-pilot-primary-btn w-full text-center">
                Open full appointment
              </Link>
            )}
          </div>
        </aside>
      </div>
      {rescheduleOpen && event && !isClass ? (
        <CalendarRescheduleSheet
          appointmentId={event.id}
          currentStartsAt={event.startsAt}
          recurringSeriesId={
            ((detail?.metadata || event.metadata || {}) as { recurringSeriesId?: string }).recurringSeriesId
          }
          onClose={() => setRescheduleOpen(false)}
          onDone={onRefresh}
          onReschedule={onReschedule}
        />
      ) : null}
    </>
  );
}
