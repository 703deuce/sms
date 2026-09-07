"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Modal } from "./ui";
import type { Appointment } from "../types";

export function CancelModal({
  appt,
  onClose,
  onConfirm,
}: {
  appt: Appointment;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);

  const pendingReminders = appt.reminderSchedule.filter(
    (s) => s.status === "scheduled",
  ).length;

  return (
    <Modal
      title="Cancel this appointment?"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Keep appointment</Button>
          <Button
            variant="danger"
            disabled={confirming}
            onClick={() => {
              setConfirming(true);
              setTimeout(onConfirm, 500);
            }}
          >
            {confirming ? "Canceling…" : "Yes, cancel appointment"}
          </Button>
        </>
      }
    >
      <div className="banner banner-danger" style={{ marginBottom: 14 }}>
        <AlertTriangle size={17} className="banner-icon" style={{ color: "#f04438" }} />
        <span className="banner-body">
          <div className="banner-title" style={{ color: "#912018" }}>This can’t be undone</div>
          <div className="banner-text" style={{ color: "#b42318" }}>
            {appt.inviteeName} will be notified by SMS and email that the appointment was canceled.
          </div>
        </span>
      </div>
      <ul className="muted small" style={{ margin: "0 0 14px", paddingLeft: 18, lineHeight: 1.7 }}>
        <li>
          {pendingReminders > 0
            ? `${pendingReminders} pending reminder${pendingReminders === 1 ? "" : "s"} will be stopped immediately.`
            : "No pending reminders to stop."}
        </li>
        <li>The calendar event will be removed.</li>
        <li>The time slot becomes bookable again.</li>
        {appt.paymentStatus === "paid" ? (
          <li>The {`$${(appt.paymentAmountCents / 100).toFixed(2)}`} deposit is not refunded automatically — issue a refund separately if needed.</li>
        ) : null}
      </ul>
      <label className="field-label" htmlFor="cancel-reason">
        Reason <span className="muted" style={{ fontWeight: 500 }}>— Optional, internal only</span>
      </label>
      <textarea
        id="cancel-reason"
        className="textarea"
        style={{ minHeight: 60 }}
        placeholder="e.g. Customer requested cancellation by phone"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
    </Modal>
  );
}
