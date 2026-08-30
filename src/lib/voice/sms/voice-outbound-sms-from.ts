/**
 * Outbound SMS sender for voice agents (Amy 866 inbound → 571 outbound).
 *
 * Inbound calls may arrive on toll-free 866; approved A2P SMS must send from
 * the HP-certified local 571 DID. Runtime owns this — never expose to the model.
 */

import { getPrisma } from "@/lib/db";
import {
  HP_CERTIFIED_SMS_E164,
  normalizePhoneE164,
} from "@/lib/messaging/preferred-sending-number";

/** Production voice SMS sender — 5714073615 (A2P-certified). */
export const VOICE_OUTBOUND_SMS_E164 = HP_CERTIFIED_SMS_E164;

export { HP_CERTIFIED_SMS_E164 };

export function resolveVoiceOutboundSmsFromE164(): string {
  const env = process.env.VOICE_OUTBOUND_SMS_FROM_E164?.trim();
  return normalizePhoneE164(env) || VOICE_OUTBOUND_SMS_E164;
}

/**
 * Resolve the trusted outbound SMS sender for a voice session.
 * Prefers the certified 571 number; falls back to workspace preferred sender.
 */
export async function resolveVoiceOutboundSmsFrom(input: {
  workspaceId: string;
  calledE164?: string | null;
}): Promise<string> {
  const configured = resolveVoiceOutboundSmsFromE164();
  const prisma = getPrisma();
  const owned = await prisma.phoneNumber.findFirst({
    where: {
      workspaceId: input.workspaceId,
      e164: configured,
      status: "Active",
    },
    select: { e164: true },
  });
  if (owned?.e164) return owned.e164;

  const { pickPreferredSmsSendingNumber } = await import(
    "@/lib/messaging/preferred-sending-number"
  );
  const numbers = await prisma.phoneNumber.findMany({
    where: { workspaceId: input.workspaceId, status: "Active" },
    select: { id: true, e164: true, status: true, type: true, a2pStatus: true, provider: true, settingsJson: true },
  });
  const preferred = pickPreferredSmsSendingNumber(numbers);
  return preferred?.e164 || configured;
}
