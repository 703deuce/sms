"use client";

import { Bell, MessageSquare, Mail, ShieldAlert } from "lucide-react";
import { Card, StatusBadge, fmtDateTime } from "./ui";
import type { ReminderStep } from "../types";

export function ReminderSchedule({
  steps,
  suppressed,
  consentMissing,
  readOnly,
  onToggleSuppressed,
}: {
  steps: ReminderStep[];
  suppressed: boolean;
  consentMissing?: boolean;
  readOnly?: boolean;
  onToggleSuppressed: (v: boolean) => void;
}) {
  return (
    <Card
      title={
        <>
          <Bell size={15} className="muted" /> Reminder schedule
        </>
      }
      sub="Standard reminders — workspace default"
    >
      {consentMissing ? (
        <div className="banner banner-danger" style={{ marginBottom: 10 }}>
          <ShieldAlert size={17} className="banner-icon" style={{ color: "#f04438" }} />
          <span className="banner-body">
            <div className="banner-title" style={{ color: "#912018" }}>SMS consent missing</div>
            <div className="banner-text" style={{ color: "#b42318" }}>
              Transovo did not capture SMS consent for this appointment, so SMS reminders will not be sent.
              This appointment was imported — business texting registration and recipient permission are required before SMS can be used.
            </div>
          </span>
        </div>
      ) : null}
      {suppressed ? (
        <div className="banner" style={{ marginBottom: 10 }}>
          <span className="banner-body">
            <div className="banner-title">Reminders suppressed</div>
            <div className="banner-text">No reminder messages will be sent for this appointment.</div>
          </span>
        </div>
      ) : null}
      <div>
        {steps.map((s) => (
          <div className="reminder-row" key={s.key}>
            <span className="reminder-icon">
              {s.channel === "SMS" ? <MessageSquare size={15} /> : <Mail size={15} />}
            </span>
            <div className="reminder-body">
              <div className="reminder-name">{s.label}</div>
              <div className="reminder-when">
                {s.status === "sent" ? "Sent " : s.status === "disabled" ? "Not scheduled — was " : "Scheduled for "}
                {s.scheduledFor ? fmtDateTime(s.scheduledFor) : "—"} · {s.channel}
              </div>
            </div>
            <StatusBadge status={s.status} />
          </div>
        ))}
      </div>
      <hr className="section-divider" />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Suppress reminders for this appointment</div>
          <div className="muted small">Override for this appointment only. Workspace default is unaffected.</div>
        </div>
        <button
          role="switch"
          aria-checked={suppressed}
          aria-label="Suppress reminders for this appointment"
          className={`toggle${suppressed ? " on" : ""}`}
          disabled={readOnly}
          style={readOnly ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          onClick={() => !readOnly && onToggleSuppressed(!suppressed)}
        />
      </div>
    </Card>
  );
}
