"use client";

import { ArrowLeft } from "lucide-react";
import { Button, StatusBadge, fmtDate, fmtTime, initials } from "./ui";
import type { Appointment } from "../types";

const TERMINAL = new Set(["canceled", "completed", "no_show"]);

export function AppointmentHeader({
  appt,
  acting,
  onBack,
  onMessage,
  onReschedule,
  onConfirm,
  onComplete,
  onNoShow,
  onCancel,
}: {
  appt: Appointment;
  acting: boolean;
  onBack: () => void;
  onMessage: () => void;
  onReschedule: () => void;
  onConfirm: () => void;
  onComplete: () => void;
  onNoShow: () => void;
  onCancel: () => void;
}) {
  const isTerminal = TERMINAL.has(appt.status);
  const isOpen = ["scheduled", "awaiting_confirmation", "confirmed", "reschedule_requested"].includes(appt.status);
  return (
    <div style={{ marginBottom: 18 }}>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={14} /> Appointments
      </button>
      <div className="detail-header" style={{ marginTop: 12 }}>
        <div className="identity">
          <span className="avatar-lg" style={isTerminal ? { filter: "grayscale(0.6)", opacity: 0.75 } : undefined}>
            {initials(appt.inviteeName)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1>{appt.inviteeName}</h1>
              <StatusBadge status={appt.status} />
            </div>
            <div className="identity-meta">
              <span style={{ fontWeight: 600 }}>{appt.serviceName}</span>
              <span aria-hidden>·</span>
              <span>{fmtDate(appt.startsAt, appt.timezone)}</span>
              <span aria-hidden>·</span>
              <span>
                {fmtTime(appt.startsAt, appt.timezone)} – {fmtTime(appt.endsAt, appt.timezone)} ET
              </span>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <Button variant="outline" size="sm" onClick={onMessage}>Message customer</Button>
          {isOpen && (
            <>
              <Button variant="outline" size="sm" onClick={onReschedule}>Reschedule</Button>
              {appt.status === "awaiting_confirmation" && (
                <Button size="sm" disabled={acting} onClick={onConfirm}>Confirm</Button>
              )}
              {appt.status === "confirmed" && (
                <Button size="sm" disabled={acting} onClick={onComplete}>Mark complete</Button>
              )}
              <Button variant="ghost" size="sm" disabled={acting} onClick={onNoShow}>No-show</Button>
              <Button variant="danger" size="sm" disabled={acting} onClick={onCancel}>Cancel</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
