/**
 * MCTB production ingress policy — frozen TeXML pipeline (mctb_texml_final_v1).
 *
 * Production MCTB voice MUST enter via TeXML only:
 *   POST /api/telnyx/voice/mctb-entry
 *
 * Legacy paths (Call Control event-only, SIP/LiveKit, voice bridge, 571 fast path)
 * are disabled unless MCTB_LEGACY_INGRESS_ENABLED=1 (cert scripts, local dev).
 *
 * @see docs/MCTB_FINAL_PRODUCTION_PIPELINE.md
 */

export const MCTB_CANONICAL_PRODUCTION_INGRESS = "texml" as const;
export type MctbProductionIngress = typeof MCTB_CANONICAL_PRODUCTION_INGRESS;

export const MCTB_CANONICAL_ENTRY_PATH = "/api/telnyx/voice/mctb-entry" as const;

/** Legacy ingress sources blocked in production when legacy flag is off. */
export type MctbLegacyIngressSource =
  | "call_control_event_only"
  | "voice_bridge"
  | "sip_livekit"
  | "sip_asterisk"
  | "platform_571_fast_path"
  | "twilio_ingress";

const MCTB_LEGACY_INGRESS_ENV = "MCTB_LEGACY_INGRESS_ENABLED";

/** Voice-runtime actions that belong to the legacy SIP MCTB path. */
export const MCTB_LEGACY_VOICE_RUNTIME_ACTIONS = new Set([
  "check_mctb_sip_ingress",
  "capture_mctb_sip_inbound",
  "resolve_mctb_sip_session",
  "resolve_mctb_direct_dial_prompt",
  "resolve_mctb_direct_dial_transfer",
  "record_mctb_sip_press_1_consent",
  "start_mctb_sip_voicemail",
  "complete_mctb_sip_voicemail",
  "persist_mctb_voicemail_lifecycle",
  "mctb_sip_e2e_trace",
]);

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

/** True when legacy MCTB ingress (Call Control, SIP, voice bridge) is explicitly enabled. */
export function isMctbLegacyIngressEnabled(): boolean {
  return isTruthyEnv(process.env[MCTB_LEGACY_INGRESS_ENV]);
}

export type MctbLegacyIngressBlocked = {
  blocked: true;
  reason: "legacy_ingress_disabled";
  source: MctbLegacyIngressSource | string;
  canonicalIngress: MctbProductionIngress;
  canonicalEntryPath: typeof MCTB_CANONICAL_ENTRY_PATH;
};

/** Returns a blocked result when legacy ingress is not allowed; null when allowed. */
export function checkMctbLegacyIngressBlocked(
  source: MctbLegacyIngressSource | string,
): MctbLegacyIngressBlocked | null {
  if (isMctbLegacyIngressEnabled()) return null;
  return {
    blocked: true,
    reason: "legacy_ingress_disabled",
    source,
    canonicalIngress: MCTB_CANONICAL_PRODUCTION_INGRESS,
    canonicalEntryPath: MCTB_CANONICAL_ENTRY_PATH,
  };
}

export function isMctbLegacyVoiceRuntimeAction(action: string): boolean {
  return MCTB_LEGACY_VOICE_RUNTIME_ACTIONS.has(action);
}

export function logMctbLegacyIngressBlocked(
  source: MctbLegacyIngressSource | string,
  fields?: Record<string, unknown>,
): void {
  console.info(
    JSON.stringify({
      source: "mctb-ingress-policy",
      event: "legacy_ingress_blocked",
      legacySource: source,
      canonicalIngress: MCTB_CANONICAL_PRODUCTION_INGRESS,
      canonicalEntryPath: MCTB_CANONICAL_ENTRY_PATH,
      ...fields,
    }),
  );
}
