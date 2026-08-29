/**
 * Shared inbound SMS keyword + inbox handling used by Twilio and Telnyx webhooks.
 */

import { getPrisma } from "@/lib/db";
import { handleKeywordInbound, recordContestEntryIfMatch } from "@/lib/growth/keywords";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { reconcileCampaignStatus } from "@/lib/campaigns/sequence-runner";
import {
  DEFAULT_HELP_KEYWORDS,
  DEFAULT_OPT_IN_KEYWORDS,
  DEFAULT_OPT_OUT_KEYWORDS,
  getMessagingRuntimeSettings,
  parseKeywordList,
  shouldSendAwayReply,
} from "@/lib/messaging/messaging-settings";

function formatInboundMessageBody(body: string, mediaUrls?: string[] | null): string {
  const trimmed = (body || "").trim();
  const mediaCount = mediaUrls?.filter(Boolean).length || 0;
  if (trimmed) return trimmed;
  if (mediaCount > 0) {
    const label = mediaCount === 1 ? "1 attachment" : `${mediaCount} attachments`;
    return `[${label} received — image preview not available in this inbox yet. Contact support if you need the file.]`;
  }
  return "(empty)";
}

export async function resolveInboundContext(toRaw: string, accountOrProfileId?: string) {
  const prisma = getPrisma();
  let to = toRaw;
  try {
    to = normalizeE164(toRaw);
  } catch {
    // keep raw
  }

  const phone = await prisma.phoneNumber.findFirst({
    where: {
      OR: [{ e164: to }, { e164: toRaw }],
      status: "Active",
    },
  });
  if (phone) {
    const reg = await prisma.messagingRegistration.findUnique({
      where: { workspaceId: phone.workspaceId },
    });
    return { workspaceId: phone.workspaceId, phoneE164: phone.e164, registration: reg };
  }

  const reg =
    (await prisma.messagingRegistration.findFirst({
      where: { OR: [{ phoneE164: to }, { phoneE164: toRaw }], phoneAttached: true },
    })) ||
    (accountOrProfileId
      ? await prisma.messagingRegistration.findFirst({
          where: {
            OR: [
              { subaccountSid: accountOrProfileId },
              { messagingProfileId: accountOrProfileId },
              { messagingServiceSid: accountOrProfileId },
            ],
          },
        })
      : null);

  if (reg?.phoneE164) {
    return { workspaceId: reg.workspaceId, phoneE164: reg.phoneE164, registration: reg };
  }
  return null;
}

export type InboundProcessResult = {
  kind: "stop" | "start" | "help" | "keyword" | "contest" | "message" | "empty" | "away";
  replyText?: string;
  mediaUrls?: string[];
  conversationId?: string;
};

/**
 * Build vCard MMS media URLs for a welcome/keyword reply when the workspace has
 * a contact card configured with attach-to-welcome enabled.
 */
async function welcomeMmsMedia(workspaceId: string): Promise<string[] | undefined> {
  const prisma = getPrisma();
  try {
    const profile = await prisma.contactCardProfile.findUnique({ where: { workspaceId } });
    if (!profile || !profile.attachToWelcomeMms) return undefined;
    return [`${getAppBaseUrl()}/api/public/contact-card/${workspaceId}`];
  } catch {
    return undefined;
  }
}

