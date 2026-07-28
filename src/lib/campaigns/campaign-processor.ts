import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { processSequenceWaits } from "./sequence-runner";

const SEND_BATCH = 100;

export async function enqueueDueCampaignMessages() {
  const waits = await processSequenceWaits();
  const prisma = getPrisma();
  const now = new Date();

  const due = await prisma.campaignMessage.findMany({
    where: {
      status: "queued",
      scheduledFor: { lte: now },
      campaign: { status: { in: ["SENDING", "SCHEDULED"] } },
    },
    take: SEND_BATCH,
    orderBy: { scheduledFor: "asc" },
  });

  let enqueued = 0;
  for (const msg of due) {
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
