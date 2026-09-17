import { liveBaselineEventId } from "./live-event-ids";
import type { LiveBookingSessionState } from "./live-booking-session-state";
import { buildAuthoritativeBackendStatePayload } from "./live-booking-session-state";
import type { LiveConversationTranscript } from "./live-conversation-transcript";

export type LiveDelegationHydratedContext = {
  callerStateJson?: string;
  businessContextJson?: string;
  bookingConfigJson?: string;
};

export function buildDelegationDeveloperText(input: {
  transcript: LiveConversationTranscript;
  bookingSession: LiveBookingSessionState;
  hydrated?: LiveDelegationHydratedContext;
  isFirstDelegation: boolean;
}): string {
  const since = input.transcript.formatSinceLastDelegation();
  const conversationTranscript =
    since.length > 0
      ? since
      : input.isFirstDelegation
        ? input.transcript.formatFull()
        : "(no new transcript since last delegation)";

  const schedulingState = buildAuthoritativeBackendStatePayload(input.bookingSession);

  const parts = [
    "CURRENT CALL CONTEXT (for Responses backend only — not for caller-facing speech)",
    "",
    "Full conversation relevant to this delegation:",
    conversationTranscript || "(no transcript captured yet)",
    "",
    "Authoritative structured scheduling state (calendar truth — overrides conversational memory for slots/dates):",
    JSON.stringify(schedulingState, null, 2),
  ];

  if (input.hydrated?.callerStateJson) {
    parts.push("", "Caller / intake state (Transovo CallContext):", input.hydrated.callerStateJson);
  }
  if (input.hydrated?.businessContextJson) {
    parts.push("", "Business context:", input.hydrated.businessContextJson);
  }
  if (input.hydrated?.bookingConfigJson) {
    parts.push("", "Booking configuration:", input.hydrated.bookingConfigJson);
  }

  parts.push(
    "",
    "Use the transcript for conversational memory (names, asides, corrections).",
    "Use structured scheduling state for offer_set_id, slot_id, and requested_date.",
    "Do not call FIND again when the caller selects a slot from current_offer_set.",
  );

  return parts.join("\n");
}

/**
 * Inject hybrid context into the delegated Responses backend via Live API.
 * @see response.item.create — developer message with input_text
 */
export function buildLiveDelegationContextItem(input: {
  delegationId: string | null;
  developerText: string;
}): Record<string, unknown> {
  return {
    type: "response.item.create",
    event_id: liveBaselineEventId("delegation_ctx"),
    delegation_id: input.delegationId,
    item: {
      type: "message",
      role: "developer",
      content: [
        {
          type: "input_text",
          text: input.developerText,
        },
      ],
    },
  };
}
