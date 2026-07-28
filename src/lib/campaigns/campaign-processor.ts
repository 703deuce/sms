import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { processSequenceWaits } from "./sequence-runner";

const SEND_BATCH = 100;

function inSendWindow(now: Date, startHour: number | null | undefined, endHour: number | null | undefined) {
  if (startHour == null || endHour == null) return true;
  const hour = now.getUTCHours();
  if (startHour === endHour) return true;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  // wraps midnight
  return hour >= startHour || hour < endHour;
}

export async function enqueueDueCampaignMessages() {
  const waits = await processSequenceWaits();
  const prisma = getPrisma();
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const due = await prisma.campaignMessage.findMany({
    where: {
      status: "queued",
      scheduledFor: { lte: now },
      campaign: { status: { in: ["SENDING", "SCHEDULED"] } },
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
      continue;
    }

    if (campaign.dailySendLimit != null) {
      let sentToday = sentTodayByCampaign.get(campaign.id);
      if (sentToday == null) {
        sentToday = await prisma.campaignMessage.count({
          where: {
            campaignId: campaign.id,
            status: { in: ["sent", "delivered", "sending", "clicked"] },
            sentAt: { gte: dayStart },
          },
        });
        sentTodayByCampaign.set(campaign.id, sentToday);
      }
      if (sentToday >= campaign.dailySendLimit) {
        continue;
      }
      sentTodayByCampaign.set(campaign.id, sentToday + 1);
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
