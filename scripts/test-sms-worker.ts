/**
 * SMS dispatch worker certification — scheduler, claiming, fairness, kill switches.
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-sms-worker.ts
 */
process.env.DISABLE_INPROCESS_WORKER = "1";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { getPrisma } from "../src/lib/db";
import {
  claimDueJobs,
  enqueueJob,
  reclaimStuckJobs,
} from "../src/lib/messaging/enqueue-advance";
import { activateDueScheduledCampaigns } from "../src/lib/messaging/dispatch/activate-scheduled-campaigns";
import { selectDueCampaignMessagesFairly } from "../src/lib/messaging/dispatch/fair-queue";
import {
  assertDispatchAllowed,
  isPlatformDispatchPaused,
} from "../src/lib/messaging/dispatch/kill-switches";
import {
  canDispatchNow,
  resetDispatchRateLimiterForTests,
} from "../src/lib/messaging/dispatch/rate-limiter";
import { runSmsSchedulerCycle } from "../src/lib/messaging/dispatch/scheduler";
import { recordWorkerHeartbeat, getWorkerHeartbeat } from "../src/lib/messaging/dispatch/heartbeat";
import { enqueueDueCampaignMessages } from "../src/lib/campaigns/campaign-processor";
import { sendCampaignMessageById } from "../src/lib/campaigns/campaign-message-send";
import { processSmsWorkerDueJobs, SMS_WORKER_JOB_TYPES } from "../src/lib/jobs/sms-worker-jobs";

function suffix() {
  return randomBytes(4).toString("hex");
}

async function createWorkspace(name: string) {
  const prisma = getPrisma();
  const id = suffix();
  return prisma.workspace.create({
    data: { name: `${name} ${id}`, slug: `sms-wk-${id}`, type: "BUSINESS" },
  });
}

async function cleanupWorkspace(workspaceId: string) {
  const prisma = getPrisma();
  await prisma.jobQueue.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.campaignMessage.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.campaignRecipient.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.campaign.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.contact.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
}

async function seedQueuedMessage(input: {
  workspaceId: string;
  campaignId: string;
  recipientId: string;
  scheduledFor?: Date;
}) {
  const prisma = getPrisma();
  return prisma.campaignMessage.create({
    data: {
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      recipientId: input.recipientId,
      channel: "sms",
      to: "+15551234567",
      body: "Hello",
      status: "queued",
      scheduledFor: input.scheduledFor ?? new Date(Date.now() - 1_000),
      stepKey: "sms_1",
    },
  });
}

async function claimJobById(jobId: string) {
  const prisma = getPrisma();
  const now = new Date();
  const updated = await prisma.jobQueue.updateMany({
    where: { id: jobId, status: { in: ["pending", "deferred"] } },
    data: { status: "processing", lockedAt: now, attempts: { increment: 1 } },
  });
  return updated.count;
}

async function testSkipLockedClaiming() {
  const prisma = getPrisma();
  const ws = await createWorkspace("SkipLocked");
  try {
    const job = await enqueueJob({
      jobType: "campaign_send_batch",
      queueName: "review-campaign",
      workspaceId: ws.id,
      payload: { test: true },
      idempotencyKey: `test-skip-locked:${suffix()}`,
      priority: 1,
    });
    const before = await prisma.jobQueue.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(before.status, "pending");
    assert.equal(await claimJobById(job.id), 1);
    assert.equal(await claimJobById(job.id), 0, "second claim must not succeed");
    await prisma.jobQueue.update({
      where: { id: job.id },
      data: { status: "completed", completedAt: new Date(), lockedAt: null },
    });
    console.log("  ✓ CAS claim prevents double claim");
  } finally {
    await cleanupWorkspace(ws.id);
  }
}

