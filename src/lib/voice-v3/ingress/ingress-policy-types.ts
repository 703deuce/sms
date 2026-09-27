import type { RoutingDecision } from "@/lib/voice/routing";

/**
 * Unified ingress precedence (Voice V3 LiveKit PSTN):
 * 1. VoiceRoutingRule match from evaluateInboundRouting (wizard rules synced on Activate)
 * 2. resolveEffectiveRoutingAction (ai_after_hours → human_first in-hours / ai_answer after hours)
 * 3. Compiled telephony.ringTeamSeconds when human_first applies
 *
 * answerWhen wins over ringBehavior at wizard sync time (resolveWizardRoutingMode).
 * LiveKit session honors the resulting VoiceRoutingRule rows — not a second router in GPT-Live.
 */
export type VoiceV3IngressAiStartMode = "immediate" | "after_team_ring";

export type VoiceV3IngressExecutionPlan = {
  mode: VoiceV3IngressAiStartMode;
  /** Authoritative routing action after schedule resolution. */
  effectiveAction: string;
  routing: RoutingDecision;
  ringSeconds: number;
  queueId?: string;
  agentId?: string;
  /** When nobody_answers is selected but ingress is direct LiveKit DID, customer may need CFNA setup. */
  provisioningNote?: string;
};

export type VoiceV3LiveKitIngressSessionFields = {
  ingressDelaySeconds: number;
  ingressMode: VoiceV3IngressAiStartMode;
  humanCallId?: string | null;
  effectiveRoutingAction: string;
  routingRuleId?: string | null;
};
