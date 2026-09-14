/**
 * MCTB customer SMS replies (Telnyx) — AI Lead Recovery is the only conversational agent.
 * AI booking runs inside LR via AI_BOOK (no parallel SMS agents or legacy handoff modes).
 */

import { getPrisma } from "@/lib/db";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { recordMctbLeadRecoveryInboundSideEffects } from "@/lib/mctb/handoff/lead-recovery-inbound-side-effects";
import { loadMissedCallTextConfig } from "./config";
import { loadLeadRecoveryConfig } from "@/lib/mctb/lead-recovery/config";
import type { MissedCallTextConfigRecord } from "./types";
import { handleMctbLeadRecoveryInboundSms } from "@/lib/mctb/lead-recovery/conversation-runtime";
import {
  mctbCallerE164Variants,
  normalizeMctbCallerE164,
} from "@/lib/mctb/messaging/caller-e164";
import { isCarrierProtocolOptOutMessage } from "@/lib/mctb/lead-recovery/protocol-intent";

async function sendMctbCustomerOutboundSms(input: {
  workspaceId: string;
  config: MissedCallTextConfigRecord;
  toE164: string;
  body: string;
  idempotencyKey: string;
}) {
  const { resolveMctbOutboundSmsRoute } = await import("@/lib/mctb/messaging/outbound-sms-route");
  const route = await resolveMctbOutboundSmsRoute({
    workspaceId: input.workspaceId,
    config: input.config,
    demoMode: false,
  });
  if (!route.fromE164) {
    throw new Error("mctb_no_outbound_sms_route");
  }
  return sendQuickSms({
    workspaceId: input.workspaceId,
    to: input.toE164,
    body: input.body,
    from: route.fromE164,
    idempotencyKey: input.idempotencyKey,
    senderRoute: {
      sendWorkspaceId: route.sendWorkspaceId,
      fromE164: route.fromE164,
      phoneNumberId: route.phoneNumberId,
    },
  });
}

/** Active missed-call-text-back thread (opener already sent to this caller). */
export async function isMctbCustomerReplyThread(
  workspaceId: string,
  fromE164: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const callerVariants = mctbCallerE164Variants(fromE164);
  const recentEvent = await prisma.missedCallEvent.findFirst({
    where: {
      workspaceId,
      callerE164: { in: callerVariants },
      smsSentAt: { not: null },
    },
    orderBy: { smsSentAt: "desc" },
    select: { id: true },
  });
  return Boolean(recentEvent);
}

