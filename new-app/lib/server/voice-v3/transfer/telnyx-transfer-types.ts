import "server-only";

export type VoiceV3TelnyxTransferStatus =
  | "REQUESTED"
  | "AUTHORIZED"
  | "DIALING"
  | "RINGING"
  | "ANSWERED"
  | "BRIDGING"
  | "BRIDGED"
  | "BUSY"
  | "NO_ANSWER"
  | "REJECTED"
  | "FAILED"
  | "CANCELED";

export type VoiceV3TelnyxTransferOperation = {
  id: string;
  transferRequestId: string;
  routeId: string;
  status: VoiceV3TelnyxTransferStatus;
  mode: "DIRECT" | "WARM";
  voiceCallId: string | null;
  liveSessionId: string | null;
  inboundCallControlId: string;
  aiLegControlId: string | null;
  outboundCallControlId: string | null;
  destinationE164: string | null;
  destinationId: string | null;
  forwardingGroupId: string | null;
  handoffInstructions: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  bridgedAt: string | null;
};

export const V3_TRANSFER_CLIENT_KIND = "v3_cf_transfer";
