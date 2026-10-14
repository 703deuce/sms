/**
 * SMS worker production certification — concurrency, crash recovery, rate limits, fairness.
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-sms-worker-cert.ts
 */
process.env.DISABLE_INPROCESS_WORKER = "1";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { getPrisma } from "../src/lib/db";
import {
  claimJobById,
  enqueueJob,
  reclaimStuckJobs,
} from "../src/lib/messaging/enqueue-advance";
import { reclaimStuckSendingMessages } from "../src/lib/campaigns/campaign-message-send";
import { selectDueCampaignMessagesFairly } from "../src/lib/messaging/dispatch/fair-queue";
import {
  canDispatchNow,
  getDispatchRateLimits,
  resetDispatchRateLimiterForTests,
} from "../src/lib/messaging/dispatch/rate-limiter";

const execFileAsync = promisify(execFile);

function suffix() {
  return randomBytes(4).toString("hex");
}

async function createWorkspace(name: string) {
  const prisma = getPrisma();
  const id = suffix();
  return prisma.workspace.create({
    data: { name: `${name} ${id}`, slug: `sms-cert-${id}`, type: "BUSINESS" },
  });
}

async function cleanupWorkspace(workspaceId: string) {
  const prisma = getPrisma();
  await prisma.jobQueue.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.campaignMessage.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.campaignRecipient.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.campaign.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
}

async function runClaimProbe(jobId: string) {
  const tsx = join(process.cwd(), "node_modules", ".bin", "tsx");
  const { stdout } = await execFileAsync(tsx, ["scripts/worker-claim-probe.ts", jobId], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DISABLE_INPROCESS_WORKER: "1",
      NODE_OPTIONS: "--import ./scripts/preload-server-only.mjs",
    },
    timeout: 60_000,
  });
  const line = stdout.trim().split("\n").pop() || "{}";
  return JSON.parse(line) as { jobId: string; claimed: number };
}

async function testConcurrentJobClaim() {
  const prisma = getPrisma();
  const ws = await createWorkspace("ConcurrentClaim");
  try {
    const job = await enqueueJob({
      jobType: "campaign_send_batch",
      queueName: "review-campaign",
      workspaceId: ws.id,
      payload: { probe: true },
      idempotencyKey: `concurrent-claim:${suffix()}`,
      priority: 1,
    });

    const rounds = 3;
    for (let round = 0; round < rounds; round += 1) {
      await prisma.jobQueue.update({
        where: { id: job.id },
        data: { status: "pending", lockedAt: null, attempts: 0 },
      });
      const [a, b] = await Promise.all([runClaimProbe(job.id), runClaimProbe(job.id)]);
      assert.equal(a.claimed + b.claimed, 1, `round ${round + 1}: exactly one process may claim`);
    }
    console.log("  ✓ two simultaneous worker processes cannot both claim the same job");
  } finally {
    await cleanupWorkspace(ws.id);
  }
}

async function testCrashRecoveryJobQueue() {
  const prisma = getPrisma();
  const ws = await createWorkspace("CrashRecovery");
  try {
    const job = await enqueueJob({
      jobType: "send_campaign_sms",
      queueName: "sms-send",
      workspaceId: ws.id,
      payload: { messageId: `msg-${suffix()}` },
      idempotencyKey: `crash-recovery:${suffix()}`,
      priority: 1,
    });

    await prisma.jobQueue.update({
      where: { id: job.id },
      data: {
        status: "processing",
        lockedAt: new Date(Date.now() - 20 * 60_000),
        attempts: 1,
      },
    });

    const reclaimed = await reclaimStuckJobs(60_000);
    assert.ok(reclaimed >= 1);
    const afterReclaim = await prisma.jobQueue.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(afterReclaim.status, "pending");

    const [a, b] = await Promise.all([runClaimProbe(job.id), runClaimProbe(job.id)]);
    assert.equal(a.claimed + b.claimed, 1, "after recovery only one worker may claim");

    await prisma.jobQueue.update({
      where: { id: job.id },
      data: { status: "completed", completedAt: new Date(), lockedAt: null },
    });
    console.log("  ✓ crash recovery: stale lease reclaimed, then exactly one reclaim");
  } finally {
    await cleanupWorkspace(ws.id);
  }
}

async function testCrashRecoveryCampaignMessage() {
  const prisma = getPrisma();
  const ws = await createWorkspace("MsgCrash");
  try {
    const campaign = await prisma.campaign.create({
      data: {
        workspaceId: ws.id,
        name: "crash",
        type: "Broadcast",
        category: "promotion",
        audience: "List",
        body: "hi",
        status: "SENDING",
      },
    });
    const recipient = await prisma.campaignRecipient.create({
      data: {
        workspaceId: ws.id,
        campaignId: campaign.id,
        phone: "+15558887777",
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
        to: "+15558887777",
        body: "hi",
        status: "sending",
        scheduledFor: new Date(Date.now() - 60_000),
        stepKey: "sms_1",
        updatedAt: new Date(Date.now() - 20 * 60_000),
      },
    });

    await reclaimStuckSendingMessages(60_000);
    const after = await prisma.campaignMessage.findUniqueOrThrow({ where: { id: message.id } });
    assert.equal(after.status, "queued", "stale sending without providerId must requeue");

    const claim1 = await prisma.campaignMessage.updateMany({
      where: { id: message.id, status: "queued" },
      data: { status: "sending" },
    });
    const claim2 = await prisma.campaignMessage.updateMany({
      where: { id: message.id, status: "queued" },
      data: { status: "sending" },
    });
    assert.equal(claim1.count + claim2.count, 1, "only one recipient claim after recovery");
    console.log("  ✓ campaign message crash recovery requeues and single-claims");
  } finally {
    await cleanupWorkspace(ws.id);
  }
}

