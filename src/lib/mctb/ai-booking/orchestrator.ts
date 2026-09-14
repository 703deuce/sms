import { findAvailableTimes, getBookingContext } from "@/lib/mctb/ai-booking/service";
import {
  buildCustomerOfferSms,
  buildOfferSelectionClarification,
  filterSlotsWithinWindow,
  findSlotAtTime,
  formatMctbBookingSlotLabel,
  nearestSlotAlternatives,
  pickSlotsToOffer,
} from "@/lib/mctb/ai-booking/slot-presentation";
import { bookValidatedOfferedSlot } from "@/lib/mctb/ai-booking/book-offered-slot";
import {
  assertBookingTimezoneCoherent,
  stampSlotsWithCanonicalTimezone,
} from "@/lib/mctb/ai-booking/booking-timezone";
import { recordSlotsOfferedAudit } from "@/lib/mctb/ai-booking/booking-audit";
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
  const bookingTimezone = input.timezone.trim();
  const stamped = stampSlotsWithCanonicalTimezone(slots, bookingTimezone);
  await recordOfferedSlots({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    provider: bookingCfg.provider,
    bookingTimezone,
    slots: stamped,
    window,
  });
  await recordSlotsOfferedAudit({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    bookingTimezone,
    slots: stamped,
    writeEpoch: input.writeEpoch,
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
  const bookingTimezone = input.timezone.trim();

  const tzCheck = assertBookingTimezoneCoherent({
    bookingTimezone,
    session,
    orchestratorTimezone: input.timezone,
    offeredSlots: session?.offeredSlots,
  });
  if (!tzCheck.ok) {
    return {
      kind: "timezone_conflict",
      code: "BOOKING_TIMEZONE_CONFLICT",
      messageHint:
        "I hit a scheduling configuration issue on our side. Please reply with another time or call us and we'll book you manually.",
    };
  }

  const offered = session?.offeredSlots ?? [];
  const selectionSlotId = input.selectedSlotId?.trim() || null;

  if (offered.length > 0 && selectionSlotId) {
    const chosen = offered.find((s) => s.slotId === selectionSlotId) ?? null;
    if (!chosen) {
      return {
        kind: "need_clarification",
        messageHint: buildOfferSelectionClarification(offered),
      };
    }
    if (!input.confirmBooking) {
      return {
        kind: "need_clarification",
        messageHint: `Just to confirm — ${formatMctbBookingSlotLabel(chosen)} works for you?`,
      };
    }
    const booked = await bookValidatedOfferedSlot({
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      contactId: input.contactId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      slotId: chosen.slotId,
      semanticSelectedSlotId: selectionSlotId,
      bookingTimezone,
      writeEpoch: input.writeEpoch,
    });
    if (booked.status === "booked") {
      const bookedSlot: MctbBookingSlot = {
        slotId: chosen.slotId,
        startUtc: booked.result.startUtc,
        endUtc: booked.result.endUtc,
        timezone: booked.result.timezone,
      };
      return {
        kind: "booked",
        booking: booked.result,
        messageHint: booked.messageHint || `You're booked for ${formatMctbBookingSlotLabel(bookedSlot)}.`,
      };
    }
    return booked.orchestratorResult;
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
  return buildCustomerOfferSms(slots);
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
