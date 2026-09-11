"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X, DollarSign, FileWarning } from "lucide-react";
import type { CalendarApiAppointment } from "@/features/appointments/kimi/calendar/map-calendar";

type Detail = {
  id: string;
  inviteeName: string | null;
  serviceName: string | null;
  startsAt: string;
  endsAt: string | null;
  status: string;
  staffName: string | null;
  contactId: string | null;
  metadata: Record<string, unknown>;
};

type Props = {
  event: CalendarApiAppointment | null;
  onClose: () => void;
  onRefresh: () => void;
};

function fmtRange(startsAt: string, endsAt: string | null, tz: string | null) {
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : null;
  const d = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const t1 = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: tz || undefined });
  const t2 = end?.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: tz || undefined });
  return `${d} · ${t1}${t2 ? ` – ${t2}` : ""}`;
}

export function CalendarEventDrawer({ event, onClose, onRefresh }: Props) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
        setDetail(json.data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [event]);

  if (!event) return null;

  const isClass = event.id.startsWith("class:");
  const classOccId = event.occurrenceId || event.id.replace("class:", "");

  async function cancelAppt() {
    if (!event || event.id.startsWith("class:")) return;
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

  return (
    <div className="cal-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="cal-drawer"
        role="dialog"
        aria-label="Event details"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cal-drawer-head">
          <div>
            <p className="cal-drawer-kicker">{event.domainType || "Booking"}</p>
            <h2 className="cal-drawer-title">{event.inviteeName || event.serviceName || "Scheduled event"}</h2>
            <p className="cal-drawer-sub">{event.serviceName}</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <p className="px-4 text-xs text-red-600">{error}</p>}
        {loading && <p className="px-4 text-xs text-[var(--text-muted)]">Loading…</p>}

        <div className="cal-drawer-body text-xs">
          <p className="cal-drawer-row">
            <span>When</span>
            <span>{fmtRange(event.startsAt, event.endsAt || null, event.timezone)}</span>
          </p>
          {event.staffLabel && (
            <p className="cal-drawer-row">
              <span>Staff</span>
              <span>{event.staffLabel}</span>
            </p>
          )}
          {teamIds.length > 1 && (
            <p className="cal-drawer-row">
              <span>Team</span>
              <span>{teamIds.length} providers</span>
            </p>
          )}
          {event.locationLabel && (
            <p className="cal-drawer-row">
              <span>Location</span>
              <Link href={`/appointments/locations/${event.locationId || ""}`} className="text-[var(--accent)]">
                {event.locationLabel}
              </Link>
            </p>
          )}
          {event.resourceLabels?.length ? (
            <p className="cal-drawer-row">
              <span>Resources</span>
              <span>{event.resourceLabels.join(", ")}</span>
            </p>
          ) : null}
          {event.registrationSummary && (
            <p className="cal-drawer-row">
              <span>Registration</span>
              <span>{event.registrationSummary}</span>
            </p>
          )}
          <p className="cal-drawer-row">
            <span>Status</span>
            <span className="ws-chip">{event.status}</span>
          </p>
          {balance && balance > 0 ? (
            <p className="cal-drawer-row flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              <span>${(balance / 100).toFixed(2)} due</span>
            </p>
          ) : event.paymentLabel ? (
            <p className="cal-drawer-row">{event.paymentLabel}</p>
          ) : null}
          {event.attentionFlags?.includes("unconfirmed") && (
            <p className="flex items-center gap-1 text-amber-700">
              <FileWarning className="h-3.5 w-3.5" /> Needs confirmation
            </p>
          )}
        </div>

        <div className="cal-drawer-actions">
          {event.contactId && (
            <Link href={`/appointments/clients/${event.contactId}`} className="appt-pilot-secondary-btn w-full text-center">
              Open client
            </Link>
          )}
          {isClass ? (
            <Link
              href={`/appointments/classes?occurrence=${classOccId}`}
              className="appt-pilot-primary-btn w-full text-center"
            >
              Open class
            </Link>
          ) : event.id.startsWith("video:") ? (
            <Link href={`/video/rooms/${event.id.slice(6)}/host`} className="appt-pilot-primary-btn w-full text-center">
              Open video
            </Link>
          ) : (
            <>
              <Link href={`/appointments/${event.id}`} className="appt-pilot-primary-btn w-full text-center">
                Open appointment
              </Link>
              <Link
                href={`/appointments/${event.id}?action=reschedule`}
                className="appt-pilot-secondary-btn w-full text-center"
              >
                Reschedule
              </Link>
              {balance && balance > 0 ? (
                <Link
                  href={`/appointments/point-of-sale?appointmentId=${encodeURIComponent(event.id)}`}
                  className="appt-pilot-secondary-btn w-full text-center"
                >
                  Collect balance
                </Link>
              ) : null}
              <button type="button" className="text-red-700" disabled={busy} onClick={() => void cancelAppt()}>
                Cancel appointment
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