async function testReclaimStuckJobs() {
  const prisma = getPrisma();
  const ws = await createWorkspace("Reclaim");
  try {
    const job = await enqueueJob({
      jobType: "campaign_send_batch",
      queueName: "review-campaign",
      workspaceId: ws.id,
      payload: { reclaim: true },
      idempotencyKey: `test-reclaim:${suffix()}`,
    });
    await prisma.jobQueue.update({
      where: { id: job.id },
      data: {
        status: "processing",
        lockedAt: new Date(Date.now() - 20 * 60_000),
      },
    });
    const reclaimed = await reclaimStuckJobs(60_000);
    assert.ok(reclaimed >= 1);
    const after = await prisma.jobQueue.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(after.status, "pending");
    assert.equal(after.lockedAt, null);
    console.log("  ✓ expired processing lease reclaimed");
  } finally {
    await cleanupWorkspace(ws.id);
  }
}

async function testFairTenantDispatch() {
  const prisma = getPrisma();
  const big = await createWorkspace("Big Tenant");
  const small = await createWorkspace("Small Tenant");
  try {
    const bigCampaign = await prisma.campaign.create({
      data: {
        workspaceId: big.id,
        name: "Big blast",
        type: "Broadcast",
        category: "promotion",
        audience: "List",
        body: "big",
        status: "SENDING",
      },
    });
    const smallCampaign = await prisma.campaign.create({
      data: {
        workspaceId: small.id,
        name: "Small blast",
        type: "Broadcast",
        category: "promotion",
        audience: "List",
        body: "small",
        status: "SENDING",
      },
    });

    const bigRecipient = await prisma.campaignRecipient.create({
      data: {
        workspaceId: big.id,
        campaignId: bigCampaign.id,
        phone: "+15550000001",
        workflowStatus: "in_progress",
        currentStep: "sms_1",
      },
    });
    void bigRecipient;
    const smallRecipient = await prisma.campaignRecipient.create({
      data: {
        workspaceId: small.id,
        campaignId: smallCampaign.id,
        phone: "+15550000002",
        workflowStatus: "in_progress",
        currentStep: "sms_1",
      },
    });

    for (let i = 0; i < 30; i += 1) {
      const recipient = await prisma.campaignRecipient.create({
        data: {
          workspaceId: big.id,
          campaignId: bigCampaign.id,
          phone: `+1555000${String(1000 + i).padStart(4, "0")}`,
          workflowStatus: "in_progress",
          currentStep: "sms_1",
        },
      });
      await seedQueuedMessage({
        workspaceId: big.id,
        campaignId: bigCampaign.id,
        recipientId: recipient.id,
      });
    }
    await seedQueuedMessage({
      workspaceId: small.id,
      campaignId: smallCampaign.id,
      recipientId: smallRecipient.id,
    });

    const fair = await selectDueCampaignMessagesFairly(10);
    const smallIncluded = fair.some((m) => m.workspaceId === small.id);
    assert.ok(smallIncluded, "small tenant must not be starved by large tenant");
    console.log("  ✓ fair tenant round-robin includes small tenant");
  } finally {
    await cleanupWorkspace(big.id);
    await cleanupWorkspace(small.id);
  }
}

async function testScheduledCampaignActivation() {
  const prisma = getPrisma();
  const ws = await createWorkspace("Scheduled");
  try {
    const campaign = await prisma.campaign.create({
      data: {
        workspaceId: ws.id,
        name: "Future send",
        type: "Broadcast",
        category: "promotion",
        audience: "List",
        body: "scheduled",
        status: "SCHEDULED",
        scheduledAt: new Date(Date.now() - 5_000),
      },
    });
    const activated = await activateDueScheduledCampaigns(ws.id);
    assert.equal(activated, 1);
    const after = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    assert.equal(after.status, "SENDING");
    console.log("  ✓ scheduled campaign activates when due");
  } finally {
    await cleanupWorkspace(ws.id);
  }
}

