import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { processSequenceWaits } from "./sequence-runner";
import { activateDueScheduledCampaigns } from "@/lib/messaging/dispatch/activate-scheduled-campaigns";
import { selectDueCampaignMessagesFairly } from "@/lib/messaging/dispatch/fair-queue";
import { assertDispatchAllowed } from "@/lib/messaging/dispatch/kill-switches";
import { canDispatchNow } from "@/lib/messaging/dispatch/rate-limiter";
import { getWorkspaceLimits } from "@/lib/settings/limits";

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

  await activateDueScheduledCampaigns(workspaceId);

  const due = await selectDueCampaignMessagesFairly(SEND_BATCH * 2, workspaceId);
  const campaignIds = [...new Set(due.map((m) => m.campaignId))];
  const campaigns = campaignIds.length
    ? await prisma.campaign.findMany({
        where: { id: { in: campaignIds } },
      })
    : [];
  const campaignById = new Map(campaigns.map((c) => [c.id, c]));

  let enqueued = 0;
  let skippedAlreadyQueued = 0;
  let rateLimited = 0;
  const sentTodayByCampaign = new Map<string, number>();
  const limitsCache = new Map<string, Awaited<ReturnType<typeof getWorkspaceLimits>>>();

  for (const msg of due) {
    if (enqueued >= SEND_BATCH) break;

    const campaign = campaignById.get(msg.campaignId);
    if (!campaign) continue;

    const gate = await assertDispatchAllowed({
      workspaceId: msg.workspaceId,
      campaignId: msg.campaignId,
    });
    if (!gate.allowed) {
      await prisma.campaignMessage.update({
        where: { id: msg.id },
        data: { scheduledFor: new Date(now.getTime() + 60_000), error: gate.reason },
      });
      continue;
    }

    if (!inSendWindow(now, campaign.sendWindowStart, campaign.sendWindowEnd)) {
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
      if (sentToday >= campaign.dailySendLimit) {
        const tomorrow = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        await prisma.campaignMessage.update({
          where: { id: msg.id },
          data: { scheduledFor: tomorrow, error: "daily_limit" },
        });
        continue;
      }
      sentTodayByCampaign.set(campaign.id, sentToday + 1);
    }

    let limitsRow = limitsCache.get(msg.workspaceId);
    if (limitsRow === undefined) {
      limitsRow = await getWorkspaceLimits(msg.workspaceId);
      limitsCache.set(msg.workspaceId, limitsRow);
    }

    const config =
      campaign.configJson && typeof campaign.configJson === "object"
        ? (campaign.configJson as Record<string, unknown>)
        : {};
    const senderKey = typeof config.numberId === "string" ? config.numberId : undefined;

    const rate = canDispatchNow({
      workspaceId: msg.workspaceId,
      campaignId: msg.campaignId,
      senderKey,
      workspaceLimits: limitsRow ?? undefined,
    });
    if (!rate.allowed) {
      rateLimited += 1;
      await prisma.campaignMessage.update({
        where: { id: msg.id },
        data: {
          scheduledFor: new Date(now.getTime() + 5_000),
          error: rate.reason || "rate_limited",
        },
      });
      continue;
    }

    const idempotencyKey = `send-campaign-message:${msg.id}`;
    const existingJob = await prisma.jobQueue.findUnique({
      where: { idempotencyKey },
      select: { status: true },
    });
    if (
      existingJob &&
      (existingJob.status === "pending" ||
        existingJob.status === "deferred" ||
        existingJob.status === "processing")
    ) {
      skippedAlreadyQueued += 1;
      continue;
    }

    await enqueueJob({
      jobType: msg.channel === "email" ? "send_campaign_email" : "send_campaign_sms",
      queueName: msg.channel === "email" ? "email-send" : "sms-send",
      workspaceId: msg.workspaceId,
      payload: { messageId: msg.id },
      idempotencyKey,
    });
    enqueued += 1;
  }

  return { waits, enqueued, skippedAlreadyQueued, rateLimited };
}

export async function processCampaignSendBatch() {
  return enqueueDueCampaignMessages();
}
