import "server-only";

import { getPrisma } from "@/lib/db";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { resolveVoiceOutboundSmsFrom } from "@/lib/voice/sms/voice-outbound-sms-from";

export async function sendVoiceV2AiCallRecoverySms(input: {
  workspaceId: string;
  callId: string;
  agentId?: string | null;
  callerE164: string;
  sendingPhoneNumberId?: string | null;
  sendingE164?: string;
  body: string;
  idempotencyKey: string;
}): Promise<{ ok: true; conversationId: string } | { ok: false; reason: string }> {
  const prisma = getPrisma();
  let fromE164 = input.sendingE164?.trim();

  if (input.sendingPhoneNumberId) {
    const num = await prisma.phoneNumber.findFirst({
      where: {
        id: input.sendingPhoneNumberId,
        workspaceId: input.workspaceId,
        status: "Active",
      },
      select: { e164: true, id: true },
    });
    if (num?.e164) fromE164 = num.e164;
  }

  if (!fromE164) {
    const route = await resolveVoiceOutboundSmsFrom({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
    });
    fromE164 = route.fromE164;
  }

  if (!fromE164) {
    return { ok: false, reason: "no_sending_route" };
  }

  let contact = await prisma.contact.findFirst({
    where: { workspaceId: input.workspaceId, phone: input.callerE164 },
    select: { id: true },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: { workspaceId: input.workspaceId, phone: input.callerE164 },
      select: { id: true },
    });
  }

  let conversation = await prisma.conversation.findFirst({
    where: {
      workspaceId: input.workspaceId,
      contactId: contact.id,
      channel: "sms",
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        workspaceId: input.workspaceId,
        contactId: contact.id,
        channel: "sms",
        productSource: "MANUAL",
        status: "open",
        lastMessagePreview: input.body.slice(0, 160),
        lastMessageAt: new Date(),
      },
      select: { id: true },
    });
  }

  await sendQuickSms({
    workspaceId: input.workspaceId,
    to: input.callerE164,
    from: fromE164,
    body: input.body,
    idempotencyKey: input.idempotencyKey,
  });

  return { ok: true, conversationId: conversation.id };
}
