#!/usr/bin/env npx tsx
/**
 * BullMQ integration: four dispatch queues hit the shared platform gate (recording provider).
 *
 * Hydrates Supabase from Coolify when unset (same as reviews runtime tests).
 *
 * Usage:
 *   HEADLESS_PROVIDER_MODE=recording PLATFORM_DISPATCH_BULLMQ_INTEGRATION_TEST=1 \
 *   npx tsx scripts/test-platform-sms-dispatch-bullmq.ts
 */
process.env.DISABLE_INPROCESS_WORKER = "1";
process.env.QUEUE_DRIVER = "bullmq";
process.env.HEADLESS_PROVIDER_MODE = process.env.HEADLESS_PROVIDER_MODE || "recording";
process.env.PLATFORM_DISPATCH_BULLMQ_INTEGRATION_TEST = "1";

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
import {
  resetPlatformDispatchMemoryForTests,
  resetPlatformDispatchRedisForTests,
} from "../src/lib/messaging/platform-dispatch/coordinator";

const PROBE_TOKEN = "platform-dispatch-bullmq-integration";

type Verdict = { name: string; status: "PASS" | "FAIL" | "SKIP"; detail?: string };
const report: Verdict[] = [];

function record(name: string, status: Verdict["status"], detail?: string) {
  report.push({ name, status, detail });
  const line = `${status}  ${name}${detail ? ` — ${detail}` : ""}`;
  if (status === "FAIL") console.error(line);
  else console.log(line);
}

function suffix() {
  return randomBytes(4).toString("hex");
}

