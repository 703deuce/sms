#!/usr/bin/env npx tsx
/**
 * BullMQ integration: four dispatch queues hit the shared platform gate (recording provider).
 *
 * Requires REDIS_URL + DATABASE_URL (job_queue outbox). Skips when REDIS_URL unset.
 *
 * Usage:
 *   HEADLESS_PROVIDER_MODE=recording PLATFORM_DISPATCH_USE_MEMORY=1 \
 *   PLATFORM_DISPATCH_BULLMQ_INTEGRATION_TEST=1 \
 *   npx tsx scripts/test-platform-sms-dispatch-bullmq.ts
 */
process.env.DISABLE_INPROCESS_WORKER = "1";
process.env.QUEUE_DRIVER = "bullmq";
process.env.HEADLESS_PROVIDER_MODE = process.env.HEADLESS_PROVIDER_MODE || "recording";
process.env.PLATFORM_DISPATCH_BULLMQ_INTEGRATION_TEST = "1";
process.env.PLATFORM_DISPATCH_USE_MEMORY =
  process.env.PLATFORM_DISPATCH_USE_MEMORY || "1";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { getPrisma } from "../src/lib/db";
import { enqueueJob } from "../src/lib/messaging/enqueue-advance";
import {
  assertBullmqRedisUrl,
  closeBullmqWorkers,
  resetSmsDispatchBullmqMetricsForTests,
  startSmsDispatchBullmqWorkers,
  verifyBullmqConnection,
} from "../src/lib/jobs/bullmq";
import {
  PLATFORM_DISPATCH_PRIORITY_AR_REMINDER,
  PLATFORM_DISPATCH_PRIORITY_BULK,
  PLATFORM_DISPATCH_PRIORITY_MCTB,
} from "../src/lib/messaging/platform-dispatch/priority";
import { resetPlatformDispatchMemoryForTests } from "../src/lib/messaging/platform-dispatch/coordinator";

const PROBE_TOKEN = "platform-dispatch-bullmq-integration";

function suffix() {
  return randomBytes(4).toString("hex");
}

async function waitFor(
  label: string,
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 60_000,
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
    console.log("SKIP test-platform-sms-dispatch-bullmq: REDIS_URL not set");
    return;
  }

  assertBullmqRedisUrl(redisUrl);
  await verifyBullmqConnection(15_000);

  resetSmsDispatchBullmqMetricsForTests();
  resetPlatformDispatchMemoryForTests();
  const { clearRecordingSmsOutbox, getRecordingSmsOutbox } = await import(
    "../src/lib/voice/testing/headless/recording-sms"
  );
  clearRecordingSmsOutbox();

  await startSmsDispatchBullmqWorkers();

  const tag = `platform-bullmq-${suffix()}`;
  const queues: Array<{ queueName: string; role: string; priority: number; to: string }> = [
    { queueName: "mctb", role: "mctb", priority: PLATFORM_DISPATCH_PRIORITY_MCTB, to: "+15555559001" },
    {
      queueName: "appointment_reminders",
      role: "ar",
      priority: PLATFORM_DISPATCH_PRIORITY_AR_REMINDER,
      to: "+15555559002",
    },
    { queueName: "sms-send", role: "campaign", priority: PLATFORM_DISPATCH_PRIORITY_BULK, to: "+15555559003" },
    {
      queueName: "review-campaign",
      role: "review",
      priority: PLATFORM_DISPATCH_PRIORITY_BULK,
      to: "+15555559004",
    },
  ];

  for (const q of queues) {
    await enqueueJob({
      jobType: "platform_dispatch_gate_probe",
      queueName: q.queueName,
      payload: {
        probeToken: PROBE_TOKEN,
        workspaceId: `ws-${tag}`,
        idempotencyKey: `${tag}:${q.role}`,
        platformDispatchPriority: q.priority,
        to: q.to,
        body: `bullmq probe ${q.role}`,
      },
      idempotencyKey: `${tag}:job:${q.role}`,
      runAfter: new Date(),
      priority: q.priority,
    });
  }

  await waitFor("four probe jobs completed", async () => {
    const prisma = getPrisma();
    const rows = await prisma.jobQueue.findMany({
      where: { idempotencyKey: { startsWith: `${tag}:job:` } },
      select: { status: true },
    });
    return rows.length === 4 && rows.every((r) => r.status === "completed");
  });

  const outbox = getRecordingSmsOutbox();
  assert.equal(outbox.length, 4, `expected 4 recording sends, got ${outbox.length}`);

  const dupKey = `${tag}:dup`;
  await enqueueJob({
    jobType: "platform_dispatch_gate_probe",
    queueName: "mctb",
    payload: {
      probeToken: PROBE_TOKEN,
      workspaceId: `ws-${tag}`,
      idempotencyKey: dupKey,
      platformDispatchPriority: PLATFORM_DISPATCH_PRIORITY_MCTB,
      to: "+15555559005",
      body: "dup probe",
    },
    idempotencyKey: `${tag}:job:dup-a`,
    runAfter: new Date(),
  });
  await enqueueJob({
    jobType: "platform_dispatch_gate_probe",
    queueName: "mctb",
    payload: {
      probeToken: PROBE_TOKEN,
      workspaceId: `ws-${tag}`,
      idempotencyKey: dupKey,
      platformDispatchPriority: PLATFORM_DISPATCH_PRIORITY_MCTB,
      to: "+15555559005",
      body: "dup probe",
    },
    idempotencyKey: `${tag}:job:dup-b`,
    runAfter: new Date(),
  });

  await waitFor("duplicate idempotency probe completed", async () => {
    const prisma = getPrisma();
    const row = await prisma.jobQueue.findFirst({
      where: { idempotencyKey: `${tag}:job:dup-a` },
      select: { status: true },
    });
    return row?.status === "completed";
  });
  await waitFor("second duplicate job row", async () => {
    const prisma = getPrisma();
    const row = await prisma.jobQueue.findFirst({
      where: { idempotencyKey: `${tag}:job:dup-b` },
      select: { status: true },
    });
    return row?.status === "completed";
  });

  const dupSends = getRecordingSmsOutbox().filter((m) => m.to === "+15555559005");
  assert.equal(dupSends.length, 1, "idempotencyKey should dedupe recording sends");

  await getPrisma().jobQueue.deleteMany({
    where: { idempotencyKey: { startsWith: `${tag}:` } },
  });

  console.log("test-platform-sms-dispatch-bullmq: ok");
  await closeBullmqWorkers();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
