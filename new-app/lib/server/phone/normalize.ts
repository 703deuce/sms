export function normalizeE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) throw new Error("Invalid phone number");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 10) return `+${digits}`;
  throw new Error("Enter a valid US phone number");
}

export function digits10(e164: string): string {
  const d = e164.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : d;
}
