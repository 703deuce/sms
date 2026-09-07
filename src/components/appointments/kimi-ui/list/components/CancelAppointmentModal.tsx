import { useState } from "react";
import { Modal } from "./Modal";
import { formatDay, formatTime, type AppointmentRow } from "../list-types";

export function CancelAppointmentModal({
  row,
  onClose,
  onCanceled,
}: {
  row: AppointmentRow | null;
  onClose: () => void;
  onCanceled: (id: string) => void | Promise<void>;
}) {
  const [notify, setNotify] = useState(true);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  if (!row) return null;
  const scheduled = (row.metadata.reminderSchedule ?? []).filter((s) => s.state === "scheduled");

  const confirm = async () => {
    setSaving(true);
    try {
      await onCanceled(row.id);
      setReason("");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!row}
      onClose={onClose}
      title={`Cancel appointment for ${row.inviteeName ?? "this customer"}?`}
      description={`${row.serviceName ?? "Appointment"} · ${formatDay(row.startsAt, row.timezone)} at ${formatTime(row.startsAt, row.timezone)}`}
      footer={
        <>
          <button type="button" className="tv-btn tv-btn--ghost" onClick={onClose}>Keep appointment</button>
          <button type="button" className="tv-btn tv-btn--danger" onClick={confirm} disabled={saving}>
            {saving ? "Canceling…" : "Cancel appointment"}
          </button>
        </>
      }
    >
      <div className="tv-warningbox" role="note">
        <span className="tv-strong" style={{ fontSize: 13 }}>Impact on reminders</span>
        <ul className="tv-warninglist">
          {scheduled.length > 0 ? (
            scheduled.map((s) => <li key={s.label}>{s.label} — will be stopped</li>)
          ) : (
            <li>No pending reminders on this appointment.</li>
          )}
          <li>The calendar event will be removed.</li>
          {notify && <li>The customer will receive a cancellation message.</li>}
        </ul>
      </div>
      <div className="tv-field" style={{ marginTop: 14 }}>
        <label className="tv-fieldlabel" htmlFor="cx-reason">Reason — Optional</label>
        <textarea id="cx-reason" className="tv-textarea" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer asked to cancel…" />
      </div>
      <label className="tv-checkrow" style={{ marginTop: 12 }} htmlFor="cx-notify">
        <input id="cx-notify" type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        <span className="tv-strong" style={{ fontSize: 13 }}>Notify the customer by SMS</span>
      </label>
    </Modal>
  );
}
