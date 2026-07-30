/**
 * Shared inbound SMS keyword + inbox handling used by Twilio and Telnyx webhooks.
 */

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { reconcileCampaignStatus } from "@/lib/campaigns/sequence-runner";

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
  kind: "stop" | "start" | "help" | "message" | "empty";
  replyText?: string;
};

export async function processInboundMessage(input: {
  workspaceId: string;
  from: string;
  to: string;
  body: string;
  providerMessageId?: string;
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

  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(upper)) {
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

    return {
      kind: "stop",
      replyText:
        input.registration?.stopMessage ||
        "You are unsubscribed and will no longer receive messages. Reply START to re-subscribe.",
    };
  }

  if (["START", "YES", "UNSTOP"].includes(upper)) {
    await prisma.suppression.deleteMany({
      where: { workspaceId: input.workspaceId, phone: from },
    });
    await prisma.contact.updateMany({
      where: { workspaceId: input.workspaceId, phone: from },
      data: { status: "SUBSCRIBED" },
    });
    return {
      kind: "start",
      replyText: "You have been re-subscribed. Reply STOP to opt out.",
    };
  }

  if (["HELP", "INFO"].includes(upper)) {
    return {
      kind: "help",
      replyText:
        input.registration?.helpMessage ||
        `${input.registration?.legalBusinessName || "Support"}: For help contact ${input.registration?.contactEmail || "support@transovo.ai"}. Reply STOP to opt out. Msg&data rates may apply.`,
    };
  }

  let contact = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId: input.workspaceId, phone: from } },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: { workspaceId: input.workspaceId, phone: from, lastReply: new Date() },
    });
  } else {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { lastReply: new Date() },
    });
  }

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
  } else {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { unread: true, updatedAt: new Date() },
    });
  }

  if (input.providerMessageId) {
    const existingMsg = await prisma.conversationMessage.findFirst({
      where: { providerMessageId: input.providerMessageId },
    });
    if (existingMsg) {
      return { kind: body ? "message" : "empty" };
    }
  }

  await prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "inbound",
      body: body || "(empty)",
      providerMessageId: input.providerMessageId || null,
    },
  });

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

  return { kind: body ? "message" : "empty" };
}
