import "server-only";

import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";
import type { QuickSendSmsInput } from "@/lib/sms/send-quick";
import type { MassMessagingSenderMode } from "@/lib/messaging/sender-mode";

export type PlatformOutboundSenderRoute = NonNullable<QuickSendSmsInput["senderRoute"]>;

export type { MassMessagingSenderMode } from "@/lib/messaging/sender-mode";
export { parseMassMessagingSenderMode } from "@/lib/messaging/sender-mode";

/**
 * Canonical Transovo platform SMS sender (same number as MCTB / AR platform pool).
 */
export async function resolveSharedPlatformOutboundSender(): Promise<PlatformOutboundSenderRoute | null> {
  const sender = await resolveCanonicalMctbPlatformSender();
  if (!sender?.e164) return null;
  return {
    sendWorkspaceId: sender.workspaceId,
    fromE164: sender.e164,
    phoneNumberId: sender.phoneNumberId,
  };
}
