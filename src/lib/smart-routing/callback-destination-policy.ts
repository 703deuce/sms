import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export function isDomesticCallbackDestination(e164: string): boolean {
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return true;
  if (digits.length === 10) return true;
  return false;
}

export function isBlockedCallbackDestination(
  destination: string,
  internalNumbers?: { routingNumberE164?: string | null; callbackNumberE164?: string | null },
): boolean {
  const dest = normalizeE164(destination);
  if (
    internalNumbers?.routingNumberE164 &&
    normalizeE164(internalNumbers.routingNumberE164) === dest
  ) {
    return true;
  }
  if (
    internalNumbers?.callbackNumberE164 &&
    normalizeE164(internalNumbers.callbackNumberE164) === dest
  ) {
    return true;
  }
  if (!isDomesticCallbackDestination(dest)) return true;
  const digits = dest.replace(/\D/g, "");
  if (/^1(900|976)/.test(digits)) return true;
  return false;
}
