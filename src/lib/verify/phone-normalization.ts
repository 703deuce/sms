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
  const t = String(raw || "").toLowerCase();
  if (!t) return "Unknown";
  if (t.includes("mobile") || t.includes("wireless")) return "Mobile";
  if (t.includes("landline") || t.includes("fixed")) return "Landline";
  if (t.includes("voip") || t.includes("non-fixed")) return "VoIP";
  if (t.includes("toll")) return "Toll-Free";
  return "Unknown";
}

export function smsSuitabilityFromLineType(lineType: string): string | null {
  if (lineType === "Mobile") return "Generally suitable for SMS";
  if (lineType === "Landline") return "Not suitable for SMS";
  if (lineType === "VoIP") return "May support SMS depending on carrier";
  if (lineType === "Toll-Free") return "SMS support varies";
  return null;
}
