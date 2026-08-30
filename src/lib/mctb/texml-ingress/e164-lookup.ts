import "server-only";

import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

/** Build E.164 variants for tolerant DID lookup (Telnyx form posts vary). */
export function mctbTexmlE164Variants(raw: string): string[] {
  const out = new Set<string>();
  const trimmed = raw.trim();
  if (!trimmed) return [];

  out.add(trimmed);
  try {
    out.add(normalizeE164(trimmed));
  } catch {
    // keep raw
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits) {
    out.add(digits);
    out.add(`+${digits}`);
    if (digits.length === 10) out.add(`+1${digits}`);
    if (digits.length === 11 && digits.startsWith("1")) out.add(`+${digits}`);
  }

  return [...out];
}
