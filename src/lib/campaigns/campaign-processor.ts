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

export async function enqueueDueCampaignMessages(workspaceId?: string) {
  const prisma = getPrisma();
  let waits: Awaited<ReturnType<typeof processSequenceWaits>> = { advanced: 0 };
  if (!workspaceId) {
    const { reclaimStuckSendingMessages } = await import("./campaign-message-send");
    await reclaimStuckSendingMessages();
    waits = await processSequenceWaits();
  }

  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const workspaceFilter = workspaceId ? { workspaceId } : {};

  // Activate due scheduled campaigns. Mass Texting requires a launch audit
  // (credits reserved + A2P) — never flip a draft-scheduled blast to SENDING.
  const dueScheduled = await prisma.campaign.findMany({
    where: {
      ...workspaceFilter,
      status: "SCHEDULED",
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
    },
    take: 80,
    select: { id: true, workspaceId: true, configJson: true },
  });
  const { campaignConfigIsMassText } = await import("@/lib/mass-texting/campaign-send");
  for (const campaign of dueScheduled) {
    if (campaignConfigIsMassText(campaign.configJson)) {
      const audit = await prisma.campaignLaunchAudit.findFirst({
        where: { workspaceId: campaign.workspaceId, campaignId: campaign.id },
        select: { id: true },
      });
      if (!audit) continue;
    }
    await prisma.campaign.updateMany({
      where: { id: campaign.id, status: "SCHEDULED" },
      data: { status: "SENDING" },
    });
  }

  const due = await prisma.campaignMessage.findMany({
    where: {
      ...workspaceFilter,
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
