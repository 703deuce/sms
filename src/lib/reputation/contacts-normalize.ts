import { normalizePhoneE164 } from "@/lib/reputation/phone";

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes("@") || trimmed.startsWith("@") || trimmed.endsWith("@")) return null;
  if (/\s/.test(trimmed)) return null;
  return trimmed;
}

export function normalizeContactPhone(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  return normalizePhoneE164(phone.trim());
}

export type ContactIdentity = {
  phoneE164: string | null;
  emailNormalized: string | null;
};

/**
 * Deterministic identity for dedupe within a business/location.
 * Prefer phone match, then email. Both may be set for upsert patches.
 */
export function contactIdentity(input: {
  phone?: string | null;
  email?: string | null;
}): ContactIdentity {
  return {
    phoneE164: normalizeContactPhone(input.phone),
    emailNormalized: normalizeEmail(input.email),
  };
}

export type AttributionLevel = "confirmed" | "likely" | "unattributed";

/**
 * Honest labels only. Confirmed requires a unique tracked click plus an approved
 * identifier signal — never invent confirmed from timing alone.
 */
export function labelReviewAttribution(input: {
  hasUniqueTrackedClick: boolean;
  hasApprovedIdentifier: boolean;
  hoursSinceClick: number | null;
  likelyWindowHours?: number;
}): AttributionLevel {
  if (input.hasUniqueTrackedClick && input.hasApprovedIdentifier) return "confirmed";
  const window = input.likelyWindowHours ?? 72;
  if (
    input.hasUniqueTrackedClick &&
    input.hoursSinceClick != null &&
    input.hoursSinceClick >= 0 &&
    input.hoursSinceClick <= window
  ) {
    return "likely";
  }
  return "unattributed";
}

export function attributionDisplayLabel(level: AttributionLevel): string {
  switch (level) {
    case "confirmed":
      return "Confirmed attribution";
    case "likely":
      return "Likely review completion";
    default:
      return "New reviews during campaign";
  }
}