/** Persist inbound receipt so provider webhook retries are idempotent. */
async function recordInboundReceipt(input: {
  workspaceId: string;
  from: string;
  to?: string;
  body: string;
  providerMessageId?: string;
}) {
  if (!input.providerMessageId) return;
  const prisma = getPrisma();
  const existing = await prisma.conversationMessage.findFirst({
    where: { providerMessageId: input.providerMessageId },
  });
  if (existing) return;

  let contact = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId: input.workspaceId, phone: input.from } },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: { workspaceId: input.workspaceId, phone: input.from, lastReply: new Date() },
    });
  }

  let conversationId: string;
  if (input.to) {
    const { resolveInboundConversation } = await import("@/lib/mass-texting/conversation-context");
    const resolved = await resolveInboundConversation({
      workspaceId: input.workspaceId,
      contactId: contact.id,
      toE164: input.to,
      fromE164: input.from,
    });
    conversationId = resolved.conversationId;
  } else {
    let conversation = await prisma.conversation.findFirst({
      where: { workspaceId: input.workspaceId, contactId: contact.id, status: { not: "CLOSED" } },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          workspaceId: input.workspaceId,
          contactId: contact.id,
          status: "OPEN",
          unread: true,
        },
      });
    }
    conversationId = conversation.id;
  }

  try {
    await prisma.conversationMessage.create({
      data: {
        conversationId,
        direction: "inbound",
        body: input.body || "(empty)",
        providerMessageId: input.providerMessageId,
      },
    });
  } catch (err) {
    if (!(err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002")) {
      throw err;
    }
  }
}