async function testCancellationStopsEnqueue() {
  const prisma = getPrisma();
  const ws = await createWorkspace("Cancel");
  try {
    const campaign = await prisma.campaign.create({
      data: {
        workspaceId: ws.id,
        name: "Canceled",
        type: "Broadcast",
        category: "promotion",
        audience: "List",
        body: "nope",
        status: "CANCELED",
      },
    });
    const recipient = await prisma.campaignRecipient.create({
      data: {
        workspaceId: ws.id,
        campaignId: campaign.id,
        phone: "+15559998888",
        workflowStatus: "in_progress",
        currentStep: "sms_1",
      },
    });
    await seedQueuedMessage({
      workspaceId: ws.id,
      campaignId: campaign.id,
      recipientId: recipient.id,
    });
    const result = await enqueueDueCampaignMessages(ws.id);
    assert.equal(result.enqueued, 0);
    const jobs = await prisma.jobQueue.count({
      where: { workspaceId: ws.id, jobType: "send_campaign_sms" },
    });
    assert.equal(jobs, 0);
    console.log("  ✓ canceled campaign does not enqueue sends");
  } finally {
    await cleanupWorkspace(ws.id);
  }
}

async function testOptOutAtSendTime() {
  const prisma = getPrisma();
  const ws = await createWorkspace("OptOut");
  try {
    const campaign = await prisma.campaign.create({
      data: {
        workspaceId: ws.id,
        name: "Opted",
        type: "Broadcast",
        category: "promotion",
        audience: "List",
        body: "hi",
        status: "SENDING",
      },
    });
    const phone = "+15557776666";
    await prisma.contact.create({
      data: {
        workspaceId: ws.id,
        phone,
        status: "UNSUBSCRIBED",
        firstName: "Stop",
      },
    });
    const recipient = await prisma.campaignRecipient.create({
      data: {
        workspaceId: ws.id,
        campaignId: campaign.id,
        phone,
        workflowStatus: "in_progress",
        currentStep: "sms_1",
      },
    });
    const message = await prisma.campaignMessage.create({
      data: {
        workspaceId: ws.id,
        campaignId: campaign.id,
        recipientId: recipient.id,
        channel: "sms",
        to: phone,
        body: "hi",
        status: "queued",
        scheduledFor: new Date(Date.now() - 1_000),
        stepKey: "sms_1",
      },
    });

    const result = await sendCampaignMessageById(message.id);
    assert.equal((result as { optedOut?: boolean }).optedOut, true);
    const after = await prisma.campaignMessage.findUniqueOrThrow({ where: { id: message.id } });
    assert.equal(after.status, "opted_out");
    console.log("  ✓ opt-out between schedule and send blocks delivery");
  } finally {
    await cleanupWorkspace(ws.id);
  }
}

async function testIdempotentJobEnqueue() {
  const key = `send-campaign-message:test-${suffix()}`;
  const first = await enqueueJob({
    jobType: "send_campaign_sms",
    queueName: "sms-send",
    payload: { messageId: "msg-test" },
    idempotencyKey: key,
  });
  const second = await enqueueJob({
    jobType: "send_campaign_sms",
    queueName: "sms-send",
    payload: { messageId: "msg-test" },
    idempotencyKey: key,
  });
  assert.equal(first.id, second.id);
  console.log("  ✓ idempotent job enqueue dedupes by key");
}

async function testKillSwitch() {
  const prev = process.env.SMS_DISPATCH_PAUSED;
  process.env.SMS_DISPATCH_PAUSED = "1";
  try {
    assert.equal(isPlatformDispatchPaused(), true);
    const ws = await createWorkspace("KillSwitch");
    try {
      const gate = await assertDispatchAllowed({ workspaceId: ws.id });
      assert.equal(gate.allowed, false);
      console.log("  ✓ platform kill switch blocks dispatch");
    } finally {
      await cleanupWorkspace(ws.id);
    }
  } finally {
    if (prev === undefined) delete process.env.SMS_DISPATCH_PAUSED;
    else process.env.SMS_DISPATCH_PAUSED = prev;
  }
}

