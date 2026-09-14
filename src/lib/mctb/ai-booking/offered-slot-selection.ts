import type { MctbBookingSlot } from "@/lib/mctb/ai-booking/types";

export function formatMctbBookingSlotLabel(slot: MctbBookingSlot): string {
  if (slot.displayStart?.trim()) return slot.displayStart.trim();
  const d = new Date(slot.startUtc);
  const tz = slot.bookingTimezone || slot.timezone;
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
}

export function buildCustomerOfferSms(slots: MctbBookingSlot[]): string {
  const labels = slots.map(formatMctbBookingSlotLabel);
  if (labels.length === 1) {
    return `We have an opening at ${labels[0]}. Does that work?`;
  }
  if (labels.length === 2) {
    return `We have openings at ${labels[0]} and ${labels[1]}. Do either work?`;
  }
  return `We have openings at ${labels[0]}, ${labels[1]}, and ${labels[2]}. Do any of those work?`;
}

export function isProviderSlotConflictReason(reason: string): boolean {
  const r = reason.toLowerCase();
  return (
    r.includes("conflict") ||
    r.includes("not available") ||
    r.includes("unavailable") ||
    r.includes("busy") ||
    r.includes("double") ||
    r.includes("slot_taken") ||
    r.includes("already booked")
  );
}

export function buildOfferSelectionClarification(slots: MctbBookingSlot[]): string {
  const labels = slots.map(formatMctbBookingSlotLabel);
  if (labels.length === 1) {
    return `Just let me know if ${labels[0]} works for you.`;
  }
  return `Which time works best — ${labels.join(", ")}?`;
}
