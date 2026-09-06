"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, CalendarClock, CheckCircle2, MessageSquare, X } from "lucide-react";
import type { NoShowRow } from "../mock-data";

type TimelineEvent = {
  label: string;
  detail: string;
  state: "done" | "current" | "pending";
};

function buildTimeline(row: NoShowRow): TimelineEvent[] {
  const events: TimelineEvent[] = [
    { label: "Appointment scheduled", detail: `${row.scheduledFor} EDT · booked via booking page`, state: "done" },
    { label: "Marked as no-show", detail: "Automatic scan — no check-in 30 minutes after start (grace period)", state: "done" },
  ];
  if (row.status === "No response") {
    events.push(
      { label: "Recovery SMS sent", detail: "Step 1 — 15 minutes after no-show", state: "done" },
      { label: "Follow-up SMS", detail: "Step 2 — scheduled 24 hours after no-show if no reply", state: "current" },
      { label: "Customer rebooks", detail: "Workflow stops automatically when a new booking is confirmed", state: "pending" },
    );
  } else if (row.status === "Recovery sent") {
    events.push(
      { label: "Recovery SMS sent", detail: "Step 1 — 15 minutes after no-show", state: "done" },
      { label: "Awaiting reply", detail: "Follow-up scheduled if the customer doesn’t respond", state: "current" },
      { label: "Customer rebooks", detail: "Workflow stops automatically when a new booking is confirmed", state: "pending" },
    );
  } else if (row.status === "Replied") {
    events.push(
      { label: "Recovery SMS sent", detail: "Step 1 — 15 minutes after no-show", state: "done" },
      { label: "Customer replied", detail: "Reply received — conversation continues in Messages", state: "current" },
      { label: "Customer rebooks", detail: "Workflow stops automatically when a new booking is confirmed", state: "pending" },
    );
  } else {
    events.push(
      { label: "Recovery SMS sent", detail: "Step 1 — 15 minutes after no-show", state: "done" },
      { label: "Customer replied", detail: "Reply received via recovery link", state: "done" },
      { label: "Rebooked", detail: "New appointment confirmed — workflow ended", state: "done" },
    );
  }
  return events;
}

export function RecoveryDetailDrawer({
  row,
  workflowInstalled,
  onClose,
  onMarkRebooked,
}: {
  row: NoShowRow;
  workflowInstalled: boolean;
  onClose: () => void;
  onMarkRebooked: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const timeline = buildTimeline(row);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="nsr-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nsr-drawer" role="dialog" aria-modal="true" aria-labelledby="nsr-drawer-title">
        <div className="nsr-drawer-head">
          <div>
            <div className="nsr-modal-title" id="nsr-drawer-title">{row.customer}</div>
            <div className="nsr-modal-desc">{row.bookingType} · {row.scheduledFor} EDT</div>
          </div>
          <button className="nsr-modal-x" ref={closeRef} onClick={onClose} aria-label="Close panel">
            <X size={16} />
          </button>
        </div>

        <div className="nsr-drawer-body">
          <div className="nsr-drawer-section-title">Recovery timeline</div>
          <div className="nsr-timeline">
            {timeline.map((t, i) => (
              <div className="nsr-tl-item" key={i}>
                <span className={`nsr-tl-dot nsr-tl-${t.state}`} aria-hidden="true">
                  {t.state === "done" && <CheckCircle2 size={14} />}
                  {t.state === "current" && <span className="nsr-tl-pulse" />}
                  {t.state === "pending" && <span className="nsr-tl-hollow" />}
                </span>
                <div className="nsr-tl-body">
                  <div className={`nsr-tl-label ${t.state === "pending" ? "nsr-tl-muted" : ""}`}>{t.label}</div>
                  <div className="nsr-tl-detail">{t.detail}</div>
                </div>
              </div>
            ))}
          </div>

          {!workflowInstalled && (
            <div className="nsr-help" style={{ marginTop: 14 }}>
              The recovery workflow isn’t installed, so no automatic follow-ups were sent for this appointment.
            </div>
          )}
        </div>

        <div className="nsr-modal-foot">
          {row.status === "Replied" && (
            <button className="nsr-btn nsr-btn-outline">
              <MessageSquare size={14} /> Open conversation
            </button>
          )}
          {row.status !== "Rebooked" && (
            <button className="nsr-btn nsr-btn-primary" onClick={onMarkRebooked}>
              <CalendarClock size={14} /> Mark as rebooked
            </button>
          )}
          <button className="nsr-btn nsr-btn-outline">
            Open full appointment <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
