import { loadMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";
import type { MctbAiBookingSession, MctbBookingSlot } from "@/lib/mctb/ai-booking/types";
import { formatMctbBookingSlotLabel } from "@/lib/mctb/ai-booking/offered-slot-selection";

/** Single authoritative IANA timezone for an AI Booking transaction. */
export async function resolveCanonicalBookingTimezone(workspaceId: string): Promise<string> {
  const config = await loadMctbAiBookingConfig(workspaceId);
  if (config.timezone?.trim()) {
    return config.timezone.trim();
  }
  const { getBookingContext } = await import("@/lib/mctb/ai-booking/service");
  const { context } = await getBookingContext(workspaceId);
  return context.timezone?.trim() || "America/New_York";
}

export function slotBookingTimezone(slot: MctbBookingSlot): string {
  return (slot.bookingTimezone || slot.timezone || "").trim();
}

export function enrichSlotWithBookingTimezone(
  slot: MctbBookingSlot,
  bookingTimezone: string,
): MctbBookingSlot {
  const tz = bookingTimezone.trim();
  const enriched: MctbBookingSlot = {
    ...slot,
    timezone: tz,
    bookingTimezone: tz,
    displayStart: formatMctbBookingSlotLabel({ ...slot, timezone: tz }),
    displayEnd: formatMctbBookingSlotLabel({
      ...slot,
      startUtc: slot.endUtc,
      timezone: tz,
    }),
  };
  return enriched;
}

export function stampSlotsWithCanonicalTimezone(
  slots: MctbBookingSlot[],
  bookingTimezone: string,
): MctbBookingSlot[] {
  return slots.map((s) => enrichSlotWithBookingTimezone(s, bookingTimezone));
}

export type BookingTimezoneConflict = {
  ok: false;
  code: "BOOKING_TIMEZONE_CONFLICT";
  bookingTimezone: string;
  conflicts: Array<{ source: string; timezone: string }>;
};

export function assertBookingTimezoneCoherent(input: {
  bookingTimezone: string;
  session?: MctbAiBookingSession | null;
  orchestratorTimezone?: string | null;
  offeredSlots?: MctbBookingSlot[];
}): { ok: true } | BookingTimezoneConflict {
  const canonical = input.bookingTimezone.trim();
  const conflicts: Array<{ source: string; timezone: string }> = [];

  if (input.session?.bookingTimezone && input.session.bookingTimezone.trim() !== canonical) {
    conflicts.push({ source: "session.bookingTimezone", timezone: input.session.bookingTimezone });
  }
  if (input.orchestratorTimezone && input.orchestratorTimezone.trim() !== canonical) {
    conflicts.push({ source: "orchestrator.timezone", timezone: input.orchestratorTimezone });
  }
  const slots = input.offeredSlots ?? input.session?.offeredSlots ?? [];
  for (const slot of slots) {
    const stz = slotBookingTimezone(slot);
    if (stz && stz !== canonical) {
      conflicts.push({ source: `offeredSlot:${slot.slotId}`, timezone: stz });
    }
  }

  if (conflicts.length) {
    return { ok: false, code: "BOOKING_TIMEZONE_CONFLICT", bookingTimezone: canonical, conflicts };
  }
  return { ok: true };
}