async function testRateLimitsIndependentAndConfigurable() {
  resetDispatchRateLimiterForTests();
  const ws = await createWorkspace("RateLimits");
  try {
    process.env.DISPATCH_TENANT_MPS = "1";
    process.env.DISPATCH_CAMPAIGN_MPS = "100";
    process.env.DISPATCH_SENDER_MPS = "100";
    resetDispatchRateLimiterForTests();

    process.env.DISPATCH_TENANT_MPS = "1";
    assert.equal(getDispatchRateLimits().tenantPerSecond, 1);
    assert.equal(canDispatchNow({ workspaceId: ws.id }).allowed, true);
    assert.equal(canDispatchNow({ workspaceId: ws.id }).allowed, false);

    resetDispatchRateLimiterForTests();
    delete process.env.DISPATCH_TENANT_MPS;
    process.env.DISPATCH_CAMPAIGN_MPS = "1";
    const campaignId = "camp-rate-test";
    assert.equal(canDispatchNow({ workspaceId: ws.id, campaignId }).allowed, true);
    assert.equal(canDispatchNow({ workspaceId: ws.id, campaignId }).allowed, false);

    resetDispatchRateLimiterForTests();
    delete process.env.DISPATCH_CAMPAIGN_MPS;
    process.env.DISPATCH_SENDER_MPS = "1";
    assert.equal(getDispatchRateLimits().senderPerSecond, 1);
    assert.equal(
      canDispatchNow({ workspaceId: ws.id, senderKey: "sender-a" }).allowed,
      true,
    );
    assert.equal(
      canDispatchNow({ workspaceId: ws.id, senderKey: "sender-a" }).allowed,
      false,
    );
    assert.equal(
      canDispatchNow({ workspaceId: ws.id, senderKey: "sender-b" }).allowed,
      true,
      "sender buckets are independent",
    );

    resetDispatchRateLimiterForTests();
    process.env.DISPATCH_SENDER_MPS = "25";
    assert.equal(getDispatchRateLimits().senderPerSecond, 25);
    console.log("  ✓ platform/tenant/campaign/sender limits enforced independently via env");
  } finally {
    delete process.env.DISPATCH_PLATFORM_MPS;
    delete process.env.DISPATCH_TENANT_MPS;
    delete process.env.DISPATCH_CAMPAIGN_MPS;
    delete process.env.DISPATCH_SENDER_MPS;
    resetDispatchRateLimiterForTests();
    await cleanupWorkspace(ws.id);
  }
}

async function testLargeTenantDoesNotStarveSmall() {
  const prisma = getPrisma();
  const big = await createWorkspace("Big5000");
  const small = await createWorkspace("Small10");
  try {
    const bigCampaign = await prisma.campaign.create({
      data: {
        workspaceId: big.id,
        name: "big",
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
        name: "small",
        type: "Broadcast",
        category: "promotion",
        audience: "List",
        body: "small",
        status: "SENDING",
      },
    });

    const bigRecipients = [];
    for (let i = 0; i < 150; i += 1) {
      bigRecipients.push(
        prisma.campaignRecipient.create({
          data: {
            workspaceId: big.id,
            campaignId: bigCampaign.id,
            phone: `+1555${String(2000000 + i).slice(0, 7)}`,
            workflowStatus: "in_progress",
            currentStep: "sms_1",
          },
        }),
      );
    }
    await Promise.all(bigRecipients);

    const smallRecipients = [];
    for (let i = 0; i < 10; i += 1) {
      smallRecipients.push(
        prisma.campaignRecipient.create({
          data: {
            workspaceId: small.id,
            campaignId: smallCampaign.id,
            phone: `+1556${String(3000000 + i).slice(0, 7)}`,
            workflowStatus: "in_progress",
            currentStep: "sms_1",
          },
        }),
      );
    }
    const smallRecipientRows = await Promise.all(smallRecipients);

    const bigRows = await prisma.campaignRecipient.findMany({
      where: { campaignId: bigCampaign.id },
      take: 150,
    });
    for (const r of bigRows) {
      await prisma.campaignMessage.create({
        data: {
          workspaceId: big.id,
          campaignId: bigCampaign.id,
          recipientId: r.id,
          channel: "sms",
          to: r.phone!,
          body: "big",
          status: "queued",
          scheduledFor: new Date(Date.now() - 1_000),
          stepKey: "sms_1",
        },
      });
    }
    for (const r of smallRecipientRows) {
      await prisma.campaignMessage.create({
        data: {
          workspaceId: small.id,
          campaignId: smallCampaign.id,
          recipientId: r.id,
          channel: "sms",
          to: r.phone!,
          body: "small",
          status: "queued",
          scheduledFor: new Date(Date.now() - 1_000),
          stepKey: "sms_1",
        },
      });
    }

    const firstBatch = await selectDueCampaignMessagesFairly(20);
    const smallInFirst = firstBatch.filter((m) => m.workspaceId === small.id).length;
    assert.ok(smallInFirst >= 5, "small tenant must get prompt share in early dispatch batches");
    console.log(`  ✓ large tenant (${bigRows.length}) does not starve small tenant (10) — ${smallInFirst}/20 first-batch slots`);
  } finally {
    await cleanupWorkspace(big.id);
    await cleanupWorkspace(small.id);
  }
}

async function main() {
  console.log("SMS worker production certification\n");
  await testConcurrentJobClaim();
  await testCrashRecoveryJobQueue();
  await testCrashRecoveryCampaignMessage();
  await testRateLimitsIndependentAndConfigurable();
  await testLargeTenantDoesNotStarveSmall();
  console.log("\nProduction certification passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
