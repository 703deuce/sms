import "server-only";

import { mergeMessageVars } from "@/lib/automations/actions";
import { getPrisma, type DbRow } from "@/lib/db";
import {
  getMessagingRuntimeSettings,
  isInQuietHours,
  isWithinBusinessHours,
} from "@/lib/messaging/messaging-settings";
import { sendQuickSms } from "@/lib/sms/send-quick";
import type { AutoReplyRecord, AutoReplyTriggerType } from "./types";
import { getAutoReply, listAutoReplies } from "./service";

export type AutoReplyDispatchContext = {
  workspaceId: string;
  contactId: string;
  triggerType: AutoReplyTriggerType;
  listId?: string;
  tagId?: string;
  formId?: string;
  fromE164?: string;
};

export type AutoReplyDispatchResult = {
  sent: boolean;
  replyText?: string;
  autoReplyId?: string;
  skippedReason?: string;
};

function matchesTrigger(
  row: AutoReplyRecord,
  ctx: AutoReplyDispatchContext,
): boolean {
  if (row.triggerType !== ctx.triggerType) return false;
  if (row.status !== "active") return false;
  switch (ctx.triggerType) {
    case "list_join":
      return Boolean(ctx.listId && row.triggerConfig.listId === ctx.listId);
    case "tag_added":
      return Boolean(ctx.tagId && row.triggerConfig.tagId === ctx.tagId);
    case "form_submitted":
      return Boolean(ctx.formId && row.triggerConfig.formId === ctx.formId);
    case "contact_added":
    case "after_hours":
      return true;
    default:
      return false;
  }
}

async function alreadySentOnce(
  workspaceId: string,
  autoReplyId: string,
  contactId: string,
): Promise<boolean> {
  const prior = await getPrisma().message.findFirst({
    where: {
      workspaceId,
      idempotencyKey: `auto-reply:${autoReplyId}:${contactId}`,
    },
    select: { id: true },
  });
  return Boolean(prior);
}

async function sendAutoReply(
  row: AutoReplyRecord,
  ctx: AutoReplyDispatchContext,
): Promise<AutoReplyDispatchResult> {
  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({
    where: { id: ctx.contactId, workspaceId: ctx.workspaceId },
  });
  if (!contact) return { sent: false, skippedReason: "contact_not_found" };

  if (row.rules.excludeUnsubscribed && contact.status !== "SUBSCRIBED") {
    return { sent: false, skippedReason: "contact_opted_out" };
  }

  const runtime = await getMessagingRuntimeSettings(ctx.workspaceId);
  if (row.rules.respectQuietHours && isInQuietHours(runtime)) {
    return { sent: false, skippedReason: "quiet_hours" };
  }

  if (row.rules.oncePerContact) {
    const sent = await alreadySentOnce(ctx.workspaceId, row.id, contact.id);
    if (sent) return { sent: false, skippedReason: "already_sent" };
  }

  const body = await mergeMessageVars(ctx.workspaceId, contact, row.message);
  const idempotencyKey = `auto-reply:${row.id}:${contact.id}`;

  try {
    await sendQuickSms({
      workspaceId: ctx.workspaceId,
      to: contact.phone,
      body,
      from: ctx.fromE164,
      mediaUrls: row.mediaUrls?.length ? row.mediaUrls : undefined,
      idempotencyKey,
    });
  } catch (err) {
    console.warn("[auto-replies] send failed", row.id, err);
    return { sent: false, skippedReason: "send_failed" };
  }

  await prisma.autoReply.update({
    where: { id: row.id },
    data: {
      sendCount: { increment: 1 },
      lastTriggeredAt: new Date(),
    },
  });

  return { sent: true, replyText: body, autoReplyId: row.id };
}

export async function dispatchAutoReplies(
  ctx: AutoReplyDispatchContext,
): Promise<AutoReplyDispatchResult> {
  const rows = await listAutoReplies(ctx.workspaceId);
  const matches = rows.filter((row) => matchesTrigger(row, ctx));
  if (!matches.length) return { sent: false, skippedReason: "no_match" };

  for (const row of matches) {
    const result = await sendAutoReply(row, ctx);
    if (result.sent) return result;
  }

  return { sent: false, skippedReason: "all_skipped" };
}

export async function dispatchAfterHoursAutoReply(input: {
  workspaceId: string;
  contactId: string;
  fromE164?: string;
}): Promise<AutoReplyDispatchResult> {
  const runtime = await getMessagingRuntimeSettings(input.workspaceId);
  if (isWithinBusinessHours(runtime)) {
    return { sent: false, skippedReason: "within_business_hours" };
  }

  return dispatchAutoReplies({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    triggerType: "after_hours",
    fromE164: input.fromE164,
  });
}

export async function loadAutoReplyRecentSends(
  workspaceId: string,
  autoReplyId: string,
  limit = 20,
) {
  const prefix = `auto-reply:${autoReplyId}:`;
  const messages = await getPrisma().message.findMany({
    where: {
      workspaceId,
      idempotencyKey: { startsWith: prefix },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const contacts = await getPrisma().contact.findMany({
    where: {
      workspaceId,
      phone: { in: messages.map((m: DbRow) => m.to) },
    },
    select: { id: true, phone: true, firstName: true, lastName: true },
  });
  const byPhone = new Map<string, DbRow>(contacts.map((c: DbRow) => [c.phone, c]));

  return messages.map((m: DbRow) => {
    const contact = byPhone.get(m.to);
    return {
      id: m.id,
      to: m.to,
      contactId: contact?.id || null,
      contactName:
        [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") || m.to,
      status: m.status,
      sentAt: m.createdAt.toISOString(),
    };
  });
}

export async function getAutoReplyWithActivity(workspaceId: string, id: string) {
  const row = await getAutoReply(workspaceId, id);
  if (!row) return null;
  const recentSends = await loadAutoReplyRecentSends(workspaceId, id);
  const { summarizeDeliveryStatuses } = await import("@/lib/automate/delivery-stats");
  const delivery = summarizeDeliveryStatuses(recentSends.map((s: DbRow) => s.status));
  return { ...row, recentSends, delivery };
}
