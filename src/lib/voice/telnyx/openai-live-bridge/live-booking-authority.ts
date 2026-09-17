import { liveBaselineEventId } from "./live-event-ids";
import type { LiveBookingSessionState } from "./live-booking-session-state";
import { buildAuthoritativeBackendStatePayload } from "./live-booking-session-state";

/** Spoken or written booking confirmation before BOOKING_CONFIRMED is a regression. */
const BOOKING_CONFIRMATION_PATTERN =
  /\b(you(?:'re| are) (?:all set|booked|confirmed|scheduled)|i(?:'ve| have) (?:scheduled|booked)|your appointment is confirmed|we have you down|appointment (?:is )?confirmed|you(?:'re| are) set for)\b/i;

export function detectBookingConfirmationViolation(
  amyTranscriptChunk: string,
  bookingConfirmed: boolean,
): boolean {
  if (bookingConfirmed) return false;
  return BOOKING_CONFIRMATION_PATTERN.test(amyTranscriptChunk);
}

export function buildLiveFrontendBookingAuthorityInstruction(
  state: LiveBookingSessionState,
): string {
  const payload = buildAuthoritativeBackendStatePayload(state);
  const status = payload.booking_status;
  const offer = state.currentOfferSet;
  const lines = [
    "AUTHORITATIVE BOOKING STATE (runtime — overrides conversational assumption)",
    `booking_status=${status}`,
    "FIND availability ≠ booked. Caller selecting a slot ≠ booked.",
  ];
  if (offer) {
    lines.push(`current_offer_set_id=${offer.offer_set_id}`);
    for (const slot of offer.slots) {
      lines.push(`offered_slot slot_id=${slot.slot_id} time=${slot.spoken_label}`);
    }
    lines.push(
      "If the caller accepts an offered slot, delegate and call voice_v2_book_offered_slot with this offer_set_id and the matching slot_id. Do not call FIND again for the same offer set.",
    );
  }
  if (state.bookingConfirmed) {
    lines.push("You may confirm the appointment to the caller using the latest BOOKING_CONFIRMED tool result only.");
  } else {
    lines.push(
      'FORBIDDEN until booking_status=BOOKING_CONFIRMED: "you\'re all set", "you\'re booked", "I\'ve scheduled", "your appointment is confirmed", "we have you down", or equivalent.',
    );
    lines.push(
      'Allowed while booking: brief wait language only (e.g. "One moment while I get that set up").',
    );
  }
  return lines.join("\n");
}

export function buildLiveFrontendBookingAuthorityAppend(
  state: LiveBookingSessionState,
): Record<string, unknown> {
  return {
    type: "session.instructions.append",
    event_id: liveBaselineEventId("booking_auth"),
    content: buildLiveFrontendBookingAuthorityInstruction(state),
  };
}
