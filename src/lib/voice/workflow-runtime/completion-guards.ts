import type { AmyRealtimeSession } from "@/lib/voice/realtime-session/types";

export type BookingReceipt = {
  bookingId: string;
  start?: string | null;
};

export function hasBookingReceipt(session: AmyRealtimeSession): boolean {
  if (session.bookingId?.trim()) return true;
  if (session.confirmationState === "confirmed") return true;
  if (session.runtime.confirmation_received) return true;
  const runtimeBooking = session.runtime.booking_id;
  return typeof runtimeBooking === "string" && runtimeBooking.trim().length > 0;
}

export function getBookingReceipt(session: AmyRealtimeSession): BookingReceipt | null {
  const bookingId =
    session.bookingId?.trim() ||
    (typeof session.runtime.booking_id === "string" ? session.runtime.booking_id.trim() : "");
  if (!bookingId) return null;
  return {
    bookingId,
    start: session.heldSlot || session.selectedSlot || null,
  };
}

export function hasHeldSlot(session: AmyRealtimeSession): boolean {
  return Boolean(session.heldSlot || session.selectedSlot || session.runtime.held_slot);
}

export function hasAvailableSlots(session: AmyRealtimeSession): boolean {
  return (session.availableSlots || []).length > 0;
}

/** Caller is mid-booking: slot held or offered but not yet confirmed. */
export function isBookingInProgress(session: AmyRealtimeSession): boolean {
  if (hasBookingReceipt(session)) return false;
  return hasHeldSlot(session) || hasAvailableSlots(session);
}

/** Scheduling started or slot selected — ending as "booked" must be blocked. */
export function requiresBookingReceiptToComplete(session: AmyRealtimeSession): boolean {
  if (hasBookingReceipt(session)) return false;
  return isBookingInProgress(session) || hasHeldSlot(session);
}

export function missingRequiredFieldCount(session: AmyRealtimeSession): number {
  return session.fieldManifest.filter(
    (field) => field.required && !session.collectedFields[field.field_id]?.trim(),
  ).length;
}

export function fieldsComplete(session: AmyRealtimeSession): boolean {
  return missingRequiredFieldCount(session) === 0;
}
