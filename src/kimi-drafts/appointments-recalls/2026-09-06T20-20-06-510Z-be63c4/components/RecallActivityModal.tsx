"use client";

import { useEffect, useRef } from "react";
import { Bell, MessageSquare, RefreshCcw, User, X } from "lucide-react";
import type { RecallActivity } from "../mock-data";

const STATUS_CHIP: Record<RecallActivity["status"], string> = {
  Rebooked: "tv-chip tv-chip-success",
  Sent: "tv-chip tv-chip-info",
  "Awaiting reply": "tv-chip tv-chip-warning",
  Suppressed: "tv-chip tv-chip-muted",
};

export function RecallActivityModal({
  activity,
  onClose,
}: {
  activity: RecallActivity;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, a[href], [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const Icon = activity.type === "recall" ? Bell : RefreshCcw;
  const titleId = `recall-modal-${activity.id}`;

  return (
    <div className="tv-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="tv-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tv-modal-head">
          <span className={`tv-icon-badge ${activity.type === "recall" ? "tv-icon-recall" : "tv-icon-noshow"}`} aria-hidden="true">
            <Icon size={16} strokeWidth={1.8} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id={titleId} className="tv-modal-title">{activity.customer}</h2>
            <p className="tv-modal-sub">{activity.phone}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="tv-icon-btn"
            onClick={onClose}
            aria-label={`Close activity details for ${activity.customer}`}
          >
            <X size={16} />
          </button>
        </div>

        <div className="tv-modal-body">
          <div className="tv-detail-row">
            <span className="tv-detail-label">Activity</span>
            <span>{activity.detail}</span>
          </div>
          <div className="tv-detail-row">
            <span className="tv-detail-label">Status</span>
            <span className={STATUS_CHIP[activity.status]}>{activity.status}</span>
          </div>
          <div className="tv-detail-row">
            <span className="tv-detail-label">Time</span>
            <span>{activity.time}</span>
          </div>
          <div className="tv-detail-row">
            <span className="tv-detail-label">Channel</span>
            <span>{activity.channel}</span>
          </div>
          <div className="tv-detail-row">
            <span className="tv-detail-label">Source</span>
            <span>{activity.source}</span>
          </div>
          {activity.note ? (
            <div className="tv-detail-note">{activity.note}</div>
          ) : null}
        </div>

        <div className="tv-modal-foot">
          <a className="tv-btn" href="/conversations">
            <MessageSquare size={14} />
            View conversation
          </a>
          <a className="tv-btn" href="/contacts">
            <User size={14} />
            Open contact
          </a>
        </div>
      </div>
    </div>
  );
}
