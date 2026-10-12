"use client";

import { useEffect, useState } from "react";
import {
  MOCK_APPOINTMENT,
  MOCK_INVALID_LINK_ERROR,
  MOCK_SLOTS,
  MOCK_SUBMIT_ERROR,
  type AppointmentPreview,
  type Slot,
} from "../mock-data";
import { PublicShell } from "./PublicShell";
import {
  AppointmentStatusBadge,
  Button,
  Card,
  IconTile,
  Spinner,
  formatDayLong,
  formatTime,
  formatWhen,
} from "./ui";
import { SlotPicker } from "./SlotPicker";
import {
  CalendarCheck,
  CalendarClock,
  Check,
  Link2Off,
  MapPin,
  Video,
} from "lucide-react";

type LoadState = "loading" | "ready" | "invalid";
type FlowState = "picking" | "done" | "kept";

/**
 * Sandbox state overrides for design review (no backend wiring here):
 *   ?state=invalid  → invalid/expired link
 *   ?state=empty    → appointment valid but no slots available
 *   ?state=error    → submit fails once with a slot-taken error, then recovers
 * Cursor maps these to real API responses in production.
 */
function sandboxOverride(): { load?: LoadState; empty?: boolean; failOnce?: boolean } {
  if (typeof window === "undefined") return {};
  const s = new URLSearchParams(window.location.search).get("state");
  if (s === "invalid") return { load: "invalid" };
  if (s === "empty") return { empty: true };
  if (s === "error") return { failOnce: true };
  return {};
}

