import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";

/** Transovo LiveKit Inbound FQDN — only Telnyx connection type with delayed-offer SIP controls. */
export const MCTB_571_SIP_FQDN_CONNECTION_ID =
  process.env.TELNYX_LIVEKIT_FQDN_CONNECTION_ID?.trim() || "3022029259041408870";

export const MCTB_571_SIP_FQDN_CONNECTION_NAME = "Transovo LiveKit Inbound";

export const MCTB_SIP_DIAGNOSTIC_SAY =
  "Transovo SIP test. Your forwarded call reached us successfully.";

export const MCTB_SIP_DIAGNOSTIC_LOG_SOURCE = "mctb-sip-diagnostic";

export function isMctb571SipDiagnosticTarget(toE164: string | null | undefined): boolean {
  if (!toE164) return false;
  const normalized = toE164.replace(/\D/g, "");
  return (
    toE164 === MCTB_PLATFORM_DEMO_E164 ||
    normalized === "15714073615" ||
    normalized.endsWith("5714073615")
  );
}
