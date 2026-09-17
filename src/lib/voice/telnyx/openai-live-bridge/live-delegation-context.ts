import { liveBaselineEventId } from "./live-event-ids";
import type { LiveConversationTranscript } from "./live-conversation-transcript";
import type { LiveControlPlane } from "./live-control-plane";
import type { VoiceV2CallContext } from "@/lib/voice-v2/intake/types";

export type LiveDelegationHydratedContext = {
  callerStateJson?: string;
  businessContextJson?: string;
  bookingConfigJson?: string;
};

export function buildDelegationDeveloperText(input: {
  transcript: LiveConversationTranscript;
  controlPlane: LiveControlPlane;
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

  const workflowEnvelope = input.controlPlane.getWorkflowEnvelope();
  const ctx = input.controlPlane.getCallContext();

  const parts = [
    "CURRENT CALL CONTEXT (for Responses backend only — not for caller-facing speech)",
    "",
    "Full conversation relevant to this delegation:",
    conversationTranscript || "(no transcript captured yet)",
    "",
    "Authoritative Voice V2 workflow control plane (stage + legal next actions):",
    JSON.stringify(workflowEnvelope, null, 2),
    "",
    "VoiceV2CallContext snapshot (intake, offer set, workflow flags):",
    JSON.stringify(summarizeCallContextForDelegation(ctx), null, 2),
  ];

  if (input.hydrated?.callerStateJson) {
    parts.push("", "Caller / intake state (hydrated):", input.hydrated.callerStateJson);
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
    "Use workflow envelope + CallContext for offer_set_id, slot_id, stage, and allowed_next_actions.",
    "Only invoke tools listed in allowed_next_actions for the current voice_v2_next_stage.",
    "Do not call FIND again when the caller selects a slot from currentOfferSet.",
  );

  return parts.join("\n");
}

function summarizeCallContextForDelegation(ctx: VoiceV2CallContext | null): Record<string, unknown> {
  if (!ctx) return { loaded: false };
  return {
    loaded: true,
    dialog: ctx.dialog ?? null,
    booking_workflow: ctx.bookingWorkflow ?? null,
    current_offer_set: ctx.currentOfferSet ?? null,
    capabilities: ctx.capabilities ?? null,
    intake_save_count: ctx.intakeSaveCount ?? 0,
  };
}

/**
 * Inject hybrid context into the delegated Responses backend via Live API.
 * @see response.item.create — developer message with input_text
 */
export function buildLiveDelegationContextItem(input: {
  developerText: string;
  /** Log correlation only — Live API rejects top-level delegation_id on developer queue items. */
  delegationId?: string | null;
}): Record<string, unknown> {
  return {
    type: "response.item.create",
    event_id: liveBaselineEventId("delegation_ctx"),
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