async function ensureMctbConversationId(input: {
  workspaceId: string;
  fromE164: string;
  toE164: string;
  missedCallEventId: string;
  contactId?: string | null;
  conversationId?: string | null;
}): Promise<{ conversationId: string; contactId: string | null }> {
  const prisma = getPrisma();
  if (input.conversationId) {
    const existing = await prisma.conversation.findFirst({
      where: { id: input.conversationId, workspaceId: input.workspaceId },
      select: { id: true, productSource: true, contactId: true },
    });
    if (existing?.productSource === "MCTB") {
      return {
        conversationId: existing.id,
        contactId: input.contactId ?? existing.contactId ?? null,
      };
    }
  }

  let contactId = input.contactId ?? null;
  if (!contactId) {
    const existing = await prisma.contact.findFirst({
      where: { workspaceId: input.workspaceId, phone: input.fromE164 },
      select: { id: true },
    });
    if (existing) {
      contactId = existing.id;
    } else {
      const created = await prisma.contact.create({
        data: { workspaceId: input.workspaceId, phone: input.fromE164 },
        select: { id: true },
      });
      contactId = created.id;
    }
  }

  const conv = await prisma.conversation.findFirst({
    where: {
      workspaceId: input.workspaceId,
      contactId,
      productSource: "MCTB",
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (conv) {
    return { conversationId: conv.id, contactId };
  }

  const created = await prisma.conversation.create({
    data: {
      workspaceId: input.workspaceId,
      contactId,
      productSource: "MCTB",
      missedCallEventId: input.missedCallEventId,
      fromE164: input.toE164,
      status: "OPEN",
    },
    select: { id: true },
  });
  return { conversationId: created.id, contactId };
}

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
  const fromE164 = normalizeMctbCallerE164(input.fromE164);
  const config = await loadMissedCallTextConfig(input.workspaceId);

  const leadRecoveryConfig = await loadLeadRecoveryConfig(input.workspaceId);
  if (!leadRecoveryConfig.enabled || leadRecoveryConfig.policyHealth === "DISABLED") {
    return { handled: false, reason: "lead_recovery_not_enabled" };
  }

  if (!config.conversationEnabled) {
    console.warn("[mctb/customer-sms] conversationEnabled=false but Lead Recovery is on — replying anyway");
  }

  if (isCarrierProtocolOptOutMessage(input.body)) {
    const prisma = getPrisma();
    await prisma.suppression.upsert({
      where: { suppressionKey: `${input.workspaceId}:p:${fromE164}` },
      create: {
        workspaceId: input.workspaceId,
        phone: fromE164,
        suppressionKey: `${input.workspaceId}:p:${fromE164}`,
        reason: "sms_stop",
        source: "mctb_sms",
      },
      update: { reason: "sms_stop", source: "mctb_sms" },
    });
    await prisma.contact.updateMany({
      where: { workspaceId: input.workspaceId, phone: { in: mctbCallerE164Variants(fromE164) } },
      data: { status: "UNSUBSCRIBED" },
    });
    return { handled: true, action: "opted_out" };
  }

  const prisma = getPrisma();
  const callerVariants = mctbCallerE164Variants(fromE164);
  const recentEvent = await prisma.missedCallEvent.findFirst({
    where: {
      workspaceId: input.workspaceId,
      callerE164: { in: callerVariants },
      smsSentAt: { not: null },
    },
    orderBy: { smsSentAt: "desc" },
  });
  if (!recentEvent) {
    return { handled: false, reason: "no_mctb_thread" };
  }

  let contact = await prisma.contact.findFirst({
    where: { workspaceId: input.workspaceId, phone: { in: callerVariants } },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  const ensured = await ensureMctbConversationId({
    workspaceId: input.workspaceId,
    fromE164,
    toE164: input.toE164,
    missedCallEventId: recentEvent.id,
    contactId: contact?.id,
    conversationId: input.conversationId,
  });
  const conversationId = ensured.conversationId;
  if (!contact && ensured.contactId) {
    contact = await prisma.contact.findFirst({
      where: { id: ensured.contactId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
  }

  const automation = await prisma.mctbConversationAutomationState.findUnique({
    where: { conversationId },
    select: { state: true },
  });
  if (automation?.state === "human_active" || automation?.state === "resolved") {
    return { handled: true, action: "human_handling" };
  }

  const customerName =
    [contact?.firstName, contact?.lastName].filter(Boolean).join(" ").trim() || undefined;

  const leadRecovery = await handleMctbLeadRecoveryInboundSms({
    workspaceId: input.workspaceId,
    conversationId,
    contactId: contact?.id,
    customerPhone: fromE164,
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

  await recordMctbLeadRecoveryInboundSideEffects({
    workspaceId: input.workspaceId,
    fromE164,
    body: input.body,
    conversationId,
    missedCallEventId: recentEvent.id,
    providerMessageId: input.providerMessageId,
    structuredIntent: leadRecovery.intent ?? null,
  });

  if (leadRecovery.action === "duplicate_inbound_ignored" || !leadRecovery.reply?.trim()) {
    return { handled: true, action: leadRecovery.action, reply: leadRecovery.reply };
  }

  const idemKey = `mctb-lead-recovery:${conversationId}:${input.providerMessageId || input.body.slice(0, 32)}`;
  try {
    await sendMctbCustomerOutboundSms({
      workspaceId: input.workspaceId,
      config,
      toE164: fromE164,
      body: leadRecovery.reply,
      idempotencyKey: idemKey,
    });
  } catch (err) {
    console.error("[mctb/customer-sms] lead recovery SMS send failed", err);
    return { handled: false, reason: "sms_send_failed" };
  }

  await prisma.conversationMessage.create({
    data: {
      conversationId,
      direction: "outbound",
      body: leadRecovery.reply,
      userName: "AI",
      providerMessageId: null,
    },
  }).catch(() => undefined);

  return {
    handled: true,
    action: leadRecovery.action,
    reply: leadRecovery.reply,
  };
}

/** @deprecated Use handleMctbCustomerSmsReply — John is not part of MCTB SMS. */
export const handleJohnCustomerSmsReply = handleMctbCustomerSmsReply;
