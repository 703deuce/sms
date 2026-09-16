import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { normalizeVoiceIntakeEmail } from "../intake/normalize-email";
import type { IntakeFieldValueType, VoiceV2IntakeSchema } from "../intake/types";

/** Safe normalization of LLM-extracted values when transcript evidence is clear. */
export function normalizePostCallExtractedValue(
  schema: VoiceV2IntakeSchema,
  fieldKey: string,
  raw: string,
): string | null {
  const field = schema.fields.find((f) => f.key === fieldKey);
  if (!field || !raw.trim()) return null;
  return normalizeByValueType(field.valueType, fieldKey, raw.trim());
}

function normalizeByValueType(
  valueType: IntakeFieldValueType,
  key: string,
  str: string,
): string | null {
  switch (valueType) {
    case "text":
      return str;
    case "address":
      return str;
    case "email": {
      const email =
        normalizeVoiceIntakeEmail(str) ?? (str.includes("@") ? str.trim().toLowerCase() : null);
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
      return email;
    }
    case "phone":
      try {
        return normalizeE164(str);
      } catch {
        return null;
      }
    default:
      return str;
  }
}

/** Parse spoken counts ("Three") to digits when unambiguous. */
export function normalizeSpokenCount(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  const words: Record<string, string> = {
    zero: "0",
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
    ten: "10",
  };
  if (words[t]) return words[t];
  if (/^\d+$/.test(t)) return t;
  return null;
}
