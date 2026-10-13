import { AppointmentsCalendarClient } from "@/components/appointments/calendar-client";

/**
 * Legacy scheduling calendar route — kept reachable until Opus calendar (/appointment-reminders)
 * reaches full parity (drag, waitlist, filters). Unified nav home remains Opus.
 */
export default function AppointmentsCalendarPage() {
  return <AppointmentsCalendarClient />;
}
