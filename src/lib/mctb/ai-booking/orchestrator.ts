import {
  findAvailableTimes,
  createBooking,
  getBookingContext,
} from "@/lib/mctb/ai-booking/service";
import {
  filterSlotsWithinWindow,
  findSlotAtTime,
  formatMctbBookingSlotLabel,
  nearestSlotAlternatives,
  pickSlotsToOffer,
} from "@/lib/mctb/ai-booking/slot-presentation";
import { getMctbAiBookingSessionStore, recordOfferedSlots } from "@/lib/mctb/ai-booking/session-store";
import type { AiBookingOrchestratorResult, MctbBookingSlot } from "@/lib/mctb/ai-booking/types";

export type OrchestrateAiBookingInput = {
  workspaceId: string;
  conversationId: string;
  contactId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  /** Pre-normalized window from NL layer — never substitute static hour copy for availability. */
  windowStartUtc: string;
  windowEndUtc: string;
  timezone: string;
  /** Specific instant to verify, e.g. customer asked for 2:00 PM */
  specificTimeUtc?: string | null;
  /** When specialist resolved a concrete offered slot id */
  selectedSlotId?: string | null;
  /** When true, attempt createBooking for resolved slot */
  confirmBooking?: boolean;
  /** Lead Recovery write epoch — required for provider create in production path */
  writeEpoch?: number;
};

async function persistCustomerOfferedSlots(
  input: OrchestrateAiBookingInput,
  slots: MctbBookingSlot[],
  window: { startUtc: string; endUtc: string },
) {
  const { config: bookingCfg } = await getBookingContext(input.workspaceId);
  await recordOfferedSlots({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    provider: bookingCfg.provider,
    slots,
    window,
  });
}

async function fallbackResult(
  workspaceId: string,
  reason: string,
): Promise<Extract<AiBookingOrchestratorResult, { kind: "fallback_link" }>> {
  const { fallbackUrl } = await getBookingContext(workspaceId);
  const url = fallbackUrl || "";
  return {
    kind: "fallback_link",
    url,
    reason,
    messageHint: url
      ? `I'm unable to check live availability right now. You can choose a time here: ${url}`
      : "I'm unable to check live availability right now. Please call back or reply with another time.",
  };
}

/**
 * Stateful scheduling orchestration. Availability always comes from provider queries.
 */