export async function processInboundMessage(input: {
  workspaceId: string;
  from: string;
  to: string;
  body: string;
  providerMessageId?: string;
  /** Inbound MMS attachment URLs when the provider supplies them. */
  mediaUrls?: string[] | null;
  registration?: {
    stopMessage?: string | null;
    helpMessage?: string | null;
    legalBusinessName?: string | null;
    contactEmail?: string | null;
  } | null;
}): Promise<InboundProcessResult> {
  const prisma = getPrisma();
  let from = input.from;
  try {
    from = normalizeE164(input.from);
  } catch {
    // keep
  }
  const body = (input.body || "").trim();
  const upper = body.toUpperCase();

  // Workspace-configurable compliance keywords (fall back to standard sets).
  const runtime = await getMessagingRuntimeSettings(input.workspaceId);
  const stopKeywords = parseKeywordList(runtime.optOutKeywords, DEFAULT_OPT_OUT_KEYWORDS);
  const startKeywords = parseKeywordList(runtime.optInKeywords, DEFAULT_OPT_IN_KEYWORDS);
  const helpKeywords = parseKeywordList(runtime.helpKeywords, DEFAULT_HELP_KEYWORDS);

  // Dedupe provider retries before keyword side effects / auto-replies.
  if (input.providerMessageId) {
    const existingMsg = await prisma.conversationMessage.findFirst({
      where: { providerMessageId: input.providerMessageId },
    });
    if (existingMsg) {
      if (stopKeywords.includes(upper)) {
        return { kind: "stop" };
      }
      if (startKeywords.includes(upper)) return { kind: "start" };
      if (helpKeywords.includes(upper)) return { kind: "help" };
      return { kind: body ? "message" : "empty" };
    }
  }

  const { tryHandleEmployeeSmsCommand } = await import("@/lib/smart-routing/employee-sms-commands");
  const { tryHandleCallForwardingSms } = await import("@/lib/call-forwarding/sms-outbound");
  const cfSms = await tryHandleCallForwardingSms({
    workspaceId: input.workspaceId,
    toE164: input.to,
    fromE164: from,
    body,
  });
  if (cfSms.handled) {
    return { kind: "message" };
  }

  const employeeCmd = await tryHandleEmployeeSmsCommand({
    workspaceId: input.workspaceId,
    fromE164: from,
    body,
  });
  if (employeeCmd.handled) {
    return { kind: "message", replyText: employeeCmd.replyText };
  }

  if (stopKeywords.includes(upper)) {
    const suppressionKey = `${input.workspaceId}:p:${from}`;
    try {
      await prisma.suppression.create({
        data: {
          workspaceId: input.workspaceId,
          phone: from,
          suppressionKey,
          reason: "STOP",
          source: "inbound_sms",
        },
      });
    } catch (err) {
      if (!(err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002")) {
        throw err;
      }
    }

    await prisma.contact.updateMany({
      where: { workspaceId: input.workspaceId, phone: from },
      data: { status: "UNSUBSCRIBED" },
    });

    const recipients = await prisma.campaignRecipient.findMany({
      where: {
        workspaceId: input.workspaceId,
        phone: from,
        workflowStatus: { in: ["pending", "scheduled", "in_progress", "waiting"] },
      },
    });
    const campaignIds = new Set<string>();
    for (const recipient of recipients) {
      const opted = await prisma.campaignRecipient.updateMany({
        where: {
          id: recipient.id,
          workflowStatus: { in: ["pending", "scheduled", "in_progress", "waiting"] },
        },
        data: {
          workflowStatus: "opted_out",
          stopReason: "STOP",
          completedAt: new Date(),
          nextActionAt: null,
          enrollmentKey: null,
        },
      });
      if (opted.count === 1) {
        campaignIds.add(recipient.campaignId);
        await prisma.campaignMessage.updateMany({
          where: { recipientId: recipient.id, status: "queued" },
          data: { status: "skipped", error: "stopped: STOP" },
        });
      }
    }
    for (const campaignId of campaignIds) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { optOuts: { increment: 1 } },
      });
      await reconcileCampaignStatus(campaignId);
    }

    await recordInboundReceipt({
      workspaceId: input.workspaceId,
      from,
      to: input.to,
      body,
      providerMessageId: input.providerMessageId,
    });

    return {
      kind: "stop",
      replyText:
        input.registration?.stopMessage ||
        "You are unsubscribed and will no longer receive messages. Reply START to re-subscribe.",
    };
  }

  if (startKeywords.includes(upper)) {
    await prisma.suppression.deleteMany({
      where: { workspaceId: input.workspaceId, phone: from },
    });
    await prisma.contact.updateMany({
      where: { workspaceId: input.workspaceId, phone: from },
      data: { status: "SUBSCRIBED" },
    });
    await recordInboundReceipt({
      workspaceId: input.workspaceId,
      from,
      to: input.to,
      body,
      providerMessageId: input.providerMessageId,
    });
    return {
      kind: "start",
      replyText: "You have been re-subscribed. Reply STOP to opt out.",
    };
  }

  if (helpKeywords.includes(upper)) {
    await recordInboundReceipt({
      workspaceId: input.workspaceId,
      from,
      to: input.to,
      body,
      providerMessageId: input.providerMessageId,
    });
    return {
      kind: "help",
      replyText:
        input.registration?.helpMessage ||
        `${input.registration?.legalBusinessName || "Transovo AI"} Support: For assistance, visit https://transovo.ai or email ${input.registration?.contactEmail || "support@transovo.ai"}. Reply STOP to opt out.`,
    };
  }

  // Single-letter appointment confirm (C) / cancel (X) for contacts with an
  // upcoming appointment. Falls through to normal handling when none exists.
  if (upper === "C" || upper === "X") {
    const apptContact = await prisma.contact.findUnique({
      where: { workspaceId_phone: { workspaceId: input.workspaceId, phone: from } },
    });
    if (apptContact) {
      const {
        findUpcomingAppointmentForContact,
        confirmAppointment,
        cancelAppointment,
      } = await import("@/lib/voice/calendar/booking");
      const appt = await findUpcomingAppointmentForContact(input.workspaceId, apptContact.id);
      if (appt) {
        await recordInboundReceipt({
          workspaceId: input.workspaceId,
          from,
          to: input.to,
          body,
          providerMessageId: input.providerMessageId,
        });
        const whenLabel = appt.startsAt.toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: appt.timezone || undefined,
        });
        if (upper === "C") {
          await confirmAppointment(input.workspaceId, appt.id);
          return {
            kind: "message",
            replyText: `Your appointment on ${whenLabel} is confirmed. Reply X to cancel.`,
          };
        }
        await cancelAppointment(input.workspaceId, appt.id);
        return {
          kind: "message",
          replyText: `Your appointment on ${whenLabel} has been cancelled.`,
        };
      }
    }
  }

  // Contest text-to-win entry (may coexist with an opt-in keyword).
  const contestHit = await recordContestEntryIfMatch({
    workspaceId: input.workspaceId,
    from,
    body,
  });

  // Custom keywords (JOIN, QUOTE, …) — after compliance keywords.
  const keywordHit = await handleKeywordInbound({
    workspaceId: input.workspaceId,
    from,
    to: input.to,
    body,
  });
  if (keywordHit.matched) {
    await recordInboundReceipt({
      workspaceId: input.workspaceId,
      from,
      to: input.to,
      body,
      providerMessageId: input.providerMessageId,
    });
    return {
      kind: "keyword",
      replyText: keywordHit.replyText,
      mediaUrls: await welcomeMmsMedia(input.workspaceId),
    };
  }

  if (contestHit.matched) {
    await recordInboundReceipt({
      workspaceId: input.workspaceId,
      from,
      to: input.to,
      body,
      providerMessageId: input.providerMessageId,
    });
    return {
      kind: "contest",
      replyText: contestHit.replyText,
      mediaUrls: await welcomeMmsMedia(input.workspaceId),
    };
  }

  let contact = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId: input.workspaceId, phone: from } },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: { workspaceId: input.workspaceId, phone: from, lastReply: new Date() },
    });
    try {
      const { dispatchAutoReplies } = await import("@/lib/auto-replies/dispatch");
      await dispatchAutoReplies({
        workspaceId: input.workspaceId,
        contactId: contact.id,
        triggerType: "contact_added",
        fromE164: input.to,
      });
      const { triggerDripCampaigns } = await import("@/lib/drip-campaigns/engine");
      await triggerDripCampaigns({
        workspaceId: input.workspaceId,
        contactId: contact.id,
        triggerType: "contact_added",
      });
    } catch {
      /* non-fatal */
    }
  } else {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { lastReply: new Date() },
    });
  }

  // Mark active automation executions so condition_has_responded / stop-on-reply work.
  try {
    const { markFactsForContact } = await import("@/lib/automations/metadata");
    await markFactsForContact(input.workspaceId, contact.id, {
      customer_replied: true,
    });
  } catch {
    /* non-fatal */
  }
  try {
    const { emitPlatformEvent } = await import("@/lib/platform/events");
    await emitPlatformEvent({
      workspaceId: input.workspaceId,
      type: "MESSAGE_RECEIVED",
      contactId: contact.id,
      messageId: input.providerMessageId || null,
      payload: { from, to: input.to, body: (body || "").slice(0, 500) },
      idempotencyKey: input.providerMessageId
        ? `message-received:${input.workspaceId}:${input.providerMessageId}`
        : `message-received:${input.workspaceId}:${contact.id}:${Date.now()}`,
    });
  } catch {
    /* non-fatal */
  }
  try {
    const phone = await prisma.phoneNumber.findFirst({
      where: {
        workspaceId: input.workspaceId,
        OR: [{ e164: input.to }, { e164: input.to.replace(/\D/g, "") }],
      },
      select: { id: true },
    });
    const { emitAutomationEvent } = await import("@/lib/automations/events");
    await emitAutomationEvent(input.workspaceId, "message.received", contact.id, {
      body: body || "",
      from,
      to: input.to,
      phoneNumberId: phone?.id,
      messageId: input.providerMessageId || undefined,
    });
    const { resumeEventWaitsOnInboundMessage } = await import(
      "@/lib/automations/parity/event-waits"
    );
    await resumeEventWaitsOnInboundMessage({
      workspaceId: input.workspaceId,
      contactId: contact.id,
      body: body || "",
      messageId: input.providerMessageId || null,
    });
  } catch {
    /* non-fatal */
  }

  const { resolveInboundConversation } = await import("@/lib/mass-texting/conversation-context");
  const inboundCtx = await resolveInboundConversation({
    workspaceId: input.workspaceId,
    contactId: contact.id,
    toE164: input.to,
    fromE164: from,
  });
  const conversation = await prisma.conversation.update({
    where: { id: inboundCtx.conversationId },
    data: { unread: true, updatedAt: new Date() },
  });

  try {
    const displayBody = formatInboundMessageBody(body, input.mediaUrls);
    await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        direction: "inbound",
        body: displayBody,
        providerMessageId: input.providerMessageId || null,
      },
    });

    const preview = displayBody.slice(0, 120);
    const contactName =
      [contact.firstName, contact.lastName].filter(Boolean).join(" ") || from;

    // CRM framework — push inbound SMS/MMS to connected CRMs (async).
    try {
      const { publishSmsEvent } = await import("@/lib/crm/events");
      await publishSmsEvent({
        workspaceId: input.workspaceId,
        contactId: contact.id,
        direction: "inbound",
        from,
        to: input.to,
        body: body || null,
        status: "received",
        messageId: input.providerMessageId || null,
        mediaUrls: input.mediaUrls?.filter(Boolean) || null,
      });
    } catch {
      // CRM push is optional
    }

    // Web push for new inbound conversation message
    try {
      const { sendPushToWorkspaceAgents } = await import("@/lib/push/send");
      await sendPushToWorkspaceAgents(input.workspaceId, {
        title: "New inbox message",
        body: preview || "New reply from " + from,
        url: `/conversations?conversation=${conversation.id}`,
        tag: `inbox-${conversation.id}`,
      });
    } catch {
      // push is optional
    }

    // In-app notification bell for a new inbound reply
    try {
      const { notifyWorkspace } = await import("@/lib/notifications/in-app");
      await notifyWorkspace(input.workspaceId, {
        type: "newReply",
        title: `New reply from ${contactName}`,
        body: preview || undefined,
        href: `/conversations?conversation=${conversation.id}`,
      });
    } catch {
      // in-app notifications are best-effort
    }
  } catch (err) {
    if (!(err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002")) {
      throw err;
    }
  }

  const active = await prisma.campaignRecipient.findMany({
    where: {
      workspaceId: input.workspaceId,
      phone: from,
      workflowStatus: { in: ["pending", "scheduled", "in_progress", "waiting"] },
    },
  });
  const repliedCampaignIds = new Set<string>();
  for (const r of active) {
    await prisma.$transaction(async (tx: any) => {
      const row = await tx.campaignRecipient.findUnique({ where: { id: r.id } });
      if (!row) return;
      const prev =
        row.metadata && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : {};
      if (prev.customer_replied) return;
      await tx.campaignRecipient.update({
        where: { id: r.id },
        data: { metadata: { ...prev, customer_replied: true } },
      });
      repliedCampaignIds.add(r.campaignId);
    });
  }
  for (const campaignId of repliedCampaignIds) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { replies: { increment: 1 } },
    });
  }

  // AI conversational replies (scheduled with optional delay).
  try {
    const phone = await prisma.phoneNumber.findFirst({
      where: {
        workspaceId: input.workspaceId,
        OR: [{ e164: input.to }, { e164: input.to.replace(/\D/g, "") }],
      },
      select: { id: true },
    });
    await (
      await import("@/lib/ai-replies/engine")
    ).scheduleInboundAiReply({
      workspaceId: input.workspaceId,
      contactId: contact.id,
      conversationId: conversation.id,
      phoneNumberId: phone?.id,
      fromE164: input.to,
      body: body || "",
      inboundMessageId: input.providerMessageId || undefined,
    });
  } catch {
    /* non-fatal */
  }

  // Away / business-hours auto-reply (once per contact per day).
  // User-configured after-hours auto replies take precedence over the global away message.
  try {
    const afterHours = await (
      await import("@/lib/auto-replies/dispatch")
    ).dispatchAfterHoursAutoReply({
      workspaceId: input.workspaceId,
      contactId: contact.id,
      fromE164: input.to,
    });
    if (afterHours.sent && afterHours.replyText) {
      return {
        kind: "away",
        replyText: afterHours.replyText,
      };
    }
  } catch {
    /* non-fatal */
  }

  if (shouldSendAwayReply(runtime)) {
    const custom =
      contact.customFields && typeof contact.customFields === "object"
        ? (contact.customFields as Record<string, unknown>)
        : {};
    const today = new Date().toISOString().slice(0, 10);
    if (custom.awayReplyAt !== today) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          customFields: { ...custom, awayReplyAt: today },
        },
      });
      return {
        kind: "away",
        replyText: runtime.awayMessage!.trim(),
      };
    }
  }

  return { kind: body ? "message" : "empty", conversationId: conversation.id };
}
