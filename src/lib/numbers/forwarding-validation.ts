import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export function validateForwardingDestination(input: {
  destination: string;
  numberE164?: string;
}): { ok: true; e164: string } | { ok: false; error: string } {
  const raw = input.destination.trim();
  if (!raw) {
    return { ok: false, error: "Forwarding destination is required" };
  }

  let e164: string;
  try {
    e164 = normalizeE164(raw);
  } catch {
    return { ok: false, error: "Enter a valid phone number in E.164 format" };
  }

  if (!/^\+[1-9]\d{6,14}$/.test(e164)) {
    return { ok: false, error: "Destination must be a valid international number" };
  }

  if (input.numberE164) {
    try {
      const self = normalizeE164(input.numberE164);
      if (self === e164) {
        return { ok: false, error: "Cannot forward a number to itself" };
      }
    } catch {
      // ignore invalid owned number in edge cases
    }
  }

  return { ok: true, e164 };
}
