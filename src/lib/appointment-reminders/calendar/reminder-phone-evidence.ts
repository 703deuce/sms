import { phonesEquivalent, normalizePhoneDigits } from "@/lib/voice-v3/calendar/appointment-discovery-identity";

/** True when normalized digits for `phone` appear in any of the source strings. */
export function phoneDigitsAppearInAppointmentText(phone: string, texts: string[]): boolean {
  const target = normalizePhoneDigits(phone);
  if (target.length < 10) return false;
  const tail = target.slice(-10);
  for (const raw of texts) {
    if (!raw?.trim()) continue;
    const digits = raw.replace(/\D/g, "");
    if (digits.includes(target) || digits.includes(tail)) return true;
    for (const m of raw.match(/(?:\+?\d[\d\s().-]{8,}\d)/g) ?? []) {
      if (phonesEquivalent(m, phone)) return true;
    }
  }
  return false;
}

export type LunaPhoneExtractionPayload = {
  found: boolean;
  phone?: string | null;
  source_field?: string | null;
  evidence?: string | null;
  number_role: "customer" | "business" | "organizer" | "conference" | "unknown" | "none";
};

export type LunaReminderPhoneResult =
  | {
      ok: true;
      e164: string;
      sourceField: string | null;
      evidence: string | null;
    }
  | { ok: false; reason: string };

export function validateLunaPhoneExtraction(
  payload: LunaPhoneExtractionPayload,
  sourceTexts: string[],
): { ok: true; phone: string } | { ok: false; reason: string } {
  if (!payload.found || !payload.phone?.trim()) {
    return { ok: false, reason: "luna_no_number" };
  }
  if (payload.number_role !== "customer") {
    return { ok: false, reason: `luna_role_${payload.number_role}` };
  }
  const phone = payload.phone.trim();
  if (!phoneDigitsAppearInAppointmentText(phone, sourceTexts)) {
    return { ok: false, reason: "luna_not_in_source" };
  }
  if (payload.evidence?.trim()) {
    if (!phoneDigitsAppearInAppointmentText(phone, [payload.evidence])) {
      return { ok: false, reason: "luna_evidence_mismatch" };
    }
  }
  return { ok: true, phone };
}
