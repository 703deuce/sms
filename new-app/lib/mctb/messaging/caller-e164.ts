import { normalizeE164 } from "@/lib/server/phone/normalize";

/** Normalize caller E.164 for MCTB missed-call + SMS reply correlation. */
export function normalizeMctbCallerE164(raw: string): string {
  try {
    return normalizeE164(raw);
  } catch {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return raw.trim();
  }
}

/** All E.164 shapes we may have stored on missed_call_events / contacts from carriers. */
export function mctbCallerE164Variants(raw: string): string[] {
  const out = new Set<string>();
  const normalized = normalizeMctbCallerE164(raw);
  out.add(normalized);
  out.add(raw.trim());
  const digits = normalized.replace(/\D/g, "");
  if (digits.length === 10) out.add(`+1${digits}`);
  if (digits.length === 11 && digits.startsWith("1")) {
    out.add(`+${digits}`);
    out.add(digits);
  }
  return [...out].filter(Boolean);
}
