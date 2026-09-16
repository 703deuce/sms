import "server-only";

import { getMctbAiBookingSessionStore, recordOfferedSlots } from "@/lib/mctb/ai-booking/session-store";
import { orchestrateMctbAiBooking } from "@/lib/mctb/ai-booking/orchestrator";
import { resolveCanonicalBookingTimezone } from "@/lib/mctb/ai-booking/booking-timezone";
import type { MctbBookingSlot } from "@/lib/mctb/ai-booking/types";
import { loadVoiceV2OfferSet } from "../offer-set-store";
import type { VoiceV2Slot } from "../types";
import type { VoiceV2RecoveryStructuredState } from "./types";

function mapVoiceSlotToMctb(slot: VoiceV2Slot, bookingTimezone: string): MctbBookingSlot {
  return {
    slotId: slot.slot_id,
    startUtc: slot.start_utc,
    endUtc: slot.end_utc,
    timezone: bookingTimezone,
    bookingTimezone,
    label: slot.label || slot.spoken_label,
    displayStart: slot.label,
  };
}

function providerFromStrategy(strategy?: string): "microsoft" | "calendly" {
  if (strategy === "CALENDLY") return "calendly";
  return "microsoft";
}

/**
 * Rehydrate canonical offer state for SMS text agent from durable Voice offer set,
 * or refresh via existing orchestrator FIND when stale.
 */
export async function rehydrateVoiceRecoveryOfferSetForSms(input: {
  workspaceId: string;
  conversationId: string;
  structuredState: VoiceV2RecoveryStructuredState;
  customerPhone?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  writeEpoch?: number;
}): Promise<{ ok: boolean; reason?: string }> {
  const booking = input.structuredState.booking;
  if (!booking?.offerSetId) return { ok: false, reason: "no_offer_set" };

  const store = getMctbAiBookingSessionStore();
  const existing = await store.get(input.conversationId);
  if (existing?.offeredSlots?.length) return { ok: true, reason: "already_hydrated" };

  const bookingTimezone = await resolveCanonicalBookingTimezone(input.workspaceId);
  const provider = providerFromStrategy(booking.strategy);
  const voiceOffer = await loadVoiceV2OfferSet(input.workspaceId, booking.offerSetId);

  if (voiceOffer?.slots?.length) {
    const slots = voiceOffer.slots.map((s) => mapVoiceSlotToMctb(s, voiceOffer.timezone || bookingTimezone));
    await store.save({
      conversationId: input.conversationId,
      workspaceId: input.workspaceId,
      provider,
      offerSetId: booking.offerSetId,
      bookingTimezone: voiceOffer.timezone || bookingTimezone,
      stage: "AWAITING_SLOT_SELECTION",
      offeredSlots: slots,
      pendingSlotId: booking.selectedSlotId ?? null,
      lastQueriedWindow: undefined,
      updatedAt: new Date().toISOString(),
    });
    return { ok: true };
  }

  const requestedDate = input.structuredState.schedulingPreference?.requestedDate;
  if (!requestedDate) {
    return { ok: false, reason: "offer_stale_no_scheduling_preference" };
  }

  const dayStart = new Date(`${requestedDate}T00:00:00`);
  const dayEnd = new Date(`${requestedDate}T23:59:59`);
  const result = await orchestrateMctbAiBooking({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    customerName: input.customerName || input.structuredState.callerFields.name || "Caller",
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail || input.structuredState.callerFields.email,
    windowStartUtc: dayStart.toISOString(),
    windowEndUtc: dayEnd.toISOString(),
    timezone: bookingTimezone,
    writeEpoch: input.writeEpoch,
  });

  if (result.kind === "offer_slots" && result.slots.length) {
    await recordOfferedSlots({
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      provider,
      bookingTimezone,
      slots: result.slots,
      window: { startUtc: dayStart.toISOString(), endUtc: dayEnd.toISOString() },
    });
    return { ok: true, reason: "refreshed_offer_set" };
  }

  return { ok: false, reason: "offer_refresh_failed" };
}
