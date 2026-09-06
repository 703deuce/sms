import { useEffect, useRef } from "react";
import { AppointmentStatusBadge } from "./AppointmentStatusBadge";
import {
  formatDay,
  formatPhone,
  formatTime,
  reminderLabel,
  lastCommunicationLabel,
  type AppointmentRow,
} from "../mock-data";

function XIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
  );
}

export function AppointmentPreview({
  row,
  onClose,
  onAction,
}: {
  row: AppointmentRow | null;
  onClose: () => void;
  onAction: (action: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!row) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [row, onClose]);

  if (!row) return null;
  const name = row.inviteeName ?? "Unknown customer";
  const isActive = !["canceled", "completed", "no_show"].includes(row.status);
  const schedule = row.metadata.reminderSchedule ?? [];

  return (
    <div className="tv-overlay tv-overlay--right" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="tv-drawer" role="dialog" aria-modal="true" aria-label={`Appointment preview for ${name}`} ref={ref}>
        <div className="tv-drawer__head">
          <div className="tv-drawer__id">
            <h2 className="tv-modal__title">{name}</h2>
            <p className="tv-modal__desc">
              {row.serviceName ?? "Appointment"} · {formatDay(row.startsAt, row.timezone)} · {formatTime(row.startsAt, row.timezone)}
            </p>
          </div>
          <button type="button" className="tv-iconbtn" aria-label="Close preview" onClick={onClose}><XIcon /></button>
        </div>

        <div className="tv-drawer__status">
          <AppointmentStatusBadge status={row.status} />
          <span className="tv-muted">{reminderLabel(row.reminderStatus)}</span>
        </div>

        <div className="tv-drawer__actions">
          <button type="button" className="tv-btn tv-btn--primary tv-btn--sm" onClick={() => onAction("message")}>Message</button>
          {isActive && <button type="button" className="tv-btn tv-btn--outline tv-btn--sm" onClick={() => onAction("reschedule")}>Reschedule</button>}
          {isActive && <button type="button" className="tv-btn tv-btn--ghost tv-btn--sm tv-textdanger" onClick={() => onAction("cancel")}>Cancel</button>}
        </div>

        <div className="tv-drawer__section">
          <div className="tv-formsection">Details</div>
          <dl className="tv-deflist">
            <div><dt>Phone</dt><dd>{formatPhone(row.inviteePhone) || "—"}</dd></div>
            <div><dt>Email</dt><dd>{row.inviteeEmail ?? "—"}</dd></div>
            <div><dt>Staff</dt><dd>{row.metadata.staffName ?? "—"}</dd></div>
            <div><dt>Duration</dt><dd>{row.metadata.durationMinutes ? `${row.metadata.durationMinutes} min` : "—"}</dd></div>
            <div><dt>Location</dt><dd>{row.metadata.location ?? "—"}</dd></div>
            <div><dt>Source</dt><dd>{row.metadata.source === "booking_page" ? "Booking page" : row.metadata.source === "manual" ? "Created manually" : row.metadata.source === "import" ? "Imported" : "AI Booking"}</dd></div>
          </dl>
        </div>

        <div className="tv-drawer__section">
          <div className="tv-formsection">Reminder schedule</div>
          {schedule.length ? (
            <ul className="tv-schedlist">
              {schedule.map((s) => (
                <li key={s.label} className="tv-scheditem">
                  <span className={`tv-rdot ${s.state === "sent" ? "tv-rdot--green" : s.state === "scheduled" ? "tv-rdot--sky" : s.state === "failed" ? "tv-rdot--rose" : "tv-rdot--slate"}`} aria-hidden />
                  <span className="tv-strong" style={{ fontSize: 13 }}>{s.label}</span>
                  <span className="tv-muted" style={{ marginLeft: "auto" }}>{s.state === "sent" ? "Sent" : s.state === "scheduled" ? "Scheduled" : s.state === "failed" ? "Failed" : "Stopped"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="tv-muted">No reminders configured for this appointment.</p>
          )}
        </div>

        <div className="tv-drawer__section">
          <div className="tv-formsection">Last communication</div>
          <p className="tv-muted" style={{ margin: 0 }}>{lastCommunicationLabel(row.metadata)}</p>
        </div>

        <div className="tv-drawer__foot">
          <button type="button" className="tv-btn tv-btn--ghost tv-btn--sm" onClick={() => onAction("full")}>
            Open full details
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      </aside>
    </div>
  );
}
