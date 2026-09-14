import { createBooking } from "@/lib/mctb/ai-booking/service";
import { getMctbAiBookingSessionStore } from "@/lib/mctb/ai-booking/session-store";
import {
  buildOfferSelectionClarification,
  formatMctbBookingSlotLabel,
  isProviderSlotConflictReason,
  resolveCustomerChoiceAmongOfferedSlots,
} from "@/lib/mctb/ai-booking/offered-slot-selection";
import { findAvailableTimes } from "@/lib/mctb/ai-booking/service";
import { pickSlotsToOffer } from "@/lib/mctb/ai-booking/slot-presentation";
import { recordOfferedSlots } from "@/lib/mctb/ai-booking/session-store";
import type { CreateBookingResult, MctbBookingSlot } from "@/lib/mctb/ai-booking/types";
import type { AiBookingOrchestratorResult } from "@/lib/mctb/ai-booking/types";

const RESCHEDULE_SIGNAL =
  /\b(none of those|different day|another day|other times|something else|not those|won't work|doesn't work)\b/i;

export function customerWantsNewAvailabilitySearch(utterance: string): boolean {
  return RESCHEDULE_SIGNAL.test(utterance);
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

export type BookOfferedSlotInput = {
  workspaceId: string;
  conversationId: string;
  contactId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  utterance: string;
  writeEpoch?: number;
};

/**
 * Customer already received a short list of calendar slots. Map their reply to one of those
 * and book it — no second availability query before create.
 */
export async function tryBookFromOfferedSlots(
  input: BookOfferedSlotInput,
): Promise<
  | { status: "no_offered_slots" }
  | { status: "needs_clarification"; messageHint: string; offered: MctbBookingSlot[] }
  | { status: "booked"; result: Extract<CreateBookingResult, { ok: true }>; messageHint: string }
  | { status: "book_failed"; reason: string; orchestratorResult: AiBookingOrchestratorResult }
> {
  const session = await getMctbAiBookingSessionStore().get(input.conversationId);
  const offered = session?.offeredSlots ?? [];
  if (!offered.length) {
    return { status: "no_offered_slots" };
  }

  if (customerWantsNewAvailabilitySearch(input.utterance)) {
    return { status: "no_offered_slots" };
  }

  const picked = resolveCustomerChoiceAmongOfferedSlots(offered, input.utterance);
  if (!picked) {
    return {
      status: "needs_clarification",
      messageHint: buildOfferSelectionClarification(offered),
      offered,
    };
  }

  const booked = await createBooking({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    contactId: input.contactId,
    slotId: picked.slotId,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    writeEpoch: input.writeEpoch,
  });

  if (booked.ok) {
    const messageHint = `You're booked for ${formatMctbBookingSlotLabel({
      slotId: picked.slotId,
      startUtc: booked.startUtc,
      endUtc: booked.endUtc,
      timezone: booked.timezone,
    })}.`;
    return { status: "booked", result: booked, messageHint };
  }

  if (isProviderSlotConflictReason(booked.reason)) {
    const win = session?.lastQueriedWindow;
    const tz = offered[0]?.timezone || "America/New_York";
    const retry =
      win &&
      (await findAvailableTimes({
        workspaceId: input.workspaceId,
        conversationId: input.conversationId,
        windowStartUtc: win.startUtc,
        windowEndUtc: win.endUtc,
        timezone: tz,
        maxResults: 12,
      }));
    if (retry?.ok && retry.slots.length) {
      const fresh = pickSlotsToOffer(retry.slots, 3);
      const { getBookingContext } = await import("@/lib/mctb/ai-booking/service");
      const { config } = await getBookingContext(input.workspaceId);
      await recordOfferedSlots({
        workspaceId: input.workspaceId,
        conversationId: input.conversationId,
        provider: config.provider,
        slots: fresh,
        window: retry.queriedWindow,
      });
      return {
        status: "book_failed",
        reason: booked.reason,
        orchestratorResult: {
          kind: "offer_slots",
          slots: fresh,
          messageHint: `That time was just taken. I can still do ${fresh.map((s) => formatMctbBookingSlotLabel(s)).join(", ")}.`,
        },
      };
    }
    return {
      status: "book_failed",
      reason: booked.reason,
      orchestratorResult: {
        kind: "need_clarification",
        messageHint: `That time was just taken. ${buildOfferSelectionClarification(offered)}`,
      },
    };
  }

  const { fallbackUrl } = await import("@/lib/mctb/ai-booking/service").then((m) =>
    m.getBookingContext(input.workspaceId),
  );
  return {
    status: "book_failed",
    reason: booked.reason,
    orchestratorResult: {
      kind: "fallback_link",
      url: fallbackUrl.fallbackUrl || "",
      reason: booked.reason,
      messageHint: fallbackUrl.fallbackUrl
        ? `I couldn't complete the booking. You can pick a time here: ${fallbackUrl.fallbackUrl}`
        : "I couldn't complete the booking. Please call us or try another time.",
    },
  };
}
