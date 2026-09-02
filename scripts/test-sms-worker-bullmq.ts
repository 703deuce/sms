/**
 * BullMQ integration test for SMS dispatch worker.
 * Proves: enqueue -> BullMQ consumer -> sendCampaignMessageById callback.
 *
 * Requires REDIS_URL (rediss:// or redis://). Skips when unset.
 *
 * Run:
 *   QUEUE_DRIVER=bullmq REDIS_URL=rediss://... MESSAGING_PROVIDER=mock \
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-sms-worker-bullmq.ts
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
import { activateDueScheduledCampaigns } from "../src/lib/messaging/dispatch/activate-scheduled-campaigns";
import { enqueueDueCampaignMessages } from "../src/lib/campaigns/campaign-processor";

function suffix() {
  return randomBytes(4).toString("hex");
}

async function waitFor(
  label: string,
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 30_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, 200));
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
      name: "BullMQ scheduled test",
      type: "SMS broadcast",
      audience: "test",
      body: "BullMQ integration test",
      status: "SCHEDULED",
      scheduledAt: new Date(Date.now() - 60_000),
      sequenceJson: [
        { step_key: "sms_1", step_type: "send_sms", config: { body: "BullMQ integration test" } },
        { step_key: "end", step_type: "end", config: {} },
      ],
      configJson: {
        productSource: "mass_text",
        massTexting: true,
        broadcastVersion: 1,
        scheduleMode: "later",
      },
    },
  });

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

  await prisma.campaignLaunchAudit.create({
    data: {
      workspaceId: workspace.id,
      campaignId: campaign.id,
      idempotencyKey: `bullmq-test:${campaign.id}`,
      rawContactCount: 1,
      duplicateRemoved: 0,
      invalidRemoved: 0,
      suppressedRemoved: 0,
      finalRecipientCount: 1,
      estimatedSegments: 1,
      estimatedCreditsCents: 1,
    },
  });

  const { reserveSegmentsForCampaign } = await import("../src/lib/mass-texting/credit-accounting");
  await reserveSegmentsForCampaign({
    workspaceId: workspace.id,
    campaignId: campaign.id,
    segments: 1,
    idempotencyKey: `bullmq-reserve:${campaign.id}`,
  });

  const activated = await activateDueScheduledCampaigns(workspace.id);
  assert.ok(activated >= 0);
  const campaignAfterActivate = await prisma.campaign.findUnique({
    where: { id: campaign.id },
    select: { status: true },
  });
  assert.equal(campaignAfterActivate?.status, "SENDING");

  const firstDispatch = await enqueueDueCampaignMessages(workspace.id);
  assert.equal(firstDispatch.enqueued, 1);

  const secondDispatch = await enqueueDueCampaignMessages(workspace.id);
  assert.equal(secondDispatch.enqueued, 0);
  assert.equal(secondDispatch.skippedAlreadyQueued, 1);

  await waitFor("bullmq job received", () => getSmsDispatchBullmqStatus().metrics.received >= 1);
  await waitFor("bullmq job completed", () => getSmsDispatchBullmqStatus().metrics.completed >= 1);

  const after = await prisma.campaignMessage.findUnique({
    where: { id: message.id },
    select: { status: true, error: true },
  });
  assert.notEqual(after?.status, "queued", `message still queued: ${after?.error || ""}`);

  const thirdDispatch = await enqueueDueCampaignMessages(workspace.id);
  assert.equal(thirdDispatch.enqueued, 0);
  assert.equal(thirdDispatch.skippedAlreadyQueued, 0);

  const job = await enqueueJob({
    jobType: "send_campaign_sms",
    queueName: "sms-send",
    workspaceId: workspace.id,
    payload: { messageId: message.id },
    idempotencyKey: `send-campaign-message:${message.id}`,
  });
  assert.ok(job.id);

  await prisma.jobQueue.deleteMany({ where: { workspaceId: workspace.id } }).catch(() => {});
  await prisma.campaignMessage.deleteMany({ where: { workspaceId: workspace.id } }).catch(() => {});
  await prisma.campaignRecipient.deleteMany({ where: { workspaceId: workspace.id } }).catch(() => {});
  await prisma.campaignLaunchAudit.deleteMany({ where: { workspaceId: workspace.id } }).catch(() => {});
  await prisma.campaign.deleteMany({ where: { workspaceId: workspace.id } }).catch(() => {});
  await prisma.workspace.delete({ where: { id: workspace.id } }).catch(() => {});

  console.log("test-sms-worker-bullmq: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
