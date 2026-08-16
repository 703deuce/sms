import { parsePhoneDigits } from "@/lib/premium-numbers/keypad";
import type { NumberUpstreamProvider } from "./types";

type PhoneNumberProviderFields = {
  provider?: string | null;
  twilioSid?: string | null;
  providerNumberId?: string | null;
};

export function resolvePhoneNumberProvider(
  row: PhoneNumberProviderFields,
): NumberUpstreamProvider {
  const explicit = row.provider?.trim().toLowerCase();
  if (explicit === "twilio" || explicit === "telnyx") return explicit;
  if (row.twilioSid?.trim()) return "twilio";
  return "telnyx";
}

export function nationalNumberFromE164(e164: string): string {
  const digits = parsePhoneDigits(e164);
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return digits;
}

export function dedupeCandidatesByE164<T extends { e164: string; provider: NumberUpstreamProvider }>(
  items: T[],
): T[] {
  const byE164 = new Map<string, T>();
  for (const item of items) {
    const key = item.e164;
    const existing = byE164.get(key);
    if (!existing) {
      byE164.set(key, item);
      continue;
    }
    // Prefer Telnyx when both inventories return the same DID (rare).
    if (existing.provider === "twilio" && item.provider === "telnyx") {
      byE164.set(key, item);
    }
  }
  return [...byE164.values()];
}
