"use client";

/**
 * MCTB light-booking Reminders — presentation wrapper around canonical RemindersConnected.
 * Reminder backend, scheduler, SMS/email delivery remain shared.
 */

import { RemindersConnected } from "@/features/appointments/kimi/reminders/reminders-connected";
import "@/components/mctb/booking/mctb-light-booking.css";

export function MctbRemindersConnected() {
  return (
    <div className="mctb-booking-shell">
      <header className="mctb-booking-page-header">
        <div>
          <h1 className="mctb-booking-page-title">Reminders</h1>
          <p className="mctb-booking-page-subtitle">
            Automatically confirm appointments and remind customers before they start.
          </p>
        </div>
      </header>
      <RemindersConnected />
    </div>
  );
}
