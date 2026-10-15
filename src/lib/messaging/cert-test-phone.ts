import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

const DEFAULT_CERT_PHONES = "+15714776175,+17038166017";

/** E.164 numbers used for live product certification (comma-separated env override). */
export function listSmsCertTestPhonesE164(): string[] {
  const raw = process.env.TRANSOVO_SMS_CERT_PHONES?.trim() || DEFAULT_CERT_PHONES;
  const out: string[] = [];
  for (const part of raw.split(/[,;\s]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const e164 = normalizeE164(trimmed);
    if (e164) out.push(e164);
  }
  return [...new Set(out)];
}

/** When true, cert phones may receive review/mass SMS even if on workspace STOP list. */
export function smsCertBypassSuppressionEnabled(): boolean {
  const v = process.env.TRANSOVO_SMS_CERT_BYPASS_SUPPRESSION?.trim();
  if (v === "0" || v === "false") return false;
  if (v === "1" || v === "true") return true;
  // Default on — internal certification handsets only (see listSmsCertTestPhonesE164).
  return true;
}

export function isSmsCertTestPhoneE164(phone: string | null | undefined): boolean {
  if (!phone?.trim()) return false;
  const normalized = normalizeE164(phone);
  if (!normalized) return false;
  return listSmsCertTestPhonesE164().includes(normalized);
}

export function shouldBypassSmsSuppressionForCertPhone(phone: string | null | undefined): boolean {
  return smsCertBypassSuppressionEnabled() && isSmsCertTestPhoneE164(phone);
}