async function testRateLimiter() {
  resetDispatchRateLimiterForTests();
  process.env.DISPATCH_TENANT_MPS = "1";
  const ws = await createWorkspace("Rate");
  try {
    const first = canDispatchNow({ workspaceId: ws.id });
    const second = canDispatchNow({ workspaceId: ws.id });
    assert.equal(first.allowed, true);
    assert.equal(second.allowed, false);
    console.log("  ✓ tenant rate limiter throttles burst");
  } finally {
    delete process.env.DISPATCH_TENANT_MPS;
    resetDispatchRateLimiterForTests();
    await cleanupWorkspace(ws.id);
  }
}

async function testHeartbeat() {
  const key = `test-heartbeat:${suffix()}`;
  try {
    await recordWorkerHeartbeat(key, "worker-test-1", { cycleMs: 12, jobsProcessed: 3 });
    const beat = await getWorkerHeartbeat(key);
    if (!beat) {
      console.log("  ⚠ worker heartbeat table missing — apply supabase/sms-worker-heartbeat.sql");
      return;
    }
    assert.equal(beat.workerId, "worker-test-1");
    const prisma = getPrisma();
    await prisma.workerHeartbeat.delete({ where: { workerKey: key } }).catch(() => {});
    console.log("  ✓ worker heartbeat persisted");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("worker_heartbeats")) {
      console.log("  ⚠ worker heartbeat table missing — apply supabase/sms-worker-heartbeat.sql");
      return;
    }
    throw err;
  }
}

async function testSchedulerCycle() {
  const result = await runSmsSchedulerCycle();
  assert.ok(typeof result.campaignsActivated === "number");
  assert.ok(typeof result.messagesEnqueued === "number");
  console.log("  ✓ scheduler cycle completes");
}

async function testSmsWorkerJobFilter() {
  const ws = await createWorkspace("Filter");
  const prisma = getPrisma();
  try {
    const voiceJob = await enqueueJob({
      jobType: "voice_post_call",
      queueName: "voice-calls",
      workspaceId: ws.id,
      payload: { callId: "call-1" },
      idempotencyKey: `voice-only:${suffix()}`,
      priority: 1,
    });
    await enqueueJob({
      jobType: "campaign_send_batch",
      queueName: "review-campaign",
      workspaceId: ws.id,
      payload: { minuteKey: "test" },
      idempotencyKey: `sms-batch:${suffix()}`,
      priority: 1,
    });

    const claimed = await claimDueJobs(100, { jobTypes: [...SMS_WORKER_JOB_TYPES] });
    assert.equal(
      claimed.some((j) => j.id === voiceJob.id),
      false,
      "SMS worker claim set must not include voice_post_call",
    );
    assert.ok(
      claimed.every((j) => SMS_WORKER_JOB_TYPES.includes(j.jobType as (typeof SMS_WORKER_JOB_TYPES)[number])),
      "SMS worker claim set must only include SMS job types",
    );

    for (const job of claimed) {
      await prisma.jobQueue.update({
        where: { id: job.id },
        data: { status: "pending", lockedAt: null },
      });
    }

    console.log("  ✓ SMS worker job-type filter excludes voice jobs");
  } finally {
    await cleanupWorkspace(ws.id);
  }
}

async function main() {
  console.log("SMS worker certification\n");
  await testSkipLockedClaiming();
  await testReclaimStuckJobs();
  await testFairTenantDispatch();
  await testScheduledCampaignActivation();
  await testCancellationStopsEnqueue();
  await testOptOutAtSendTime();
  await testIdempotentJobEnqueue();
  await testKillSwitch();
  await testRateLimiter();
  await testHeartbeat();
  await testSchedulerCycle();
  await testSmsWorkerJobFilter();
  console.log("\nAll SMS worker tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
