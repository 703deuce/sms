import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

/**
 * LiveKit inbound trunk DID for Telnyx FQDN.
 * Telnyx CDR `dest_number` arrives without '+' (e.g. 18663464256) even when
 * `cld` is +E.164 — register the bare form to avoid SIP 404 UNALLOCATED_NUMBER.
 */
export function toLiveKitInboundDid(e164: string): string {
  return normalizeE164(e164).replace(/^\+/, "");
}

export function liveKitDidLookupVariants(e164: string): string[] {
  const normalized = normalizeE164(e164);
  const bare = toLiveKitInboundDid(normalized);
  return [...new Set([bare, normalized])];
}

export function trunkNumbersIncludeDid(numbers: string[], e164: string): boolean {
  const variants = liveKitDidLookupVariants(e164);
  return variants.some((variant) => numbers.includes(variant));
}
