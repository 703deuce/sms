import {
  findAvailableTimes,
  createBooking,
  getBookingContext,
} from "@/lib/mctb/ai-booking/service";
import {
  findSlotAtTime,
  nearestSlotAlternatives,
  pickSlotsToOffer,
  resolveOfferedSlotChoice,
} from "@/lib/mctb/ai-booking/slot-presentation";
import { getMctbAiBookingSessionStore } from "@/lib/mctb/ai-booking/session-store";
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
  /** Customer reply when choosing among offered slots */
  choiceUtterance?: string | null;
  /** When true, attempt createBooking for resolved slot */
  confirmBooking?: boolean;
};

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

  if (input.confirmBooking || input.choiceUtterance) {
    const offered = session?.offeredSlots ?? [];
    const chosen =
      (input.choiceUtterance
        ? resolveOfferedSlotChoice(offered, input.choiceUtterance)
        : null) ??
      (input.specificTimeUtc ? findSlotAtTime(offered, input.specificTimeUtc) : null);
    if (!chosen) {
      return {
        kind: "need_clarification",
        messageHint: "Which of the times I offered works best for you?",
      };
    }
    if (!input.confirmBooking && !input.choiceUtterance?.match(/\d|first|second|third|am|pm/i)) {
      return {
        kind: "need_clarification",
        messageHint: `Did you want ${formatSlotLabel(chosen)}? Reply yes to confirm.`,
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
          return {
            kind: "offer_slots",
            slots: offer,
            messageHint: `That time was just taken. I can still do ${offer.map(formatSlotLabel).join(", ")}.`,
          };
        }
      }
      return fallbackResult(input.workspaceId, booked.reason);
    }
    return {
      kind: "booked",
      booking: booked,
      messageHint: `You're booked for ${formatSlotLabel(chosen)}.`,
    };
  }

  const availability = await findAvailableTimes({
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

  const slots = availability.slots;
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
        messageHint: `Yes, ${formatSlotLabel(match)} is available.`,
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
  return {
    kind: "offer_slots",
    slots: offer,
    messageHint: buildOfferMessage(offer),
  };
}

function formatSlotLabel(slot: MctbBookingSlot): string {
  const d = new Date(slot.startUtc);
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: slot.timezone,
  });
}

function buildOfferMessage(slots: MctbBookingSlot[]): string {
  const labels = slots.map(formatSlotLabel);
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
  const alts = alternatives.map(formatSlotLabel).join(", ");
  return `${timeLabel} isn't available. The closest openings are ${alts}.`;
}
