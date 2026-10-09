/**
 * Trace latest inbound R for live test phone (production ops).
 * PHONE=+15714776175 HOURS=3
 */
import { getPrisma } from "../src/lib/db";
import { mctbCallerE164Variants, normalizeMctbCallerE164 } from "../src/lib/mctb/messaging/caller-e164";
import { AR_QUEUE_NAME } from "../src/lib/appointment-reminders/messaging/constants";

const PHONE = normalizeMctbCallerE164(process.env.PHONE || "+15714776175");
const HOURS = Number(process.env.HOURS || "3");
const since = new Date(Date.now() - HOURS * 60 * 60 * 1000);

async function main() {
  const prisma = getPrisma();
  const variants = mctbCallerE164Variants(PHONE);

  const receipt = await prisma.arPlatformSmsInboundReceipt.findFirst({
    where: { fromE164: { in: variants }, receivedAt: { gte: since } },
    orderBy: { receivedAt: "desc" },
  });
  console.log("latest_receipt", receipt);

  const held = await prisma.arSmsInboundHeldMessage.findMany({
    where: { fromE164: { in: variants }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log("held", held);

  const jobs = await prisma.jobQueue.findMany({
    where: { queueName: AR_QUEUE_NAME, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      jobType: true,
      status: true,
      lastError: true,
      createdAt: true,
      idempotencyKey: true,
    },
  });
  console.log("jobs", jobs);

  const assignments = await prisma.arSmsConsumerPlatformSenderAssignment.findMany({
    where: { consumerE164: { in: variants } },
  });
  console.log("sender_assignments", assignments);

  const sessions = await prisma.arSmsReplySession.findMany({
    where: { consumerE164: { in: variants } },
    orderBy: { lastUsedAt: "desc" },
    take: 8,
    select: {
      id: true,
      workspaceId: true,
      appointmentId: true,
      lifecycleState: true,
      lastUsedAt: true,
      platformPhoneNumberId: true,
    },
  });
  console.log("sessions", sessions);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
