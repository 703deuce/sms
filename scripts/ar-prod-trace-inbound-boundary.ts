/**
 * Trace inbound SMS boundary for AR live test phone (no message bodies in output).
 * PHONE=+15714776175 WORKSPACE_ID=ws_1 HOURS=6
 */
import { getPrisma } from "../src/lib/db";
import { normalizeMctbCallerE164, mctbCallerE164Variants } from "../src/lib/mctb/messaging/caller-e164";
import { AR_JOB_PROCESS_INBOUND_SMS, AR_QUEUE_NAME } from "../src/lib/appointment-reminders/messaging/constants";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const PHONE = normalizeMctbCallerE164(process.env.PHONE || "+15714776175");
const HOURS = Number(process.env.HOURS || "6");
const since = new Date(Date.now() - HOURS * 60 * 60 * 1000);

async function main() {
  const prisma = getPrisma();
  const variants = mctbCallerE164Variants(PHONE);

  const held = await prisma.arSmsInboundHeldMessage.findMany({
    where: { fromE164: { in: variants }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      providerMessageId: true,
      holdReason: true,
      state: true,
      createdAt: true,
      bodyPreview: true,
    },
  });
  console.log("held_inbound", held.map((h) => ({ ...h, bodyPreview: h.bodyPreview?.slice(0, 3) + "…" })));

  const jobs = await prisma.jobQueue.findMany({
    where: {
      queueName: AR_QUEUE_NAME,
      createdAt: { gte: since },
      OR: [
        { jobType: AR_JOB_PROCESS_INBOUND_SMS },
        { jobType: "ar_send_customer_sms" },
        { jobType: "ar_inbound_held" },
        { jobType: "ar_platform_sms_inbound" },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      jobType: true,
      status: true,
      attempts: true,
      idempotencyKey: true,
      lastError: true,
      createdAt: true,
      completedAt: true,
    },
  });
  console.log("\nrecent_ar_jobs", jobs);

  const inboundConv = await prisma.conversationMessage.findMany({
    where: {
      createdAt: { gte: since },
      direction: "inbound",
      conversation: { workspaceId: WORKSPACE_ID, contact: { phone: { in: variants } } },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      conversationId: true,
      providerMessageId: true,
      createdAt: true,
      body: true,
    },
  });
  console.log(
    "\ninbound_conversation_messages",
    inboundConv.map((m) => ({
      at: m.createdAt.toISOString(),
      conversationId: m.conversationId,
      providerMessageId: m.providerMessageId,
      bodyLen: (m.body || "").length,
      isLetter: /^[RCXr]$/i.test((m.body || "").trim()) ? (m.body || "").trim().toUpperCase() : null,
    })),
  );

  const session = await prisma.arSmsReplySession.findFirst({
    where: { workspaceId: WORKSPACE_ID, consumerE164: PHONE, lifecycleState: { not: "EXPIRED" } },
    orderBy: { lastUsedAt: "desc" },
    select: {
      id: true,
      appointmentId: true,
      conversationId: true,
      lifecycleState: true,
      lastOutboundMessageId: true,
      lastOutboundProviderMessageId: true,
      lastUsedAt: true,
    },
  });
  console.log("\nactive_session", session);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
