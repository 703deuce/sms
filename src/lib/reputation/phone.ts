const SMS_OPT_OUT = "Reply STOP to opt out.";

export function normalizePhoneE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

export function phoneDigitsForMatch(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

export function appendSmsOptOut(body: string): string {
  const trimmed = body.trim();
  if (/reply\s+stop/i.test(trimmed)) return trimmed;
  return `${trimmed} ${SMS_OPT_OUT}`;
}

export function isSmsOptOutMessage(body: string): boolean {
  const normalized = body.trim().toUpperCase();
  return ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(normalized);
}

export function isSmsOptInMessage(body: string): boolean {
  return body.trim().toUpperCase() === "START";
}
