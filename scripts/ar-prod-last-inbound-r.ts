/**
 * Debug last inbound R for AR live test phone.
 * PHONE=+15714776175 npx tsx scripts/ar-prod-last-inbound-r.ts
 */
import { getPrisma } from "../src/lib/db";
import { normalizeMctbCallerE164, mctbCallerE164Variants } from "../src/lib/mctb/messaging/caller-e164";
import { AR_JOB_PROCESS_INBOUND_SMS, AR_QUEUE_NAME } from "../src/lib/appointment-reminders/messaging/constants";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const PHONE = normalizeMctbCallerE164(process.env.PHONE || "+15714776175");

async function main() {
  const prisma = getPrisma();
  const variants = mctbCallerE164Variants(PHONE);

  const sessions = await prisma.arSmsReplySession.findMany({
    where: { workspaceId: WORKSPACE_ID, consumerE164: { in: variants } },
    orderBy: { lastUsedAt: "desc" },
    take: 3,
    select: {
      id: true,
      appointmentId: true,
      conversationId: true,
      lifecycleState: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });
  console.log("sessions", JSON.stringify(sessions, null, 2));

  const msgs = await prisma.message.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      OR: [{ from: { in: variants } }, { to: { in: variants } }],
      createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      direction: true,
      from: true,
      to: true,
      body: true,
      status: true,
      createdAt: true,
      providerId: true,
    },
  });
  console.log("\nlast_30min_messages");
  for (const m of msgs) {
    console.log({
      at: m.createdAt.toISOString(),
      dir: m.direction,
      status: m.status,
      body: (m.body || "").slice(0, 100),
    });
  }

  const convMsgs = await prisma.conversationMessage.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
      body: { in: ["R", "r"] },
      conversation: { workspaceId: WORKSPACE_ID, contact: { phone: { in: variants } } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      conversationId: true,
      providerMessageId: true,
      createdAt: true,
    },
  });
  console.log("\ninbound_R_conversation_messages", convMsgs);

  const jobs = await prisma.jobQueue.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      queueName: AR_QUEUE_NAME,
      jobType: AR_JOB_PROCESS_INBOUND_SMS,
      createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      status: true,
      attempts: true,
      lastError: true,
      createdAt: true,
      completedAt: true,
      idempotencyKey: true,
      payload: true,
    },
  });
  console.log("\nar_inbound_jobs");
  for (const j of jobs) {
    const p = j.payload as { body?: string; providerMessageId?: string };
    console.log({
      id: j.id,
      status: j.status,
      attempts: j.attempts,
      at: j.createdAt.toISOString(),
      completed: j.completedAt?.toISOString(),
      body: p?.body,
      lastError: j.lastError?.slice(0, 200),
    });
  }

  const outboundJobs = await prisma.jobQueue.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      queueName: AR_QUEUE_NAME,
      jobType: "ar_send_customer_sms",
      createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, status: true, lastError: true, createdAt: true, payload: true },
  });
  console.log("\nar_outbound_jobs", outboundJobs);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
