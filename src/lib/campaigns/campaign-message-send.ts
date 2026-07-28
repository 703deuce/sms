import { getPrisma } from "@/lib/db";
import { requireCampaignSendAccess } from "@/lib/billing/entitlements";
import { sendTransactionalEmail } from "@/lib/email/brevo";
import { sendViaRegistration } from "@/lib/messaging/registration-processor";
import { isMessagingReady } from "@/lib/messaging/status";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { tryAdvanceRecipientAfterSend } from "./sequence-runner";

async function claimMessage(id: string) {
  const result = await getPrisma().campaignMessage.updateMany({
    where: { id, status: "queued" },
    data: { status: "sending" },
  });
  return result.count === 1;
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

  if (message.channel === "sms" && message.to) {
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
