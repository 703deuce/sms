"use client";

import { useState } from "react";
import { Button, Modal, fmtDay, fmtTime } from "./ui";

export function RescheduleModal({
  timezone,
  slots,
  loading,
  onClose,
  onSave,
}: {
  timezone: string;
  slots: Array<{ startsAt: string; endsAt?: string }>;
  loading?: boolean;
  onClose: () => void;
  onSave: (startsAt: string) => void;
}) {
  const [selected, setSelected] = useState<string>("");
  const [saving, setSaving] = useState(false);

  return (
    <Modal
      title="Reschedule appointment"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!selected || saving || loading}
            onClick={() => {
              setSaving(true);
              onSave(selected);
            }}
          >
            {saving ? "Saving…" : "Save new time"}
          </Button>
        </>
      }
    >
      <p className="muted small" style={{ marginTop: 0 }}>
        Choose a new time. The customer will receive an updated confirmation and reminders will be recalculated.
        Times shown in Eastern Time.
      </p>
      {loading ? (
        <p className="muted small">Loading available times…</p>
      ) : slots.length === 0 ? (
        <p className="muted small">No open slots in the next 14 days.</p>
      ) : (
        <div className="slot-grid" role="radiogroup" aria-label="Available times">
          {slots.map((s) => (
            <button
              key={s.startsAt}
              role="radio"
              aria-checked={selected === s.startsAt}
              className={`slot${selected === s.startsAt ? " selected" : ""}`}
              onClick={() => setSelected(s.startsAt)}
            >
              <div className="slot-day">{fmtDay(s.startsAt, timezone)}</div>
              <div className="slot-time">{fmtTime(s.startsAt, timezone)}</div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
