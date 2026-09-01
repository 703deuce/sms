import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export function normalizeVerifyPhone(
  input: string,
  defaultCountry: "US" = "US",
): { ok: true; e164: string } | { ok: false; error: string } {
  const trimmed = String(input || "").trim();
  if (!trimmed) return { ok: false, error: "Enter a phone number." };

  try {
    if (trimmed.startsWith("+")) {
      const e164 = normalizeE164(trimmed);
      return { ok: true, e164 };
    }
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length === 10 && defaultCountry === "US") {
      return { ok: true, e164: normalizeE164(`+1${digits}`) };
    }
    if (digits.length === 11 && digits.startsWith("1")) {
      return { ok: true, e164: normalizeE164(`+${digits}`) };
    }
    return { ok: false, error: "Enter a valid phone number with country code, or a 10-digit US number." };
  } catch {
    return { ok: false, error: "Could not parse this phone number." };
  }
}

export function displayLineType(raw: string | null | undefined): string {
  const t = normalizeLineType(raw);
  if (t === "mobile") return "Mobile";
  if (t === "landline") return "Landline";
  if (t === "fixed_voip") return "Fixed VoIP";
  if (t === "non_fixed_voip") return "Non-Fixed VoIP";
  if (t === "voip") return "VoIP";
  if (t === "toll_free") return "Toll-Free";
  return "Unknown";
}

/** Normalize Telnyx/raw carrier type into stable internal line type. */
export function normalizeLineType(raw: string | null | undefined): import("./phone-verification-result").PhoneLineType {
  const t = String(raw || "").toLowerCase();
  if (!t) return "unknown";
  if (t.includes("non-fixed") || t.includes("nonfixed") || t.includes("non_fixed")) {
    return "non_fixed_voip";
  }
  if (t.includes("fixed") && t.includes("voip")) return "fixed_voip";
  if (t.includes("mobile") || t.includes("wireless")) return "mobile";
  if (t.includes("landline")) return "landline";
  if (t.includes("voip")) return "voip";
  if (t.includes("toll")) return "toll_free";
  if (t.includes("fixed")) return "landline";
  return "unknown";
}

export function smsSuitabilityFromLineType(lineType: string): string | null {
  if (lineType === "Mobile") return "Generally suitable for SMS (does not imply consent)";
  if (lineType === "Landline") return "Not suitable for SMS";
  if (lineType === "Fixed VoIP" || lineType === "Non-Fixed VoIP" || lineType === "VoIP") {
    return "SMS support varies by carrier";
  }
  if (lineType === "Toll-Free") return "SMS support varies";
  return null;
}
