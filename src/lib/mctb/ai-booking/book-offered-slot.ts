import { createBooking, findAvailableTimes, getBookingContext } from "@/lib/mctb/ai-booking/service";
import { getMctbAiBookingSessionStore, recordOfferedSlots } from "@/lib/mctb/ai-booking/session-store";
import {
  buildOfferSelectionClarification,
  formatMctbBookingSlotLabel,
  isProviderSlotConflictReason,
} from "@/lib/mctb/ai-booking/offered-slot-selection";
import { pickSlotsToOffer } from "@/lib/mctb/ai-booking/slot-presentation";
import { revalidatePersistedOfferedSlot } from "@/lib/mctb/ai-booking/revalidate-offered-slot";
import { logMctbAiBookingEvent } from "@/lib/mctb/ai-booking/observability";
import type { CreateBookingResult, MctbBookingSlot } from "@/lib/mctb/ai-booking/types";
import type { AiBookingOrchestratorResult } from "@/lib/mctb/ai-booking/types";

export type BookValidatedOfferedSlotInput = {
  workspaceId: string;
  conversationId: string;
  contactId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  slotId: string;
  writeEpoch?: number;
  /** For booking identity audit trail */
  semanticSelectedSlotId?: string | null;
};

/**
 * Create booking for a slot id already validated against session.offeredSlots (no utterance parsing).
 */
export async function bookValidatedOfferedSlot(
  input: BookValidatedOfferedSlotInput,
): Promise<
  | { status: "booked"; result: Extract<CreateBookingResult, { ok: true }>; messageHint: string }
  | { status: "book_failed"; reason: string; orchestratorResult: AiBookingOrchestratorResult }
> {
  const session = await getMctbAiBookingSessionStore().get(input.conversationId);
  const offered = session?.offeredSlots ?? [];
  const picked = offered.find((s) => s.slotId === input.slotId);
  if (!picked) {
    return {
      status: "book_failed",
      reason: "slot_not_in_offer",
      orchestratorResult: {
        kind: "need_clarification",
        messageHint: buildOfferSelectionClarification(offered),
      },
    };
  }

  const runtimeSelectedSlotId = picked.slotId;
  const semanticSelectedSlotId = input.semanticSelectedSlotId?.trim() || runtimeSelectedSlotId;
  if (semanticSelectedSlotId !== runtimeSelectedSlotId) {
    logMctbAiBookingEvent("booking_slot_identity_mismatch", {
      conversationId: input.conversationId,
      semantic_selected_slot_id: semanticSelectedSlotId,
      runtime_selected_slot_id: runtimeSelectedSlotId,
    });
    return {
      status: "book_failed",
      reason: "CLARIFICATION_REQUIRED",
      orchestratorResult: {
        kind: "need_clarification",
        messageHint: buildOfferSelectionClarification(offered),
      },
    };
  }

  const revalidated = await revalidatePersistedOfferedSlot({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    slot: picked,
  });
  if (!revalidated.ok) {
    const win = session?.lastQueriedWindow;
    const tz = picked.timezone || "America/New_York";
    if (revalidated.reason === "SLOT_NO_LONGER_AVAILABLE" && win) {
      const retry = await findAvailableTimes({
        workspaceId: input.workspaceId,
        conversationId: input.conversationId,
        windowStartUtc: win.startUtc,
        windowEndUtc: win.endUtc,
        timezone: tz,
        maxResults: 12,
      });
      if (retry?.ok && retry.slots.length) {
        const fresh = pickSlotsToOffer(retry.slots, 3);
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
          reason: "SLOT_NO_LONGER_AVAILABLE",
          orchestratorResult: {
            kind: "offer_slots",
            slots: fresh,
            messageHint: `That time is no longer available. Here are openings that still work: ${fresh.map((s) => formatMctbBookingSlotLabel(s)).join(", ")}.`,
          },
        };
      }
    }
    return {
      status: "book_failed",
      reason: revalidated.reason,
      orchestratorResult: {
        kind: "need_clarification",
        messageHint: `That time is no longer available. ${buildOfferSelectionClarification(offered)}`,
      },
    };
  }

  logMctbAiBookingEvent("booking_slot_identity", {
    conversationId: input.conversationId,
    semantic_selected_slot_id: semanticSelectedSlotId,
    runtime_selected_slot_id: runtimeSelectedSlotId,
    provider_requested_slot_id: picked.slotId,
    provider_requested_start_utc: picked.startUtc,
  });

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
    logMctbAiBookingEvent("booking_slot_identity_confirmed", {
      conversationId: input.conversationId,
      semantic_selected_slot_id: semanticSelectedSlotId,
      runtime_selected_slot_id: runtimeSelectedSlotId,
      provider_created_start_utc: booked.startUtc,
      provider_booking_id: booked.providerBookingId,
    });
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

  const { fallbackUrl } = await getBookingContext(input.workspaceId);
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