export async function orchestrateMctbAiBooking(
  input: OrchestrateAiBookingInput,
): Promise<AiBookingOrchestratorResult> {
  const session = await getMctbAiBookingSessionStore().get(input.conversationId);

  const selectionAttempt =
    input.confirmBooking ||
    input.selectedSlotId != null ||
    (input.specificTimeUtc != null && (session?.offeredSlots?.length ?? 0) > 0);

  if (selectionAttempt) {
    const offered = session?.offeredSlots ?? [];
    const chosen =
      (input.selectedSlotId
        ? offered.find((s) => s.slotId === input.selectedSlotId) ?? null
        : null) ??
      (input.specificTimeUtc && offered.length
        ? findSlotAtTime(offered, input.specificTimeUtc)
        : null);
    if (!chosen) {
      return {
        kind: "need_clarification",
        messageHint: "Which of the times I offered works best for you?",
      };
    }
    if (!input.confirmBooking) {
      return {
        kind: "need_clarification",
        messageHint: `Did you want ${formatMctbBookingSlotLabel(chosen)}? Reply to confirm.`,
      };
    }
    const booked = await createBooking({
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      contactId: input.contactId,
      slotId: chosen.slotId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      writeEpoch: input.writeEpoch,
    });
    if (!booked.ok) {
      if (booked.reason === "slot_taken") {
        const retry = await findAvailableTimes({
          workspaceId: input.workspaceId,
          conversationId: input.conversationId,
          windowStartUtc: input.windowStartUtc,
          windowEndUtc: input.windowEndUtc,
          timezone: input.timezone,
          maxResults: 12,
        });
        if (retry.ok && retry.slots.length) {
          const offer = pickSlotsToOffer(retry.slots, 3);
          await persistCustomerOfferedSlots(input, offer, retry.queriedWindow);
          return {
            kind: "offer_slots",
            slots: offer,
            messageHint: `That time was just taken. I can still do ${offer.map(formatMctbBookingSlotLabel).join(", ")}.`,
          };
        }
      }
      return fallbackResult(input.workspaceId, booked.reason);
    }
    const bookedSlot: MctbBookingSlot = {
      slotId: chosen.slotId,
      startUtc: booked.startUtc,
      endUtc: booked.endUtc,
      timezone: booked.timezone,
    };
    return {
      kind: "booked",
      booking: booked,
      messageHint: `You're booked for ${formatMctbBookingSlotLabel(bookedSlot)}.`,
    };
  }

  let availability = await findAvailableTimes({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    windowStartUtc: input.windowStartUtc,
    windowEndUtc: input.windowEndUtc,
    timezone: input.timezone,
    preferredStartUtc: input.specificTimeUtc,
    maxResults: 24,
  });

  if (!availability.ok) {
    return fallbackResult(input.workspaceId, availability.reason);
  }

  let inWindow = filterSlotsWithinWindow(
    availability.slots,
    input.windowStartUtc,
    input.windowEndUtc,
  );
  let slots = inWindow.length ? inWindow : availability.slots;

  if (!slots.length) {
    const startMs = Date.parse(input.windowStartUtc);
    const endMs = Date.parse(input.windowEndUtc);
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
      const widenedEnd = new Date(endMs + 12 * 3600_000).toISOString();
      availability = await findAvailableTimes({
        workspaceId: input.workspaceId,
        conversationId: input.conversationId,
        windowStartUtc: input.windowStartUtc,
        windowEndUtc: widenedEnd,
        timezone: input.timezone,
        preferredStartUtc: input.specificTimeUtc,
        maxResults: 24,
      });
      if (availability.ok) {
        inWindow = filterSlotsWithinWindow(availability.slots, input.windowStartUtc, widenedEnd);
        slots = inWindow.length ? inWindow : availability.slots;
      }
    }
  }

  if (!slots.length) {
    return fallbackResult(input.workspaceId, "No openings in that window");
  }

  if (input.specificTimeUtc) {
    const match = findSlotAtTime(slots, input.specificTimeUtc);
    if (match) {
      return {
        kind: "specific_time",
        requestedAvailable: true,
        requestedSlot: match,
        alternatives: [],
        messageHint: `Yes, ${formatMctbBookingSlotLabel(match)} is available.`,
      };
    }
    const alternatives = nearestSlotAlternatives(slots, input.specificTimeUtc, 3);
    return {
      kind: "specific_time",
      requestedAvailable: false,
      alternatives,
      messageHint: buildAlternativesMessage(input.specificTimeUtc, alternatives),
    };
  }

  const offer = pickSlotsToOffer(slots, 3);
  await persistCustomerOfferedSlots(input, offer, {
    startUtc: input.windowStartUtc,
    endUtc: input.windowEndUtc,
  });
  return {
    kind: "offer_slots",
    slots: offer,
    messageHint: buildOfferMessage(offer),
  };
}

function buildOfferMessage(slots: MctbBookingSlot[]): string {
  const labels = slots.map(formatMctbBookingSlotLabel);
  if (labels.length === 1) return `We have an opening at ${labels[0]}. Does that work?`;
  if (labels.length === 2) {
    return `We have openings at ${labels[0]} and ${labels[1]}. Do either work?`;
  }
  return `We have openings at ${labels[0]}, ${labels[1]}, and ${labels[2]}. Do any of those work?`;
}

function buildAlternativesMessage(requestedUtc: string, alternatives: MctbBookingSlot[]): string {
  const req = new Date(requestedUtc);
  const timeLabel = req.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const alts = alternatives.map(formatMctbBookingSlotLabel).join(", ");
  return `${timeLabel} isn't available. The closest openings are ${alts}.`;
}
