/** Obsolete monolith / interim per-number rules — safe to remove on greenfield SaaS. */
export const OBSOLETE_PER_DID_DISPATCH_PREFIX = "transovo-did-dispatch-";

export function isObsoletePerDidDispatchRuleName(name: string | undefined | null): boolean {
  return Boolean(name?.startsWith(OBSOLETE_PER_DID_DISPATCH_PREFIX));
}

/** Worker loads workspace + published agent from dialed E.164 via New-App API — no tenant ids here. */
export function buildCanonicalV3DispatchAgentMetadata(): string {
  return JSON.stringify({
    runtime: "voice_v3_gpt_live",
    resolve: "http_backend_on_sip",
    dispatchSource: "canonical_shared_dispatch",
  });
}

/**
 * SIP participant attribute sources — mandatory for production PSTN.
 * `dialedE164Source` is defense-in-depth; tenant resolution still requires
 * authenticated worker + DB assignment (internal API key).
 */
export const SIP_PARTICIPANT_DIALED_E164_SOURCES = new Set([
  "sip.trunkPhoneNumber",
  "sip.trunkNumber",
  "trunkPhoneNumber",
  "sip.calledNumber",
  "calledNumber",
]);

/** Includes browser-test room metadata fallback — not sufficient alone for PSTN. */
export const TRUSTED_INBOUND_DIALED_E164_SOURCES = new Set([
  ...SIP_PARTICIPANT_DIALED_E164_SOURCES,
  "room_metadata.toE164",
]);

export function isSipParticipantDialedE164Source(source: string | undefined | null): boolean {
  if (!source?.trim()) return false;
  return SIP_PARTICIPANT_DIALED_E164_SOURCES.has(source.trim());
}

export function isTrustedInboundDialedE164Source(source: string | undefined | null): boolean {
  if (!source?.trim()) return false;
  return TRUSTED_INBOUND_DIALED_E164_SOURCES.has(source.trim());
}

/** Dev-only escape hatch — never set in production PSTN environments. */
export function productionRequiresSipDialAttribution(): boolean {
  if (process.env.VOICE_V3_ALLOW_UNATTRIBUTED_DIALED_SOURCE === "1") return false;
  if (process.env.VOICE_V3_REQUIRE_SIP_DIALED_SOURCE === "0") return false;
  return true;
}
