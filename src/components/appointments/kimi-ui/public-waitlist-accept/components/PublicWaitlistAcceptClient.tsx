"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  CalendarDays,
  Check,
  CircleAlert,
  Clock,
  Info,
  Loader2,
  MailCheck,
  RefreshCw,
  User,
  XCircle,
} from "lucide-react";
import { PublicShell } from "./PublicShell";
import {
  ACCEPTED_APPOINTMENT,
  ERROR_HINTS,
  WAITLIST_ACCEPT_COPY,
  simulateAcceptOutcome,
  type WaitlistAcceptStatus,
  type WaitlistErrorKind,
} from "../mock-data";

type AcceptedAppointmentDetails = {
  businessName: string;
  serviceName: string;
  startsAt: string;
  staffName?: string | null;
  timezone?: string;
};

function formatAcceptedDetails(data: AcceptedAppointmentDetails) {
  const startsAt = new Date(data.startsAt);
  const tz = data.timezone || "America/New_York";
  const dateLabel = startsAt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: tz,
  });
  const timeLabel = startsAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
  const timezoneLabel = startsAt
    .toLocaleTimeString("en-US", { timeZoneName: "short", timeZone: tz })
    .split(" ")
    .pop();
  return {
    businessName: data.businessName,
    serviceName: data.serviceName,
    dateLabel,
    timeLabel,
    timezoneLabel: timezoneLabel || tz,
    staffName: data.staffName || null,
  };
}

export function PublicWaitlistAcceptClient({ token, live = false }: { token: string; live?: boolean }) {
  const [status, setStatus] = useState<WaitlistAcceptStatus>("loading");
  const [errorKind, setErrorKind] = useState<WaitlistErrorKind>("unavailable");
  const [message, setMessage] = useState<string>(WAITLIST_ACCEPT_COPY.loading.message);
  const [attempt, setAttempt] = useState(0);
  const [acceptedDetails, setAcceptedDetails] = useState<ReturnType<typeof formatAcceptedDetails> | null>(
    null,
  );
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let cancelled = false;

    setStatus("loading");
    setMessage(WAITLIST_ACCEPT_COPY.loading.message);
    setAcceptedDetails(null);

    // Production contract (Cursor wires this):
    // fetch(`/api/public/waitlist/accept/${encodeURIComponent(token)}`, { method: "POST" })
    if (live) {
      fetch(`/api/public/waitlist/accept/${encodeURIComponent(token)}`, { method: "POST" })
        .then(async (r) => {
          const json = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(json.error || WAITLIST_ACCEPT_COPY.error.message);
          if (cancelled) return;
          if (json.data?.startsAt) {
            setAcceptedDetails(formatAcceptedDetails(json.data as AcceptedAppointmentDetails));
          }
          setStatus("success");
          setMessage(WAITLIST_ACCEPT_COPY.success.message);
        })
        .catch((err: Error) => {
          if (cancelled) return;
          setStatus("error");
          setErrorKind(err.message.toLowerCase().includes("network") ? "network" : "unavailable");
          setMessage(err.message || WAITLIST_ACCEPT_COPY.error.message);
        });
      return () => {
        cancelled = true;
      };
    }

    simulateAcceptOutcome(token)
      .then((result) => {
        if (cancelled) return;
        setStatus(result.status);
        setMessage(result.message);
        setErrorKind(result.errorKind ?? "unavailable");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
        setErrorKind("network");
        setMessage(WAITLIST_ACCEPT_COPY.network.message);
      });

    return () => {
      cancelled = true;
    };
  }, [token, attempt, live]);

  useEffect(() => {
    if (status !== "loading") headingRef.current?.focus();
  }, [status, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const appt = acceptedDetails || ACCEPTED_APPOINTMENT;

  return (
    <PublicShell>
      <section
        className="tv-card"
        role={status === "error" ? "alert" : "status"}
        aria-live="polite"
      >
        {status === "loading" && (
          <>
            <div className="tv-status-icon loading">
              <Loader2 className="tv-spinner" size={26} strokeWidth={2} aria-hidden="true" />
            </div>
            <h1 className="tv-card-title">{WAITLIST_ACCEPT_COPY.loading.title}</h1>
            <p className="tv-card-message">{message}</p>
            <div className="tv-loading-bar" aria-hidden="true" />
            <p className="tv-meta-note">
              <Clock size={13} aria-hidden="true" />
              Securing your appointment
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="tv-status-icon success">
              <Check size={28} strokeWidth={2.5} aria-hidden="true" />
            </div>
            <h1 className="tv-card-title" ref={headingRef} tabIndex={-1}>
              {WAITLIST_ACCEPT_COPY.success.title}
            </h1>
            <p className="tv-card-message">{message}</p>

            <div className="tv-divider" aria-hidden="true" />

            <dl className="tv-detail-list" aria-label="Appointment details">
              <div className="tv-detail-row">
                <dt>
                  <Building2 size={14} aria-hidden="true" />
                  Business
                </dt>
                <dd>{appt.businessName}</dd>
              </div>
              <div className="tv-detail-row">
                <dt>
                  <Info size={14} aria-hidden="true" />
                  Appointment
                </dt>
                <dd>{appt.serviceName}</dd>
              </div>
              <div className="tv-detail-row">
                <dt>
                  <CalendarDays size={14} aria-hidden="true" />
                  Date
                </dt>
                <dd>{appt.dateLabel}</dd>
              </div>
              <div className="tv-detail-row">
                <dt>
                  <Clock size={14} aria-hidden="true" />
                  Time
                </dt>
                <dd>
                  {appt.timeLabel}
                  <span className="tv-detail-sub">{appt.timezoneLabel}</span>
                </dd>
              </div>
              {appt.staffName && (
                <div className="tv-detail-row">
                  <dt>
                    <User size={14} aria-hidden="true" />
                    With
                  </dt>
                  <dd>{appt.staffName}</dd>
                </div>
              )}
            </dl>

            <p className="tv-meta-note">
              <MailCheck size={13} aria-hidden="true" />
              A confirmation text is on its way
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="tv-status-icon error">
              <XCircle size={28} strokeWidth={2} aria-hidden="true" />
            </div>
            <h1 className="tv-card-title" ref={headingRef} tabIndex={-1}>
              {errorKind === "network"
                ? WAITLIST_ACCEPT_COPY.network.title
                : WAITLIST_ACCEPT_COPY.error.title}
            </h1>
            <p className="tv-card-message">{message}</p>

            {errorKind === "network" ? (
              <div className="tv-action-row">
                <button type="button" className="tv-btn-primary" onClick={retry}>
                  <RefreshCw size={15} strokeWidth={2} aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : (
              <>
                <div className="tv-divider" aria-hidden="true" />
                <ul className="tv-hint-list">
                  {ERROR_HINTS.map((hint) => (
                    <li key={hint}>
                      <Info size={14} aria-hidden="true" />
                      <span>{hint}</span>
                    </li>
                  ))}
                </ul>
                <p className="tv-meta-note">
                  <CircleAlert size={13} aria-hidden="true" />
                  No appointment was booked
                </p>
              </>
            )}
          </>
        )}
      </section>
    </PublicShell>
  );
}
