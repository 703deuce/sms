/**
 * BullMQ integration test for SMS dispatch worker.
 * Proves: enqueue -> BullMQ consumer -> sendCampaignMessageById callback.
 *
 * Requires REDIS_URL (rediss:// or redis://). Skips when unset.
 */
process.env.DISABLE_INPROCESS_WORKER = "1";
process.env.QUEUE_DRIVER = "bullmq";
process.env.MESSAGING_PROVIDER = process.env.MESSAGING_PROVIDER || "mock";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { getPrisma } from "../src/lib/db";
import { enqueueJob } from "../src/lib/messaging/enqueue-advance";
import {
  assertBullmqRedisUrl,
  getSmsDispatchBullmqStatus,
  resetSmsDispatchBullmqMetricsForTests,
  startSmsDispatchBullmqWorkers,
} from "../src/lib/jobs/bullmq";
import { enqueueDueCampaignMessages } from "../src/lib/campaigns/campaign-processor";

function suffix() {
  return randomBytes(4).toString("hex");
}

async function waitFor(
  label: string,
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 45_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timeout waiting for ${label}`);
}

async function main() {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    console.log("SKIP test-sms-worker-bullmq: REDIS_URL not set");
    return;
  }

  assert.throws(
    () => assertBullmqRedisUrl("https://example.upstash.io"),
    /Redis protocol URL/,
  );
  assertBullmqRedisUrl(redisUrl);

  const { verifyBullmqConnection } = await import("../src/lib/jobs/bullmq");
  await verifyBullmqConnection(15_000);

  resetSmsDispatchBullmqMetricsForTests();
  await startSmsDispatchBullmqWorkers();
  assert.equal(getSmsDispatchBullmqStatus().ready, true);

  const prisma = getPrisma();
  const id = suffix();
  const workspace = await prisma.workspace.create({
    data: {
      name: `BullMQ ${id}`,
      slug: `bullmq-${id}`,
      type: "BUSINESS",
      creditBalanceCents: 1_000_000,
      customFieldsConfig: { billing: { unlimitedCredits: true } },
    },
  });

  await prisma.messagingRegistration.create({
    data: {
      workspaceId: workspace.id,
      overallStatus: "ready",
      messagingEnabled: true,
      phoneAttached: true,
      phoneE164: "+15555550199",
      messagingProvider: "mock",
      messagingServiceSid: "mock-svc",
      brandStatus: "approved",
      campaignStatus: "approved",
    },
  });

  await prisma.messagingProductRegistration.create({
    data: {
      workspaceId: workspace.id,
      productUseCase: "MASS_TEXT_MARKETING",
      overallStatus: "approved",
      messagingEnabled: true,
      phoneAttached: true,
      phoneE164: "+15555550199",
    },
  });

  const { getOrCreateMassTextingBillingAccount } = await import(
    "../src/lib/mass-texting/billing-account"
  );
  await getOrCreateMassTextingBillingAccount(workspace.id);

  const campaign = await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      name: "BullMQ direct send test",
      type: "SMS broadcast",
      audience: "test",
      body: "BullMQ integration test",
      status: "SENDING",
      sequenceJson: [
        { step_key: "sms_1", step_type: "send_sms", config: { body: "BullMQ integration test" } },
        { step_key: "end", step_type: "end", config: {} },
      ],
      configJson: {
        scheduleMode: "now",
      },
    },
  });

  const { reserveSegmentsForCampaign } = await import("../src/lib/mass-texting/credit-accounting");
  await reserveSegmentsForCampaign({
    workspaceId: workspace.id,
    campaignId: campaign.id,
    segments: 5,
    idempotencyKey: `bullmq-reserve:${campaign.id}`,
  }).catch(() => undefined);

  const recipient = await prisma.campaignRecipient.create({
    data: {
      workspaceId: workspace.id,
      campaignId: campaign.id,
      phone: "+15551234001",
      displayName: "Test",
      workflowStatus: "in_progress",
      currentStep: "sms_1",
    },
  });

  const message = await prisma.campaignMessage.create({
    data: {
      workspaceId: workspace.id,
      campaignId: campaign.id,
      recipientId: recipient.id,
      channel: "sms",
      stepKey: "sms_1",
      to: "+15551234001",
      body: "BullMQ integration test",
      status: "queued",
      scheduledFor: new Date(Date.now() - 1_000),
    },
  });

  const firstDispatch = await enqueueDueCampaignMessages(workspace.id);
  assert.equal(firstDispatch.enqueued, 1, JSON.stringify(firstDispatch));

  const duplicateDispatch = await enqueueDueCampaignMessages(workspace.id);
  assert.equal(duplicateDispatch.enqueued, 0);
  assert.equal(duplicateDispatch.skippedAlreadyQueued, 1);

  await waitFor(
    "campaign message sent",
    async () => {
      const row = await prisma.campaignMessage.findUnique({
        where: { id: message.id },
        select: { status: true },
      });
      return row != null && row.status !== "queued";
    },
  );

  const after = await prisma.campaignMessage.findUnique({
    where: { id: message.id },
    select: { status: true, error: true },
  });
  assert.notEqual(after?.status, "queued", `message still queued: ${after?.error || ""}`);

  await prisma.jobQueue.deleteMany({ where: { workspaceId: workspace.id } }).catch(() => {});
  await prisma.campaignMessage.deleteMany({ where: { workspaceId: workspace.id } }).catch(() => {});
  await prisma.campaignRecipient.deleteMany({ where: { workspaceId: workspace.id } }).catch(() => {});
  await prisma.campaign.deleteMany({ where: { workspaceId: workspace.id } }).catch(() => {});
  await prisma.workspace.delete({ where: { id: workspace.id } }).catch(() => {});

  console.log("test-sms-worker-bullmq: ok");

  const { closeBullmqWorkers } = await import("../src/lib/jobs/bullmq");
  await closeBullmqWorkers();
}

process.on("unhandledRejection", (err) => {
  console.error(err);
  process.exit(1);
});

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
