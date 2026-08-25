import { isMctbSipIngressTargetSync } from "@/lib/mctb/sip-ingress/sync";

/** Transovo LiveKit Inbound FQDN — only Telnyx connection type with delayed-offer SIP controls. */
export const MCTB_571_SIP_FQDN_CONNECTION_ID = "3022029259041408870";

export const MCTB_571_SIP_FQDN_CONNECTION_NAME = "Transovo LiveKit Inbound";

export const MCTB_SIP_DIAGNOSTIC_SAY = "Transovo SIP diagnostic connected.";

export const MCTB_SIP_DIAGNOSTIC_LOG_SOURCE = "mctb-sip-ingress";

export const MCTB_SIP_E2E_LOG_SOURCE = "mctb-sip-e2e";

export const MCTB_SIP_E2E_AGENT_NAME =
  process.env.LIVEKIT_AGENT_NAME?.trim() || "transovo-voice-runtime";

export function isMctb571SipDiagnosticTarget(toE164: string | null | undefined): boolean {
  return isMctbSipIngressTargetSync(toE164);
}
