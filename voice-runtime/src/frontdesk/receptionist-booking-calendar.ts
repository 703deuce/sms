/**
 * Provider-agnostic booking calendar interface for the generic receptionist runtime.
 * Calendly, Google Calendar, GHL, etc. supply implementations via session wiring.
 */
import type { AvailableSlot, BookedAppointment } from "./calendly-calendar";

export type { AvailableSlot, BookedAppointment };

export interface ReceptionistBookingCalendar {
  readonly timezone: string;
  now(): Date;
  listAvailableSlots(input?: { daysAhead?: number }): Promise<AvailableSlot[]>;
  formatSlotsForModel(slots: AvailableSlot[]): string;
}
