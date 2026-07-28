import { getPrisma } from "@/lib/db";
import { requireCampaignSendAccess } from "@/lib/billing/entitlements";
import { sendTransactionalEmail } from "@/lib/email/brevo";
import { sendViaRegistration } from "@/lib/messaging/registration-processor";
import { isMessagingReady } from "@/lib/messaging/status";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { markRecipientFact, tryAdvanceRecipientAfterSend } from "./sequence-runner";

async function claimMessage(id: string) {
  const result = await getPrisma().campaignMessage.updateMany({
    where: { id, status: "queued" },
    data: { status: "sending" },
  });
  return result.count === 1;
}

function inSendWindow(now: Date, startHour: number | null | undefined, endHour: number | null | undefined) {
  if (startHour == null || endHour == null) return true;
  const hour = now.getUTCHours();
  if (startHour === endHour) return true;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

export async function sendCampaignMessageById(messageId: string) {
  const prisma = getPrisma();
  const message = await prisma.campaignMessage.findUnique({
    where: { id: messageId },
    include: { recipient: true, campaign: true },
  });
  if (!message) throw new Error(`Campaign message ${messageId} not found`);

  if (message.status !== "queued" && message.status !== "sending") {
    return { skipped: true, status: message.status };
  }

  // Campaign status gates
  if (message.campaign.status === "PAUSED" || message.campaign.status === "CANCELED" || message.campaign.status === "DRAFT") {
    await prisma.campaignMessage.update({
      where: { id: messageId },
      data: { status: "queued", error: `campaign_${message.campaign.status.toLowerCase()}` },
    });
    return { deferred: true, reason: "campaign_not_active" };
  }

  if (
    message.campaign.status === "SCHEDULED" &&
    message.campaign.scheduledAt &&
    message.campaign.scheduledAt > new Date()
  ) {
    await prisma.campaignMessage.update({
      where: { id: messageId },
      data: { status: "queued", scheduledFor: message.campaign.scheduledAt, error: "waiting_for_schedule" },
    });
    return { deferred: true, reason: "scheduled" };
  }

  const now = new Date();
  if (!inSendWindow(now, message.campaign.sendWindowStart, message.campaign.sendWindowEnd)) {
    // Push to next hour boundary roughly
    const next = new Date(now.getTime() + 60 * 60 * 1000);
    await prisma.campaignMessage.update({
      where: { id: messageId },
      data: { status: "queued", scheduledFor: next, error: "outside_send_window" },
    });
    return { deferred: true, reason: "send_window" };
  }

  if (message.campaign.dailySendLimit != null) {
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const sentToday = await prisma.campaignMessage.count({
      where: {
        campaignId: message.campaignId,
        status: { in: ["sent", "delivered", "sending", "clicked"] },
        sentAt: { gte: dayStart },
        id: { not: messageId },
      },
    });
    if (sentToday >= message.campaign.dailySendLimit) {
      const tomorrow = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      await prisma.campaignMessage.update({
        where: { id: messageId },
        data: { status: "queued", scheduledFor: tomorrow, error: "daily_limit" },
      });
      return { deferred: true, reason: "daily_limit" };
    }
  }

  if (message.status === "queued") {
    const claimed = await claimMessage(messageId);
    if (!claimed) return { skipped: true, status: "race" };
  }

  const entitlement = requireCampaignSendAccess(message.workspaceId);
  if (!entitlement.ok) {
    await prisma.campaignMessage.update({
      where: { id: messageId },
      data: { status: "failed", error: entitlement.error },
    });
    throw new Error(entitlement.error);
  }

  // Contact consent / status gate for SMS
  if (message.channel === "sms" && message.to) {
    const contact = await prisma.contact.findUnique({
      where: { workspaceId_phone: { workspaceId: message.workspaceId, phone: message.to } },
    });
    if (contact && (contact.status === "UNSUBSCRIBED" || contact.status === "BLOCKED")) {
      await prisma.campaignMessage.update({
        where: { id: messageId },
        data: { status: "opted_out", error: `contact_${contact.status.toLowerCase()}` },
      });
      await prisma.campaignRecipient.update({
        where: { id: message.recipientId },
        data: { workflowStatus: "opted_out", stopReason: contact.status, completedAt: new Date() },
      });
      return { optedOut: true };
    }

    const suppressed = await prisma.suppression.findFirst({
      where: { workspaceId: message.workspaceId, phone: message.to },
    });
    if (suppressed) {
      await prisma.campaignMessage.update({
        where: { id: messageId },
        data: { status: "opted_out", error: "suppressed" },
      });
      await prisma.campaignRecipient.update({
        where: { id: message.recipientId },
        data: { workflowStatus: "opted_out", stopReason: "suppression", completedAt: new Date() },
      });
      await prisma.campaignMessage.updateMany({
        where: { recipientId: message.recipientId, status: "queued" },
        data: { status: "skipped", error: "stopped: opted_out" },
      });
      return { optedOut: true };
    }
  }

  try {
    if (message.channel === "email") {
      const result = await sendTransactionalEmail({
        to: message.to,
        subject: message.campaign.name || "Message",
        htmlContent: `<p>${message.body.replace(/\n/g, "<br/>")}</p>`,
        textContent: message.body,
      });
      if (result.status === "failed") {
        throw new Error(result.error || "Email send failed");
      }
      // In live messaging mode, refuse silent stub success for email
      if (
        result.provider === "stub" &&
        (process.env.TWILIO_MODE === "live" || process.env.MESSAGING_ADAPTER === "twilio") &&
        process.env.ALLOW_EMAIL_STUB !== "1"
      ) {
        throw new Error("BREVO_API_KEY is required to send campaign email in live mode");
      }
      await prisma.campaignMessage.update({
        where: { id: messageId },
        data: {
          status: "sent",
          sentAt: new Date(),
          providerId: result.id,
        },
      });
    } else {
      const reg = await getRegistrationByWorkspace(message.workspaceId);
      if (!isMessagingReady(reg)) {
        throw new Error("Messaging not ready for workspace");
      }
      const result = await sendViaRegistration(message.workspaceId, message.to, message.body);
      await prisma.campaignMessage.update({
        where: { id: messageId },
        data: {
          status: "sent",
          sentAt: new Date(),
          providerId: result.sid,
        },
      });
    }

    await prisma.campaign.update({
      where: { id: message.campaignId },
      data: { sent: { increment: 1 } },
    });

    await markRecipientFact(message.recipientId, "message_delivered", true);
    await tryAdvanceRecipientAfterSend(message.recipientId);
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await prisma.campaignMessage.update({
      where: { id: messageId },
      data: { status: "failed", error },
    });
    throw err;
  }
}
