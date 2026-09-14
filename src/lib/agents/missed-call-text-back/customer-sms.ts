/**
 * MCTB customer SMS replies — Lead Recovery is the single conversational agent.
 * Scheduling runs inside LR via the AI_BOOK action (not a second SMS agent).
 */

import { getPrisma } from "@/lib/db";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { processMctbInboundReply } from "@/lib/mctb/handoff/process-inbound-reply";
import { loadMissedCallTextConfig } from "./config";
import { resolveMctbSmsSender } from "./sms-sender";
import { loadLeadRecoveryConfig } from "@/lib/mctb/lead-recovery/config";
import { handleMctbLeadRecoveryInboundSms } from "@/lib/mctb/lead-recovery/conversation-runtime";

const STOP_RE = /^(stop|unsubscribe|cancel|end|quit)\b/i;

export type MctbCustomerSmsReplyResult =
  | { handled: false; reason: string }
  | {
      handled: true;
      action: string;
      reply?: string;
      modelInvoked?: boolean;
      modelRequestId?: string;
    };

export async function handleMctbCustomerSmsReply(input: {
  workspaceId: string;
  fromE164: string;
  toE164: string;
  body: string;
  conversationId?: string | null;
  providerMessageId?: string | null;
}): Promise<MctbCustomerSmsReplyResult> {
  const config = await loadMissedCallTextConfig(input.workspaceId);
  if (!config.conversationEnabled) {
    return { handled: false, reason: "conversation_disabled" };
  }

  if (STOP_RE.test(input.body.trim())) {
    const prisma = getPrisma();
    await prisma.suppression.upsert({
      where: { suppressionKey: `${input.workspaceId}:p:${input.fromE164}` },
      create: {
        workspaceId: input.workspaceId,
        phone: input.fromE164,
        suppressionKey: `${input.workspaceId}:p:${input.fromE164}`,
        reason: "sms_stop",
        source: "mctb_sms",
      },
      update: { reason: "sms_stop", source: "mctb_sms" },
    });
    await prisma.contact.updateMany({
      where: { workspaceId: input.workspaceId, phone: input.fromE164 },
      data: { status: "UNSUBSCRIBED" },
    });
    return { handled: true, action: "opted_out" };
  }

  const prisma = getPrisma();
  const recentEvent = await prisma.missedCallEvent.findFirst({
    where: {
      workspaceId: input.workspaceId,
      callerE164: input.fromE164,
      smsSentAt: { not: null },
    },
    orderBy: { smsSentAt: "desc" },
  });
  if (!recentEvent) {
    return { handled: false, reason: "no_mctb_thread" };
  }

  const contact = await prisma.contact.findFirst({
    where: { workspaceId: input.workspaceId, phone: input.fromE164 },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  let conversationId = input.conversationId;
  if (!conversationId && contact?.id) {
    const conv = await prisma.conversation.findFirst({
      where: { workspaceId: input.workspaceId, contactId: contact.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    conversationId = conv?.id ?? null;
    if (!conversationId) {
      const created = await prisma.conversation.create({
        data: {
          workspaceId: input.workspaceId,
          contactId: contact.id,
          productSource: "MCTB",
          missedCallEventId: recentEvent.id,
          fromE164: input.toE164,
          status: "OPEN",
        },
        select: { id: true },
      });
      conversationId = created.id;
    }
  }

  const handoff = await processMctbInboundReply({
    workspaceId: input.workspaceId,
    fromE164: input.fromE164,
    body: input.body,
    conversationId,
  });

  if (handoff.handled && handoff.skipAi) {
    const sender = await resolveMctbSmsSender({
      workspaceId: input.workspaceId,
      config,
    });
    if (handoff.automationReply && sender?.e164) {
      await sendQuickSms({
        workspaceId: input.workspaceId,
        to: input.fromE164,
        body: handoff.automationReply,
        from: sender.e164,
        idempotencyKey: `mctb-handoff-reply:${handoff.handoffEventId || recentEvent.id}:${input.body.slice(0, 32)}`,
      }).catch(() => undefined);
    }
    await prisma.missedCallEvent.update({
      where: { id: recentEvent.id },
      data: { status: "CUSTOMER_REPLIED" },
    });
    return {
      handled: true,
      action: handoff.eventType || "handoff",
      reply: handoff.automationReply,
    };
  }

  const customerName =
    [contact?.firstName, contact?.lastName].filter(Boolean).join(" ").trim() || undefined;

  const leadRecoveryConfig = await loadLeadRecoveryConfig(input.workspaceId);

  if (!leadRecoveryConfig.enabled || leadRecoveryConfig.policyHealth === "DISABLED") {
    return { handled: false, reason: "lead_recovery_not_enabled" };
  }

  const leadRecovery = await handleMctbLeadRecoveryInboundSms({
    workspaceId: input.workspaceId,
    conversationId,
    contactId: contact?.id,
    customerPhone: input.fromE164,
    customerName,
    customerEmail: contact?.email,
    body: input.body,
    timezone: config.timezone,
    missedCallEventId: recentEvent.id,
    providerMessageId: input.providerMessageId,
  });

  if (!leadRecovery.handled) {
    return { handled: false, reason: leadRecovery.reason || "lead_recovery_not_handled" };
  }

  if (leadRecovery.action === "duplicate_inbound_ignored" || !leadRecovery.reply?.trim()) {
    return { handled: true, action: leadRecovery.action, reply: leadRecovery.reply };
  }

  const sender = await resolveMctbSmsSender({
    workspaceId: input.workspaceId,
    config,
  });
  if (sender?.e164) {
    await sendQuickSms({
      workspaceId: input.workspaceId,
      to: input.fromE164,
      body: leadRecovery.reply,
      from: sender.e164,
      idempotencyKey: `mctb-lead-recovery:${conversationId || recentEvent.id}:${input.body.slice(0, 24)}`,
    }).catch(() => undefined);
    if (conversationId) {
      await prisma.conversationMessage.create({
        data: {
          conversationId,
          direction: "out",
          body: leadRecovery.reply,
          userName: "AI",
        },
      });
    }
  }

  await prisma.missedCallEvent.update({
    where: { id: recentEvent.id },
    data: { status: "CUSTOMER_REPLIED" },
  });

  return {
    handled: true,
    action: leadRecovery.action,
    reply: leadRecovery.reply,
  };
}

/** @deprecated Use handleMctbCustomerSmsReply — John is not part of MCTB SMS. */
export const handleJohnCustomerSmsReply = handleMctbCustomerSmsReply;
