import { normalizeE164 } from "@/lib/server/phone/normalize";

export function validateDestinationE164(raw: string, hostedE164?: string): string {
  const e164 = normalizeE164(raw);
  if (!e164 || e164.length < 8) {
    throw new Error("Enter a valid phone number in E.164 format");
  }
  if (hostedE164 && normalizeE164(hostedE164) === e164) {
    throw new Error("Forwarding destination cannot be the same as your Transovo business number");
  }
  return e164;
}

export function validateMenuDigit(digit: string) {
  if (!/^[0-9]$/.test(digit)) {
    throw new Error("Menu options must use a single digit 0–9");
  }
}
