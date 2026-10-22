import "server-only";

import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";

export async function resolveSharedPlatformOutboundSender(): Promise<{
  fromE164: string;
  phoneNumberId: string;
} | null> {
  const sender = await resolveCanonicalMctbPlatformSender();
  if (!sender?.e164 || !sender.phoneNumberId) return null;
  return {
    fromE164: sender.e164,
    phoneNumberId: sender.phoneNumberId,
  };
}
