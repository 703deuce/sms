"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ACTION_COPY,
  MOCK_APPOINTMENT,
  MOCK_SLOTS,
  type ActionKind,
  type AppointmentPreview,
  type Slot,
} from "../mock-data";
import {
  AlertIcon,
  AppointmentStatusBadge,
  CalendarCheckIcon,
  CheckIcon,
  XIcon,
  VideoIcon,
  formatAppointmentDay,
  formatAppointmentTime,
  formatAppointmentWhen,
  formatTimezoneAbbrev,
} from "./appointment-ui";
import { Button, Card } from "./ui";

type FetchState = "loading" | "ready" | "error";

function appointmentForToken(token: string): AppointmentPreview {
  if (token === "demo-already-confirmed") {
    return { ...MOCK_APPOINTMENT, status: "confirmed" };
  }
  if (token === "demo-already-canceled") {
    return { ...MOCK_APPOINTMENT, status: "canceled", meetingLink: null };
  }
  if (token === "demo-past") {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    d.setHours(14, 0, 0, 0);
    return { ...MOCK_APPOINTMENT, startsAt: d.toISOString(), status: "awaiting_confirmation", meetingLink: null };
  }
  return MOCK_APPOINTMENT;
}

export function PublicActionClient({
  kind,
  token,
  live = false,
}: {
  kind: ActionKind;
  token: string;
  live?: boolean;
}) {
  const [appt, setAppt] = useState<AppointmentPreview | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [fetchState, setFetchState] = useState<FetchState>("loading");
  const [acting, setActing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const apiBase = `/api/public/appointments/${kind}/${encodeURIComponent(token)}`;

  const load = useCallback(() => {
    let cancelled = false;
    setFetchState("loading");
    setError("");
    setDone(false);
    setSelectedSlot("");

    if (live) {
      fetch(apiBase)
        .then(async (r) => {
          if (cancelled) return;
          if (!r.ok) {
            const json = await r.json().catch(() => ({}));
            throw new Error(json.error || "Invalid link");
          }
          return r.json();
        })
        .then((json) => {
          if (cancelled) return;
          setAppt(json.data);
          if (kind === "reschedule" && json.data.slots) {
            setSlots(json.data.slots);
          }
          setFetchState("ready");
        })
        .catch((err: Error) => {
          if (cancelled) return;
          setAppt(null);
          setError(err.message);
          setFetchState("error");
        });
      return () => {
        cancelled = true;
      };
    }

    const t = setTimeout(() => {
      if (cancelled) return;
      if (token === "invalid") {
        setAppt(null);
        setError("This link is invalid or has expired. Contact the business to request a new one.");
        setFetchState("error");
        return;
      }
      setAppt(appointmentForToken(token));
      if (kind === "reschedule") setSlots(MOCK_SLOTS);
      setFetchState("ready");
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [apiBase, kind, live, token]);

  useEffect(() => load(), [load]);

  async function submit() {
    setActing(true);
    setError("");
    if (live) {
      const body = kind === "reschedule" ? { startsAt: selectedSlot } : undefined;
      const res = await fetch(apiBase, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Something went wrong");
        setActing(false);
        return;
      }
      setDone(true);
      setActing(false);
      if (json.data) setAppt((prev) => (prev ? { ...prev, ...json.data } : prev));
      return;
    }
    await new Promise((r) => setTimeout(r, 800));
    if (kind === "reschedule" && selectedSlot) {
      setAppt((prev) => (prev ? { ...prev, startsAt: selectedSlot, status: "scheduled" } : prev));
    } else if (kind === "confirm") {
      setAppt((prev) => (prev ? { ...prev, status: "confirmed" } : prev));
    } else if (kind === "cancel") {
      setAppt((prev) => (prev ? { ...prev, status: "canceled" } : prev));
    }
    setDone(true);
    setActing(false);
  }

  const copy = ACTION_COPY[kind];

  const slotGroups = useMemo(() => {
    const groups = new Map<string, Slot[]>();
    for (const slot of slots) {
      const day = formatAppointmentDay(slot.startsAt, appt?.timezone);
      const list = groups.get(day) || [];
      list.push(slot);
      groups.set(day, list);
    }
    return Array.from(groups.entries());
  }, [slots, appt?.timezone]);

  /* ---- Loading state ---- */
  if (fetchState === "loading") {
    return (
      <div className="pub-shell">
        <div className="pub-loading" role="status" aria-live="polite">
          <span className="pub-loading-spinner" aria-hidden="true" />
          Loading appointment…
        </div>
      </div>
    );
  }

  /* ---- Error state (invalid / expired link) ---- */
  if (fetchState === "error" && !appt) {
    return (
      <div className="pub-shell">
        <Brand businessName={null} />
        <Card className="error-card">
          <div className="error-icon">
            <AlertIcon size={20} />
          </div>
          <h1 className="error-heading">Link unavailable</h1>
          <p className="error-message">{error}</p>
          <div className="error-actions">
            <Button variant="secondary" onClick={load}>
              Try again
            </Button>
          </div>
        </Card>
        <Footer />
      </div>
    );
  }

  const tz = formatTimezoneAbbrev(appt?.startsAt || "", appt?.timezone);
  const status = appt?.status?.toLowerCase() || "";
  const isPast = appt ? new Date(appt.startsAt).getTime() < Date.now() : false;
  const alreadyConfirmed = kind === "confirm" && status === "confirmed";
  const alreadyCanceled = kind === "cancel" && (status === "canceled" || status === "cancelled");
  const showJoinMeeting =
    Boolean(appt?.meetingLink) && kind !== "cancel" && (!done || kind === "confirm");

  /* ---- Terminal / idempotent states (link revisited after action already taken) ---- */
  if (!done && (alreadyCanceled || (isPast && kind !== "reschedule") || (isPast && kind === "reschedule"))) {
    const heading = alreadyCanceled
      ? "This appointment has already been canceled"
      : "This appointment time has passed";
    const message = alreadyCanceled
      ? "No further action is needed. If you’d like to book a new time, contact the business."
      : "This link can no longer be used. Contact the business to book a new appointment.";
    return (
      <div className="pub-shell">
        <Brand businessName={appt?.businessName} />
        <Card>
          <div className="done-wrap">
            <div className="done-icon is-neutral">
              {alreadyCanceled ? <XIcon size={22} /> : <CalendarCheckIcon size={22} />}
            </div>
            <h1 className="done-heading">{heading}</h1>
            <p className="done-subtext">{message}</p>
            {appt ? (
              <p className="done-appt">
                <strong>{appt.serviceName || "Appointment"}</strong>
                {" · "}
                {formatAppointmentWhen(appt.startsAt, appt.timezone)}
                {tz ? ` ${tz}` : ""}
              </p>
            ) : null}
          </div>
        </Card>
        <Footer />
      </div>
    );
  }

  return (
    <div className="pub-shell">
      <Brand businessName={appt?.businessName} />

      <Card>
        {done || alreadyConfirmed ? (
          /* ---- Success state (just completed, or link revisited after confirming) ---- */
          <div className="done-wrap" role="status">
            <div className={`done-icon${kind === "cancel" ? " is-danger" : ""}`}>
              {kind === "cancel" ? <XIcon size={22} /> : <CheckIcon size={22} />}
            </div>
            <h1 className="done-heading">
              {alreadyConfirmed && !done ? "This appointment is already confirmed" : copy.done}
            </h1>
            <p className="done-subtext">
              {alreadyConfirmed && !done
                ? "No further action is needed. We’ll send you a reminder before your appointment."
                : copy.doneSubtext}
            </p>
            {appt ? (
              <p className="done-appt">
                <strong>{appt.serviceName || "Appointment"}</strong>
                {" · "}
                {formatAppointmentWhen(appt.startsAt, appt.timezone)}
                {tz ? ` ${tz}` : ""}
              </p>
            ) : null}
            {showJoinMeeting && appt?.meetingLink ? (
              <div className="done-actions">
                <Button
                  variant="primary"
                  onClick={() => window.open(appt.meetingLink!, "_blank", "noreferrer")}
                >
                  <VideoIcon size={15} />
                  {appt.isTransovoVideo ? "Join meeting" : "Open meeting link"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          /* ---- Normal action state ---- */
          <>
            <h1 className="pub-heading">{copy.heading}</h1>
            <p className="pub-subtext">{copy.subtext}</p>

            {appt ? (
              <div className="appt-summary">
                <span className="appt-icon">
                  <CalendarCheckIcon size={17} />
                </span>
                <div className="appt-summary-body">
                  <div className="appt-title-row">
                    <p className="appt-title">{appt.serviceName || "Appointment"}</p>
                    <AppointmentStatusBadge status={appt.status} />
                  </div>
                  <p className="appt-meta">
                    {formatAppointmentWhen(appt.startsAt, appt.timezone)}
                    {tz ? ` ${tz}` : ""}
                    {appt.durationMinutes ? ` · ${appt.durationMinutes} min` : ""}
                  </p>
                  <p className="appt-meta-secondary">
                    {[
                      appt.staffName ? `with ${appt.staffName}` : null,
                      appt.locationLabel,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
            ) : null}

            {kind === "reschedule" ? (
              <div className="slot-section">
                <p className="slot-label">Available times{tz ? ` (${tz})` : ""}</p>
                {slotGroups.length === 0 ? (
                  <p className="pub-subtext">
                    No times are currently available. Please contact the business to reschedule.
                  </p>
                ) : (
                  slotGroups.map(([day, daySlots]) => (
                    <div className="slot-day-group" key={day}>
                      <p className="slot-day-heading">{day}</p>
                      <div className="slot-grid" role="group" aria-label={`Times on ${day}`}>
                        {daySlots.map((slot) => (
                          <button
                            key={slot.startsAt}
                            type="button"
                            className={`slot-btn${selectedSlot === slot.startsAt ? " is-selected" : ""}`}
                            aria-pressed={selectedSlot === slot.startsAt}
                            onClick={() => setSelectedSlot(slot.startsAt)}
                          >
                            {formatAppointmentTime(slot.startsAt, appt?.timezone)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {error ? (
              <div className="inline-error" role="alert">
                <AlertIcon size={15} />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="action-row">
              <Button
                variant={kind === "cancel" ? "danger" : "primary"}
                loading={acting}
                disabled={kind === "reschedule" && !selectedSlot}
                onClick={submit}
              >
                {acting
                  ? kind === "confirm"
                    ? "Confirming…"
                    : kind === "cancel"
                      ? "Canceling…"
                      : "Rescheduling…"
                  : copy.cta}
              </Button>
              {kind === "cancel" ? (
                <Button variant="secondary" onClick={() => window.history.back()}>
                  Keep appointment
                </Button>
              ) : null}
            </div>
          </>
        )}
      </Card>

      <Footer />
    </div>
  );
}

function Brand({ businessName }: { businessName?: string | null }) {
  return (
    <div className="pub-brand">
      <span className="pub-brand-mark" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v4" /><path d="M16 2v4" />
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M3 10h18" />
        </svg>
      </span>
      {businessName || "Transovo"}
    </div>
  );
}

function Footer() {
  return (
    <p className="pub-footer">
      Powered by Transovo · Appointment scheduling and reminders
      <br />
      <a href="https://transovo.com/terms" target="_blank" rel="noreferrer">
        Terms
      </a>
      {" · "}
      <a href="https://transovo.com/privacy" target="_blank" rel="noreferrer">
        Privacy
      </a>
    </p>
  );
}
