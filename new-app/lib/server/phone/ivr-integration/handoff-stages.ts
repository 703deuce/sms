/** Logical ownership stages for Phone ↔ Conversational IVR integrated calls. */
export const PHONE_IVR_HANDOFF_STAGES = [
  "STAFF_RINGING",
  "AI_ACTIVE",
  "HANDOFF_REQUESTED",
  "PHONE_ROUTING_STARTED",
  "RECIPIENT_RINGING",
  "RECIPIENT_ACCEPTED",
  "CONNECTED",
  "FALLBACK_ACTIVE",
  "COMPLETED",
  "FAILED",
] as const;

export type PhoneIvrHandoffStage = (typeof PHONE_IVR_HANDOFF_STAGES)[number];

export type PhoneIvrHandoffContext = {
  stage: PhoneIvrHandoffStage;
  workspaceId: string;
  humanCallId: string;
  phoneNumberId: string | null;
  inboundCallControlId: string;
  routingSessionId: string;
  liveSessionId?: string | null;
  livekitRoomName?: string | null;
  agentId?: string | null;
  /** Prevent AI → same failed group loops */
  exhaustedGroupIds?: string[];
  transferRequestId?: string | null;
  routeId?: string | null;
};