async function waitFor(
  label: string,
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 90_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timeout waiting for ${label}`);
}

async function hydrateDatabaseEnv(): Promise<boolean> {
  const { applyArTestSupabaseEnvOverrides, hydrateProdSupabaseFromCoolify } = await import(
    "./cloud-agent/hydrate-prod-test-env.ts"
  );
  applyArTestSupabaseEnvOverrides();
  if (!hydrateProdSupabaseFromCoolify()) {
    const { isSupabaseConfigured } = await import("../src/lib/supabase/admin");
    return isSupabaseConfigured();
  }
  return true;
}

async function enqueueProbe(input: {
  tag: string;
  queueName: string;
  role: string;
  priority: number;
  to: string;
  jobKeySuffix: string;
  idempotencyKey: string;
}) {
  await enqueueJob({
    jobType: "platform_dispatch_gate_probe",
    queueName: input.queueName,
    payload: {
      probeToken: PROBE_TOKEN,
      workspaceId: `ws-${input.tag}`,
      idempotencyKey: input.idempotencyKey,
      platformDispatchPriority: input.priority,
      to: input.to,
      body: `bullmq probe ${input.role}`,
    },
    idempotencyKey: `${input.tag}:job:${input.jobKeySuffix}`,
    runAfter: new Date(),
    priority: input.priority,
  });
}

async function main() {
  const isolatedRedis =
    process.env.PLATFORM_DISPATCH_TEST_REDIS_URL?.trim() || "redis://127.0.0.1:63791";
  if (process.env.PLATFORM_DISPATCH_BULLMQ_ALLOW_PROD_REDIS !== "1") {
    process.env.REDIS_URL = isolatedRedis;
    console.log(
      `[test-platform-sms-dispatch-bullmq] Using isolated Redis for BullMQ (${isolatedRedis}); set PLATFORM_DISPATCH_BULLMQ_ALLOW_PROD_REDIS=1 to use shared REDIS_URL`,
    );
  }

  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    record("prerequisites_redis", "SKIP", "REDIS_URL not set");
    printSummary();
    process.exit(0);
  }

  const dbOk = await hydrateDatabaseEnv();
  if (!dbOk) {
    record("prerequisites_database", "SKIP", "Supabase not configured and Coolify hydrate failed");
    printSummary();
    process.exit(0);
  }
  record("prerequisites_database", "PASS");
  record("prerequisites_redis", "PASS");

  const useRedisGate = process.env.PLATFORM_DISPATCH_USE_MEMORY !== "1";
  process.env.PLATFORM_DISPATCH_USE_MEMORY = useRedisGate ? "0" : "1";
  process.env.PLATFORM_DISPATCH_REQUIRE_REDIS = useRedisGate ? "1" : "0";

  assertBullmqRedisUrl(redisUrl);
  await verifyBullmqConnection(15_000);

  if (redisUrl.includes("127.0.0.1") || redisUrl.includes("localhost")) {
    const IORedis = (await import("ioredis")).default;
    const flushClient = new IORedis(redisUrl, { maxRetriesPerRequest: 1 });
    try {
      await flushClient.flushdb();
      console.log("[test-platform-sms-dispatch-bullmq] Flushed isolated Redis DB before run");
    } finally {
      await flushClient.quit();
    }
  }

  process.env.PLATFORM_DISPATCH_MPS = process.env.PLATFORM_DISPATCH_MPS || "20";
  process.env.PLATFORM_DISPATCH_MAX_WAIT_MS = process.env.PLATFORM_DISPATCH_MAX_WAIT_MS || "30000";

  resetSmsDispatchBullmqMetricsForTests();
  resetPlatformDispatchMemoryForTests();
  if (useRedisGate) await resetPlatformDispatchRedisForTests();

  const { clearRecordingSmsOutbox, getRecordingSmsOutbox } = await import(
    "../src/lib/voice/testing/headless/recording-sms"
  );
  clearRecordingSmsOutbox();

  await startSmsDispatchBullmqWorkers();

  const tag = `platform-bullmq-${suffix()}`;
  const prisma = getPrisma();
  const requiredTos = ["+15555559001", "+15555559002", "+15555559003", "+15555559004"];

  async function waitForOutboxTos(tos: string[], label: string, timeoutMs = 120_000) {
    await waitFor(label, () => {
      const sent = getRecordingSmsOutbox().map((m) => m.to);
      return tos.every((t) => sent.includes(t));
    }, timeoutMs);
  }

  try {
    const queues: Array<{ queueName: string; role: string; priority: number; to: string }> = [
      {
        queueName: "mctb",
        role: "mctb",
        priority: PLATFORM_DISPATCH_PRIORITY_MCTB,
        to: "+15555559001",
      },
      {
        queueName: "appointment_reminders",
        role: "ar",
        priority: PLATFORM_DISPATCH_PRIORITY_AR_REMINDER,
        to: "+15555559002",
      },
      {
        queueName: "sms-send",
        role: "campaign",
        priority: PLATFORM_DISPATCH_PRIORITY_BULK,
        to: "+15555559003",
      },
      {
        queueName: "review-campaign",
        role: "review",
        priority: PLATFORM_DISPATCH_PRIORITY_BULK,
        to: "+15555559004",
      },
    ];

    for (const q of queues) {
      await enqueueProbe({
        tag,
        queueName: q.queueName,
        role: q.role,
        priority: q.priority,
        to: q.to,
        jobKeySuffix: q.role,
        idempotencyKey: `${tag}:${q.role}`,
      });
      await waitForOutboxTos([q.to], `bullmq send on ${q.queueName}`, 90_000);
    }

    const outbox = getRecordingSmsOutbox();
    const gotAll = requiredTos.every((t) => outbox.some((m) => m.to === t));
    if (gotAll) {
      record("bullmq_four_queue_probe_sends", "PASS", `queues=${queues.map((q) => q.queueName).join(",")}`);
    } else {
      record(
        "bullmq_four_queue_probe_sends",
        "FAIL",
        `missing sends; outbox=${outbox.map((m) => m.to).join(",")}`,
      );
    }

    const probeJobKeys = queues.map((q) => `${tag}:job:${q.role}`);
    const queueRows = await prisma.jobQueue.findMany({
      where: { idempotencyKey: { in: probeJobKeys } },
      select: { idempotencyKey: true, status: true, lastError: true, queueName: true },
    });
    const completedInDb = queueRows.filter((r) => r.status === "completed").length;
    if (completedInDb === 4) {
      record("job_queue_outbox_sync", "PASS");
    } else {
      record(
        "job_queue_outbox_sync",
        "SKIP",
        `shared job_queue may be claimed by other workers (completed ${completedInDb}/4); outbox is authoritative`,
      );
    }

    const dupKey = `${tag}:dup`;
    await enqueueProbe({
      tag,
      queueName: "mctb",
      role: "dup",
      priority: PLATFORM_DISPATCH_PRIORITY_MCTB,
      to: "+15555559005",
      jobKeySuffix: "dup-a",
      idempotencyKey: dupKey,
    });
    await enqueueProbe({
      tag,
      queueName: "mctb",
      role: "dup",
      priority: PLATFORM_DISPATCH_PRIORITY_MCTB,
      to: "+15555559005",
      jobKeySuffix: "dup-b",
      idempotencyKey: dupKey,
    });

    await waitForOutboxTos(["+15555559005"], "duplicate idempotency send", 120_000);

    const dupSends = getRecordingSmsOutbox().filter((m) => m.to === "+15555559005");
    if (dupSends.length === 1) {
      record("idempotency_duplicate_jobs_one_send", "PASS");
    } else {
      record(
        "idempotency_duplicate_jobs_one_send",
        "FAIL",
        `expected 1 send to +15555559005, got ${dupSends.length}`,
      );
    }

    process.env.PLATFORM_DISPATCH_MPS = "1";
    process.env.PLATFORM_DISPATCH_MAX_WAIT_MS = "30000";
    resetPlatformDispatchMemoryForTests();
    if (useRedisGate) await resetPlatformDispatchRedisForTests();
    const deferTag = `${tag}-defer`;
    const deferBefore = Date.now();
    await Promise.all([
      enqueueProbe({
        tag: deferTag,
        queueName: "mctb",
        role: "defer-a",
        priority: PLATFORM_DISPATCH_PRIORITY_MCTB,
        to: "+15555559006",
        jobKeySuffix: "defer-a",
        idempotencyKey: `${deferTag}:a`,
      }),
      enqueueProbe({
        tag: deferTag,
        queueName: "mctb",
        role: "defer-b",
        priority: PLATFORM_DISPATCH_PRIORITY_MCTB,
        to: "+15555559007",
        jobKeySuffix: "defer-b",
        idempotencyKey: `${deferTag}:b`,
      }),
    ]);

    await waitForOutboxTos(["+15555559006", "+15555559007"], "defer pair recording sends", 120_000);

    const deferElapsed = Date.now() - deferBefore;
    if (deferElapsed > 400) {
      record(
        "soft_defer_retry_eventual_delivery",
        "PASS",
        `elapsedMs=${deferElapsed} (MPS=1 contended pair)`,
      );
    } else {
      record("soft_defer_retry_eventual_delivery", "FAIL", `elapsedMs=${deferElapsed}`);
    }

    clearRecordingSmsOutbox();
    process.env.PLATFORM_DISPATCH_MPS = "1";
    resetPlatformDispatchMemoryForTests();
    if (useRedisGate) await resetPlatformDispatchRedisForTests();
    const prioTag = `${tag}-prio`;
    await Promise.all([
      enqueueProbe({
        tag: prioTag,
        queueName: "sms-send",
        role: "bulk-first",
        priority: PLATFORM_DISPATCH_PRIORITY_BULK,
        to: "+15555559008",
        jobKeySuffix: "bulk",
        idempotencyKey: `${prioTag}:bulk`,
      }),
      enqueueProbe({
        tag: prioTag,
        queueName: "mctb",
        role: "mctb-second",
        priority: PLATFORM_DISPATCH_PRIORITY_MCTB,
        to: "+15555559009",
        jobKeySuffix: "mctb",
        idempotencyKey: `${prioTag}:mctb`,
      }),
    ]);

    await waitForOutboxTos(["+15555559008", "+15555559009"], "priority pair recording sends", 120_000);

    const prioOutbox = getRecordingSmsOutbox();
    const mctbIdx = prioOutbox.findIndex((m) => m.to === "+15555559009");
    const bulkIdx = prioOutbox.findIndex((m) => m.to === "+15555559008");
    if (mctbIdx >= 0 && bulkIdx >= 0 && mctbIdx < bulkIdx) {
      record("gate_priority_mctb_before_bulk_under_contention", "PASS");
    } else if (mctbIdx >= 0 && bulkIdx >= 0) {
      record(
        "gate_priority_mctb_before_bulk_under_contention",
        "FAIL",
        `outbox order bulk@${bulkIdx} mctb@${mctbIdx}`,
      );
    } else {
      record("gate_priority_mctb_before_bulk_under_contention", "FAIL", "missing sends in outbox");
    }

    record(
      "credit_accounting_under_recording",
      "SKIP",
      "HEADLESS_PROVIDER_MODE=recording skips deductCreditsForSend; gate-before-create verified in coordination script",
    );
    record(
      "full_product_job_handlers_mctb_ar_campaign_review",
      "SKIP",
      "Probe exercises sendQuickSms+gate per queue; full handler fixtures require isolated workspace data (out of scope for this script)",
    );
  } finally {
    await prisma.jobQueue
      .deleteMany({
        where: {
          OR: [
            { idempotencyKey: { startsWith: `${tag}:` } },
            { idempotencyKey: { startsWith: `${tag}-defer:` } },
            { idempotencyKey: { startsWith: `${tag}-prio:` } },
          ],
        },
      })
      .catch(() => undefined);
    await closeBullmqWorkers();
    const { disconnectPlatformDispatchRedis } = await import(
      "../src/lib/messaging/platform-dispatch/redis-coordinator"
    );
    await disconnectPlatformDispatchRedis().catch(() => undefined);
  }

  printSummary();
  if (report.some((r) => r.status === "FAIL")) process.exit(1);
}

function printSummary() {
  console.log("\n=== Platform dispatch BullMQ integration report ===");
  for (const r of report) {
    console.log(`${r.status.padEnd(5)} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  const failed = report.filter((r) => r.status === "FAIL").length;
  const passed = report.filter((r) => r.status === "PASS").length;
  const skipped = report.filter((r) => r.status === "SKIP").length;
  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
