import "server-only";

import { getPrisma } from "@/lib/server/db";
import {
  HP_CERTIFIED_SMS_E164,
  normalizePhoneE164,
  pickPreferredSmsSendingNumber,
} from "@/lib/messaging/preferred-sending-number";
import { resolveSharedPlatformOutboundSender } from "@/lib/messaging/platform-outbound-sender";

export { HP_CERTIFIED_SMS_E164 };

export function resolveVoiceOutboundSmsFromE164(): string {
  const env = process.env.VOICE_OUTBOUND_SMS_FROM_E164?.trim();
  return normalizePhoneE164(env) || HP_CERTIFIED_SMS_E164;
}

export async function resolveVoiceOutboundSmsFrom(input: {
  workspaceId: string;
  calledE164?: string | null;
  agentId?: string | null;
  config?: unknown;
}): Promise<string | null> {
  const platform = await resolveSharedPlatformOutboundSender();
  if (platform?.fromE164) return normalizePhoneE164(platform.fromE164);

  const preferred = await pickPreferredSmsSendingNumber(input.workspaceId);
  if (preferred) return preferred;

  const env = resolveVoiceOutboundSmsFromE164();
  const exists = await getPrisma().phoneNumber.findFirst({
    where: { workspaceId: input.workspaceId, e164: env.replace(/\D/g, "").slice(-10) },
    select: { id: true },
  });
  if (exists) return env;
  return env;
}
