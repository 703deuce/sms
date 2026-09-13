import "server-only";

import type { InboundHandlingMode, InboundRoutingDecision } from "./types";
import { loadMctbLineInboundConfig } from "./line-config";
import { getVoiceAgentReadiness } from "./voice-readiness";

export const INBOUND_ROUTING_POLICY_VERSION = "same-number-v1";

/**
 * Canonical ingress router — exactly one primary handler per forwarded call.
 * Telnyx connection should match `primaryHandler`; this function is authoritative for policy.
 */
export async function resolveInboundHandlingDecision(input: {
  workspaceId: string;
  phoneNumberId?: string | null;
  ingressE164?: string | null;
}): Promise<InboundRoutingDecision> {
  const line = await loadMctbLineInboundConfig({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
  });

  if (!line) {
    return {
      mode: "MCTB_RECOVERY",
      primaryHandler: "mctb_recovery",
      phoneNumberId: null,
      ingressE164: input.ingressE164 || null,
      voiceAgentId: null,
      reason: "line_not_configured",
      policyVersion: INBOUND_ROUTING_POLICY_VERSION,
    };
  }

  const mode: InboundHandlingMode = line.inboundHandlingMode;
  const voiceAgentId = line.voiceAgentId;

  if (mode !== "VOICE_AGENT" || !line.voiceAgentEnabled || !voiceAgentId) {
    return {
      mode: "MCTB_RECOVERY",
      primaryHandler: "mctb_recovery",
      phoneNumberId: line.phoneNumberId,
      ingressE164: line.ingressE164,
      voiceAgentId,
      reason: mode === "VOICE_AGENT" ? "voice_agent_disabled" : "mode_mctb_recovery",
      policyVersion: INBOUND_ROUTING_POLICY_VERSION,
    };
  }

  const readiness = await getVoiceAgentReadiness({
    workspaceId: input.workspaceId,
    agentId: voiceAgentId,
    phoneNumberId: line.phoneNumberId,
  });

  if (!readiness.canAnswer) {
    return {
      mode: "MCTB_RECOVERY",
      primaryHandler: "mctb_recovery",
      phoneNumberId: line.phoneNumberId,
      ingressE164: line.ingressE164,
      voiceAgentId,
      reason: readiness.ready ? "voice_agent_not_ready" : "voice_agent_unavailable_fallback_mctb",
      policyVersion: INBOUND_ROUTING_POLICY_VERSION,
    };
  }

  return {
    mode: "VOICE_AGENT",
    primaryHandler: "voice_agent",
    phoneNumberId: line.phoneNumberId,
    ingressE164: line.ingressE164,
    voiceAgentId,
    reason: "mode_voice_agent_ready",
    policyVersion: INBOUND_ROUTING_POLICY_VERSION,
  };
}

/** @deprecated Use resolveInboundHandlingDecision */
export async function routeInboundMctbCall(input: {
  workspaceId: string;
  phoneNumberId?: string | null;
  ingressE164?: string | null;
}) {
  return resolveInboundHandlingDecision(input);
}
