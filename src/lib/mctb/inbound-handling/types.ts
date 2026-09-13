/** Authoritative inbound handling mode for a business line / MCTB ingress DID. */
export const INBOUND_HANDLING_MODES = ["MCTB_RECOVERY", "VOICE_AGENT"] as const;

export type InboundHandlingMode = (typeof INBOUND_HANDLING_MODES)[number];

export const INBOUND_HANDLING_MODE_LABELS: Record<InboundHandlingMode, string> = {
  MCTB_RECOVERY: "Missed Call Text Back",
  VOICE_AGENT: "After-Hours Voice Agent",
};

export type InboundRoutingDecisionReason =
  | "mode_mctb_recovery"
  | "mode_voice_agent_ready"
  | "voice_agent_unavailable_fallback_mctb"
  | "voice_agent_disabled"
  | "voice_agent_not_ready"
  | "line_not_configured";

export type InboundRoutingDecision = {
  mode: InboundHandlingMode;
  primaryHandler: "mctb_recovery" | "voice_agent";
  phoneNumberId: string | null;
  ingressE164: string | null;
  voiceAgentId: string | null;
  reason: InboundRoutingDecisionReason;
  policyVersion: string;
};

export type VoiceAgentReadiness = {
  ready: boolean;
  canAnswer: boolean;
  reasons: string[];
  agentId: string | null;
  telnyxAssistantId: string | null;
  published: boolean;
  phoneLinked: boolean;
};

export type MctbLineInboundConfig = {
  phoneNumberId: string;
  ingressE164: string;
  businessLineE164: string | null;
  inboundHandlingMode: InboundHandlingMode;
  voiceAgentId: string | null;
  voiceAgentEnabled: boolean;
  mctbTexmlAppId: string | null;
  voiceTexmlAppId: string | null;
  forwardingVerified: boolean;
  configRevision: string;
};
