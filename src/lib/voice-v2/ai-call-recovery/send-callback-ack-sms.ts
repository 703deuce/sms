import "server-only";

import { getPrisma } from "@/lib/db";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { resolveAfterHoursHandlingFromAgentConfig } from "../after-hours-handling-config";
import { resolveVoiceSmsTemplate } from "@/lib/voice/sms/voice-sms-templates";
import { resolveVoiceResourceConfig } from "@/lib/voice/sms/voice-resource-config";
import { sendVoiceV2AiCallRecoverySms } from "./send-recovery-sms";

export async function sendVoiceV2CallbackAckSms(input: {
  workspaceId: string;
  callId: string;
  agentId?: string | null;
  callerE164: string;
  sendingPhoneNumberId?: string | null;
  sendingE164?: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { metadata: true },
  });
  const meta = (call?.metadata || {}) as Record<string, unknown>;
  if (meta.voiceV2CallbackAckSent === true) {
    return { ok: false, reason: "already_sent" };
  }

  let businessName: string | null = null;
  if (input.agentId) {
    const runtime = await loadVoiceAgentRuntimeConfig(input.workspaceId, input.agentId);
    const config = parseVoiceAgentConfig(runtime);
    const handling = resolveAfterHoursHandlingFromAgentConfig(config);
    if (!handling?.callbackRequestsEnabled) {
      return { ok: false, reason: "callback_disabled" };
    }
    if (!handling.callbackConfirmNumber) {
      return { ok: false, reason: "callback_ack_disabled" };
    }
    businessName = resolveVoiceResourceConfig(config).businessName;
  }
  const template = resolveVoiceSmsTemplate({
    templateId: "callback_confirmation",
    callId: input.callId,
    businessName,
    bookingUrl: null,
    websiteUrl: null,
  });

  const idempotencyKey = `voice-v2-callback-ack:${input.callId}`;
  const send = await sendVoiceV2AiCallRecoverySms({
    workspaceId: input.workspaceId,
    callId: input.callId,
    agentId: input.agentId,
    callerE164: input.callerE164,
    sendingPhoneNumberId: input.sendingPhoneNumberId,
    sendingE164: input.sendingE164,
    body: template.body,
    idempotencyKey,
  });

  if (!send.ok) return { ok: false, reason: send.reason };

  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: {
      metadata: {
        ...meta,
        voiceV2CallbackAckSent: true,
        voiceV2CallbackAckSentAt: new Date().toISOString(),
        voiceV2CallbackAckConversationId: send.conversationId,
      },
    },
  });

  return { ok: true };
}
