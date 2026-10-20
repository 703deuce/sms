import { normalizePhoneE164 } from "@/lib/messaging/preferred-sending-number";
export function normalizeE164(input: string): string | null {
  return normalizePhoneE164(input);
}
