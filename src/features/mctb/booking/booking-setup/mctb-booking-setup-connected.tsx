"use client";

/**
 * MCTB Booking Setup — derived from canonical Meetings workspace (simplest booking type editor).
 * Uses shared appointment type APIs and availability engine.
 */

import { MeetingsWorkspaceConnected } from "@/components/appointments/meetings/meetings-workspace-connected";
import "@/components/mctb/booking/mctb-light-booking.css";

type Props = {
  meetingId: string | null;
};

export function MctbBookingSetupConnected({ meetingId }: Props) {
  return (
    <div className="mctb-booking-shell">
      <header className="mctb-booking-page-header">
        <div>
          <h1 className="mctb-booking-page-title">Booking Setup</h1>
          <p className="mctb-booking-page-subtitle">
            Choose what customers can book and when you&apos;re available.
          </p>
        </div>
      </header>
      <MeetingsWorkspaceConnected meetingId={meetingId} />
    </div>
  );
}
