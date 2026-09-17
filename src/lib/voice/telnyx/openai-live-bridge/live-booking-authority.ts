import { liveBaselineEventId } from "./live-event-ids";
import type { LiveControlPlane } from "./live-control-plane";
import type { VoiceV2CallContext } from "@/lib/voice-v2/intake/types";

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

export function buildLiveFrontendBookingAuthorityInstructionFromContext(input: {
  ctx: VoiceV2CallContext | null;
  workflowEnvelope: Record<string, unknown>;
}): string {
  const confirmed =
    input.workflowEnvelope.voice_v2_next_stage === "BOOKING_CONFIRMED" ||
    input.ctx?.bookingWorkflow?.bookingConfirmed === true;
  const offer = input.ctx?.currentOfferSet;
  const lines = [
    "AUTHORITATIVE BOOKING STATE (Voice V2 CallContext + workflow — overrides conversational assumption)",
    `voice_v2_next_stage=${input.workflowEnvelope.voice_v2_next_stage}`,
    `booking_status=${confirmed ? "BOOKING_CONFIRMED" : "NOT_BOOKED"}`,
    "FIND availability ≠ booked. Caller selecting a slot ≠ booked.",
    `allowed_next_actions=${JSON.stringify(input.workflowEnvelope.allowed_next_actions ?? [])}`,
  ];
  if (offer?.offerSetId) {
    lines.push(`current_offer_set_id=${offer.offerSetId}`);
    if (input.ctx?.bookingWorkflow?.requestedDate) {
      lines.push(`requested_date=${input.ctx.bookingWorkflow.requestedDate}`);
    }
    lines.push(
      "If the caller accepts an offered slot, call voice_v2_book_offered_slot with this offer_set_id and the matching slot_id. Do not call FIND again for the same offer set.",
    );
  }
  if (confirmed) {
    lines.push(
      "You may confirm the appointment to the caller using the latest BOOKING_CONFIRMED tool result only.",
    );
    lines.push("Do not start a new scheduling delegation unless the caller explicitly requests a change or another appointment.");
  } else {
    lines.push(
      'FORBIDDEN until booking_status=BOOKING_CONFIRMED: "you\'re all set", "you\'re booked", "I\'ve scheduled", "your appointment is confirmed", "we have you down", or equivalent.',
    );
    lines.push(
      'Allowed while booking: brief wait language only (e.g. "One moment while I get that set up").',
    );
  }
  const hint = String(input.workflowEnvelope.runtime_hint || "").trim();
  if (hint) lines.push(`runtime_hint=${hint}`);
  return lines.join("\n");
}

export function buildLiveFrontendBookingAuthorityAppendFromControlPlane(
  controlPlane: LiveControlPlane,
): Record<string, unknown> {
  return {
    type: "session.instructions.append",
    event_id: liveBaselineEventId("booking_auth"),
    content: buildLiveFrontendBookingAuthorityInstructionFromContext({
      ctx: controlPlane.getCallContext(),
      workflowEnvelope: controlPlane.getWorkflowEnvelope(),
    }),
  };
}
