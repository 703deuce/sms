import { getPrisma } from "@/lib/db";
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

  // Suppression check
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
      return { optedOut: true };
    }
  }

  try {
    if (message.channel === "email") {
      // Email provider (Brevo) — stub until BREVO_API_KEY is wired
      if (!process.env.BREVO_API_KEY) {
        await prisma.campaignMessage.update({
          where: { id: messageId },
          data: {
            status: "sent",
            sentAt: new Date(),
            providerId: `email_stub_${Date.now()}`,
          },
        });
      } else {
        // Placeholder: integrate Brevo transactional API here
        await prisma.campaignMessage.update({
          where: { id: messageId },
          data: {
            status: "sent",
            sentAt: new Date(),
            providerId: `brevo_pending_${Date.now()}`,
          },
        });
      }
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
