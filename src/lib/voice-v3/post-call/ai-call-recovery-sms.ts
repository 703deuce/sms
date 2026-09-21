import "server-only";

import { getPrisma } from "@/lib/db";
import { sendVoiceV3BookingLinkSms } from "../booking-link/send-voice-v3-booking-link-sms";
import { resolveVoiceV3OutboundSms } from "../sms/resolve-voice-v3-outbound-sms";
import type { VoiceV3AgentConfig } from "../config/agent-config";

export async function maybeSendVoiceV3AiCallRecoverySms(input: {
  callId: string;
  workspaceId: string;
  config: VoiceV3AgentConfig;
}): Promise<void> {
  const recovery = input.config.recovery;
  if (!recovery?.aiCallRecoveryEnabled) return;
  if (!recovery.continueOverSms) return;

  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: input.callId },
    select: { fromE164: true, metadata: true },
  });
  if (!call?.fromE164?.trim()) return;

  const meta = (call.metadata || {}) as Record<string, unknown>;
  const v3 = (meta.voiceV3PostCall || {}) as Record<string, unknown>;
  if (v3.aiRecoverySmsSentAt) return;

  const delayMs = Math.max(0, (recovery.delaySeconds ?? 0) * 1000);
  if (delayMs > 0) {
    await new Promise((r) => setTimeout(r, Math.min(delayMs, 120_000)));
  }

  const route = await resolveVoiceV3OutboundSms({
    workspaceId: input.workspaceId,
    agentId: input.config.agentId ?? null,
    config: input.config,
  });
  if (!route?.fromE164 || !route.phoneNumberId) return;

  const brand = input.config.businessName?.trim() || "Thanks for calling";
  const body = `${brand}: We can continue helping you over text. Reply here with any questions. Reply STOP to opt out.`;

  await sendVoiceV3BookingLinkSms({
    workspaceId: input.workspaceId,
    agentId: input.config.agentId ?? null,
    callId: input.callId,
    toE164: call.fromE164,
    fromE164: route.fromE164,
    phoneNumberId: route.phoneNumberId,
    body,
    idempotencyKey: `v3aicallrecovery:${input.callId}`,
  });

  v3.aiRecoverySmsSentAt = new Date().toISOString();
  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: { metadata: { ...meta, voiceV3PostCall: v3 } as object },
  });
}
