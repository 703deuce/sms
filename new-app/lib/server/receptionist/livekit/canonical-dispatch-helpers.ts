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

/** Worker-reported sources we accept for PSTN called-DID resolution (SIP attrs, not job metadata). */
export const TRUSTED_INBOUND_DIALED_E164_SOURCES = new Set([
  "sip.trunkPhoneNumber",
  "sip.trunkNumber",
  "trunkPhoneNumber",
  "sip.calledNumber",
  "calledNumber",
  "room_metadata.toE164",
]);

export function isTrustedInboundDialedE164Source(source: string | undefined | null): boolean {
  if (!source?.trim()) return false;
  return TRUSTED_INBOUND_DIALED_E164_SOURCES.has(source.trim());
}
