import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { processSequenceWaits } from "./sequence-runner";

const SEND_BATCH = 100;

function inSendWindow(now: Date, startHour: number | null | undefined, endHour: number | null | undefined) {
  if (startHour == null || endHour == null) return true;
  const hour = now.getUTCHours();
  if (startHour === endHour) return true;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

export async function enqueueDueCampaignMessages() {
  const { reclaimStuckSendingMessages } = await import("./campaign-message-send");
  await reclaimStuckSendingMessages();

  const waits = await processSequenceWaits();
  const prisma = getPrisma();
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Activate due scheduled campaigns (Mass Texting requires prior launch audit)
  const { canAutoActivateScheduledCampaign } = await import("@/lib/mass-texting/campaign-guards");
  const dueScheduled = await prisma.campaign.findMany({
    where: {
      status: "SCHEDULED",
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
    },
    select: { id: true, workspaceId: true },
    take: 200,
  });
  for (const campaign of dueScheduled) {
    if (!(await canAutoActivateScheduledCampaign(campaign.workspaceId, campaign.id))) {
      continue;
    }
    await prisma.campaign.updateMany({
      where: { id: campaign.id, status: "SCHEDULED" },
      data: { status: "SENDING" },
    });
  }

  const due = await prisma.campaignMessage.findMany({
    where: {
      status: "queued",
      scheduledFor: { lte: now },
      campaign: { status: "SENDING" },
    },
    take: SEND_BATCH * 2,
    orderBy: { scheduledFor: "asc" },
    include: { campaign: true },
  });

  let enqueued = 0;
  const sentTodayByCampaign = new Map<string, number>();

  for (const msg of due) {
    if (enqueued >= SEND_BATCH) break;

    const campaign = msg.campaign;
    if (!inSendWindow(now, campaign.sendWindowStart, campaign.sendWindowEnd)) {
      // Push out of the due window so other campaigns are not starved
      await prisma.campaignMessage.update({
        where: { id: msg.id },
        data: {
          scheduledFor: new Date(now.getTime() + 60 * 60 * 1000),
          error: "outside_send_window",
        },
      });
      continue;
    }

    if (campaign.dailySendLimit != null) {
      let sentToday = sentTodayByCampaign.get(campaign.id);
      if (sentToday == null) {
        sentToday = await prisma.campaignMessage.count({
          where: {
            campaignId: campaign.id,
            OR: [
              { status: { in: ["sent", "delivered", "clicked"] }, sentAt: { gte: dayStart } },
              { status: "sending", updatedAt: { gte: dayStart } },
            ],
          },
        });
        sentTodayByCampaign.set(campaign.id, Number(sentToday ?? 0));
      }
      const sentCount = Number(sentToday ?? 0);
      if (sentCount >= campaign.dailySendLimit) {
        const tomorrow = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        await prisma.campaignMessage.update({
          where: { id: msg.id },
          data: { scheduledFor: tomorrow, error: "daily_limit" },
        });
        continue;
      }
      sentTodayByCampaign.set(campaign.id, sentCount + 1);
    }

    await enqueueJob({
      jobType: msg.channel === "email" ? "send_campaign_email" : "send_campaign_sms",
      queueName: msg.channel === "email" ? "email-send" : "sms-send",
      workspaceId: msg.workspaceId,
      payload: { messageId: msg.id },
      idempotencyKey: `send-campaign-message:${msg.id}`,
    });
    enqueued += 1;
  }

  return { waits, enqueued };
}

export async function processCampaignSendBatch() {
  return enqueueDueCampaignMessages();
}