export function RescheduleFlow({ token, live = false }: { token?: string; live?: boolean }) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [appt, setAppt] = useState<AppointmentPreview | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [acting, setActing] = useState(false);
  const [flow, setFlow] = useState<FlowState>("picking");
  const [submitError, setSubmitError] = useState("");
  const [failOnce, setFailOnce] = useState(false);
  const [requestOnly, setRequestOnly] = useState(false);
  const [requestNote, setRequestNote] = useState("");
  const [requestPreferred, setRequestPreferred] = useState("");
  const [durationUnavailable, setDurationUnavailable] = useState(false);

  useEffect(() => {
    if (live && token) {
      setLoadState("loading");
      fetch(`/api/public/appointments/reschedule/${encodeURIComponent(token)}`)
        .then(async (r) => {
          if (!r.ok) {
            const json = await r.json().catch(() => ({}));
            throw new Error(json.error || MOCK_INVALID_LINK_ERROR);
          }
          return r.json();
        })
        .then((json) => {
          setAppt(json.data);
          setRequestOnly(Boolean(json.data.requestOnly));
          setDurationUnavailable(Boolean(json.data.durationUnavailable));
          setSlots(json.data.slots || []);
          setLoadState("ready");
        })
        .catch(() => setLoadState("invalid"));
      return;
    }

    const o = sandboxOverride();
    const t = setTimeout(() => {
      if (o.load === "invalid") {
        setLoadState("invalid");
        return;
      }
      setAppt(MOCK_APPOINTMENT);
      setSlots(o.empty ? [] : MOCK_SLOTS);
      setFailOnce(Boolean(o.failOnce));
      setLoadState("ready");
    }, 700);
    return () => clearTimeout(t);
  }, [live, token]);

  async function submit() {
    if (!requestOnly && !selectedSlot) return;
    setActing(true);
    setSubmitError("");
    if (live && token) {
      const res = await fetch(`/api/public/appointments/reschedule/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          requestOnly
            ? {
                note: requestNote.trim() || undefined,
                preferredStartsAt: requestPreferred.trim() || undefined,
              }
            : { startsAt: selectedSlot },
        ),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(json.error || MOCK_SUBMIT_ERROR);
        setActing(false);
        return;
      }
      setAppt((prev) => (prev ? { ...prev, ...json.data, startsAt: json.data.startsAt || selectedSlot } : prev));
      setFlow("done");
      setActing(false);
      return;
    }
    await new Promise((r) => setTimeout(r, 900));
    if (failOnce) {
      setFailOnce(false);
      setSlots((prev) => prev.filter((s) => s.startsAt !== selectedSlot));
      setSelectedSlot("");
      setSubmitError(MOCK_SUBMIT_ERROR);
      setActing(false);
      return;
    }
    setAppt((prev) => (prev ? { ...prev, startsAt: selectedSlot } : prev));
    setFlow("done");
    setActing(false);
  }

  if (loadState === "loading") {
    return (
      <PublicShell>
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 120,
            fontSize: 14,
            color: "var(--text-muted)",
          }}
        >
          <Spinner />
          Loading your appointment…
        </div>
      </PublicShell>
    );
  }

  if (loadState === "invalid") {
    return (
      <PublicShell>
        <Card className="pub-fade" style={{ width: "100%", maxWidth: 440, padding: 32, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <IconTile tone="danger" size={44}>
              <Link2Off size={20} />
            </IconTile>
          </div>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>
            Link unavailable
          </h1>
          <p style={{ margin: "10px 0 0", fontSize: 13.5, lineHeight: 1.55, color: "var(--text-secondary)" }}>
            {MOCK_INVALID_LINK_ERROR}
          </p>
        </Card>
      </PublicShell>
    );
  }

  if (!appt) return null;

  // Join meeting is only meaningful while the appointment stands (pre-reschedule
  // or kept) or after a successful reschedule when the new time is near. In the
  // sandbox we show it when a meeting link exists and the flow is not "picking"
  // without changes — matching production behavior for confirm/keep outcomes.
  const showJoinMeeting = Boolean(appt.meetingLink) && flow !== "picking";

  const summaryRow = (
    <div
      style={{
        borderRadius: "var(--radius-md)",
        background: "var(--surface-subtle)",
        border: "1px solid var(--border)",
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        textAlign: "left",
      }}
    >
      <IconTile>
        {flow === "done" ? <CalendarCheck size={18} /> : <CalendarClock size={18} />}
      </IconTile>
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {appt.serviceName || "Appointment"}
        </p>
        <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>
          {flow === "picking" ? "Currently: " : ""}
          {formatWhen(appt.startsAt, appt.timezone)}
        </p>
        {appt.locationLabel ? (
          <p
            style={{
              margin: "3px 0 0",
              fontSize: 12,
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <MapPin size={11} aria-hidden="true" />
            {appt.locationLabel}
          </p>
        ) : null}
      </div>
      <div style={{ marginLeft: "auto", flexShrink: 0 }}>
        <AppointmentStatusBadge status={appt.status} />
      </div>
    </div>
  );

  return (
    <PublicShell>
      <div className="pub-fade" style={{ width: "100%", maxWidth: 520 }}>
        {flow === "done" ? (
          <Card style={{ padding: 32, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "var(--success-soft)",
                  color: "var(--success)",
                  boxShadow: "0 0 0 8px rgba(5,150,105,0.08)",
                }}
              >
                <Check size={26} strokeWidth={2.5} />
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
              {requestOnly ? "Reschedule request sent" : "You're rescheduled"}
            </h1>
            <p style={{ margin: "10px 0 0", fontSize: 13.5, lineHeight: 1.55, color: "var(--text-secondary)" }}>
              {requestOnly
                ? "We've notified the business. Your original appointment stays as scheduled until they confirm a new time."
                : "Your appointment has been moved. Check your texts for updated details."}
            </p>

            <div style={{ marginTop: 20 }}>{summaryRow}</div>

            {showJoinMeeting && appt.meetingLink ? (
              <Button
                size="lg"
                fullWidth
                style={{ marginTop: 20 }}
                onClick={() => window.open(appt.meetingLink!, "_blank", "noopener")}
              >
                <Video size={16} />
                {appt.isTransovoVideo ? "Join meeting" : "Open meeting link"}
              </Button>
            ) : null}
          </Card>
        ) : flow === "kept" ? (
          <Card style={{ padding: 32, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  boxShadow: "0 0 0 8px rgba(79,70,229,0.07)",
                }}
              >
                <CalendarCheck size={24} />
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
              No changes made
            </h1>
            <p style={{ margin: "10px 0 0", fontSize: 13.5, lineHeight: 1.55, color: "var(--text-secondary)" }}>
              Your appointment stays at its current time. See you then!
            </p>

            <div style={{ marginTop: 20 }}>{summaryRow}</div>

            {showJoinMeeting && appt.meetingLink ? (
              <Button
                size="lg"
                fullWidth
                style={{ marginTop: 20 }}
                onClick={() => window.open(appt.meetingLink!, "_blank", "noopener")}
              >
                <Video size={16} />
                {appt.isTransovoVideo ? "Join meeting" : "Open meeting link"}
              </Button>
            ) : null}

            <button
              type="button"
              onClick={() => setFlow("picking")}
              style={{
                marginTop: 16,
                background: "none",
                border: "none",
                padding: 4,
                fontSize: 13,
                fontWeight: 600,
                color: "var(--accent)",
                cursor: "pointer",
              }}
            >
              Actually, I do need a different time
            </button>
          </Card>
        ) : (
          <Card style={{ padding: 28 }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
              {requestOnly ? "Request a new time" : "Reschedule your appointment"}
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              {requestOnly
                ? "Confirm your request below. The business will follow up — your current appointment is unchanged until then."
                : "Choose a new time that works for you. Your reminders will update automatically."}
            </p>

            <div style={{ marginTop: 18 }}>{summaryRow}</div>

            {durationUnavailable && !requestOnly ? (
              <p
                role="alert"
                style={{
                  marginTop: 18,
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: "var(--text-muted)",
                }}
              >
                Online rescheduling isn&apos;t available for this appointment. Please contact the business
                directly to request a new time.
              </p>
            ) : null}

            {requestOnly ? (
              <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 14 }}>
                <label style={{ display: "block", fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>Preferred date or time (optional)</span>
                  <input
                    type="text"
                    value={requestPreferred}
                    onChange={(e) => setRequestPreferred(e.target.value)}
                    placeholder="e.g. Next Tuesday afternoon"
                    style={{
                      marginTop: 6,
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      fontSize: 14,
                    }}
                  />
                </label>
                <label style={{ display: "block", fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>Note for the business (optional)</span>
                  <textarea
                    value={requestNote}
                    onChange={(e) => setRequestNote(e.target.value)}
                    rows={3}
                    placeholder="Anything we should pass along?"
                    style={{
                      marginTop: 6,
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      fontSize: 14,
                      resize: "vertical",
                    }}
                  />
                </label>
              </div>
            ) : durationUnavailable ? null : (
              <div style={{ marginTop: 22 }}>
                <p
                  id="pick-time-label"
                  style={{
                    margin: "0 0 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  Pick a new time
                </p>
                <SlotPicker
                  slots={slots}
                  timezone={appt.timezone}
                  selected={selectedSlot}
                  onSelect={setSelectedSlot}
                />
              </div>
            )}

            {!requestOnly && selectedSlot ? (
              <p
                role="status"
                style={{
                  margin: "14px 2px 0",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                }}
              >
                New time:{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {formatDayLong(selectedSlot, appt.timezone)} at{" "}
                  {formatTime(selectedSlot, appt.timezone)}
                </strong>
              </p>
            ) : null}

            {submitError ? (
              <p
                role="alert"
                style={{
                  margin: "14px 0 0",
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: 1.5,
                  color: "var(--danger)",
                }}
              >
                {submitError}
              </p>
            ) : null}

            <div style={{ marginTop: 22 }}>
              <Button
                size="lg"
                fullWidth
                disabled={
                  requestOnly ? acting : !selectedSlot || acting || slots.length === 0
                }
                onClick={submit}
                aria-busy={acting}
              >
                {acting ? (
                  <>
                    <Spinner size={15} />
                    {requestOnly ? "Sending…" : "Confirming…"}
                  </>
                ) : requestOnly ? (
                  "Send reschedule request"
                ) : (
                  "Confirm new time"
                )}
              </Button>
            </div>

            {slots.length > 0 ? (
              <p style={{ margin: "14px 0 0", textAlign: "center" }}>
                <button
                  type="button"
                  onClick={() => setFlow("kept")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 4,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  Keep my current time
                </button>
              </p>
            ) : null}

            <p
              style={{
                margin: "16px 0 0",
                fontSize: 12,
                lineHeight: 1.55,
                color: "var(--text-muted)",
                textAlign: "center",
              }}
            >
              Need help? Reply to your confirmation text or contact{" "}
              {appt.businessName || "the business"} directly.
            </p>
          </Card>
        )}
      </div>
    </PublicShell>
  );
}
