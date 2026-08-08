import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

/**
 * LiveKit inbound trunk DID for Telnyx FQDN (+E.164).
 * Telnyx inbound is configured for +E.164; LiveKit trunk numbers must include the leading +.
 */
export function toLiveKitInboundDid(e164: string): string {
  return normalizeE164(e164);
}

export function liveKitDidLookupVariants(e164: string): string[] {
  const normalized = normalizeE164(e164);
  const bare = normalized.replace(/^\+/, "");
  return [...new Set([normalized, bare])];
}

export function trunkNumbersIncludeDid(numbers: string[], e164: string): boolean {
  const variants = liveKitDidLookupVariants(e164);
  return variants.some((variant) => numbers.includes(variant));
}
