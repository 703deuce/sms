#!/usr/bin/env npx tsx
/**
 * Multi-process Redis concurrency test for platform SMS dispatch gate.
 * Simulates separate BullMQ worker processes contending on the same platform sender.
 *
 * Requires: REDIS_URL, HEADLESS_PROVIDER_MODE=recording
 *
 * Usage:
 *   HEADLESS_PROVIDER_MODE=recording npx tsx scripts/test-platform-sms-dispatch-redis-concurrency.ts
 *   (parent orchestrator — spawns worker children)
 *
 *   npx tsx scripts/test-platform-sms-dispatch-redis-concurrency.ts --worker <payload.json>
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(import.meta.url);
const PLATFORM_FROM = process.env.PLATFORM_DISPATCH_TEST_E164?.trim() || "+15714073615";
const ROUTE = {
  sendWorkspaceId: "ws-platform-owner-redis-test",
  fromE164: PLATFORM_FROM,
  phoneNumberId: "redis-test-platform-phone",
};

type SendSpec = {
  idempotencyKey: string;
  priority: number;
  label: string;
  body: string;
  to: string;
  /** If set, send a duplicate attempt with this key after first attempt. */
  duplicateRetry?: boolean;
};

type WorkerPayload = {
  workerId: string;
  sends: SendSpec[];
  maxAttempts: number;
};

type SendOutcome = {
  idempotencyKey: string;
  label: string;
  priority: number;
  status: "sent" | "deferred" | "failed";
  attempts: number;
  firstAttemptMs: number;
  sentAtMs?: number;
  error?: string;
};

type WorkerResult = {
  workerId: string;
  outcomes: SendOutcome[];
  pid: number;
};

async function runWorker(payload: WorkerPayload): Promise<WorkerResult> {
  process.env.HEADLESS_PROVIDER_MODE = "recording";
  process.env.PLATFORM_DISPATCH_USE_MEMORY = "0";
  process.env.PLATFORM_DISPATCH_REQUIRE_REDIS = "1";

  const {
    PLATFORM_DISPATCH_PRIORITY_MCTB,
    PLATFORM_DISPATCH_PRIORITY_AR_REMINDER,
    PLATFORM_DISPATCH_PRIORITY_BULK,
  } = await import("@/lib/messaging/platform-dispatch/priority");
  const { isPlatformDispatchDeferredError } = await import(
    "@/lib/messaging/platform-dispatch/errors"
  );
  const { sendQuickSms } = await import("@/lib/sms/send-quick");

  const priorityByLabel = (label: string, explicit: number) => {
    if (explicit) return explicit;
    if (label.startsWith("mctb")) return PLATFORM_DISPATCH_PRIORITY_MCTB;
    if (label.startsWith("ar")) return PLATFORM_DISPATCH_PRIORITY_AR_REMINDER;
    return PLATFORM_DISPATCH_PRIORITY_BULK;
  };

  const outcomes: SendOutcome[] = [];
  const t0 = Date.now();

  for (const spec of payload.sends) {
    const priority = priorityByLabel(spec.label, spec.priority);
    let attempts = 0;
    let status: SendOutcome["status"] = "failed";
    let sentAtMs: number | undefined;
    let lastError: string | undefined;
    const firstAttemptMs = Date.now() - t0;

    while (attempts < payload.maxAttempts) {
      attempts += 1;
      try {
        await sendQuickSms({
          workspaceId: "ws-redis-concurrency",
          to: spec.to,
          body: spec.body,
          demoBypass: true,
          idempotencyKey: spec.idempotencyKey,
          platformDispatchPriority: priority,
          senderRoute: ROUTE,
          omitConsumerTrackingLink: true,
        });
        status = "sent";
        sentAtMs = Date.now() - t0;
        break;
      } catch (err) {
        if (isPlatformDispatchDeferredError(err)) {
          lastError = err.reason;
          if (attempts >= payload.maxAttempts) {
            status = "deferred";
            break;
          }
          await new Promise((r) => setTimeout(r, Math.min(err.deferMs, 180)));
          continue;
        }
        lastError = err instanceof Error ? err.message : String(err);
        status = "failed";
        break;
      }
    }

    outcomes.push({
      idempotencyKey: spec.idempotencyKey,
      label: spec.label,
      priority,
      status,
      attempts,
      firstAttemptMs,
      sentAtMs,
      error: lastError,
    });

    if (spec.duplicateRetry && status === "sent") {
      let dupStatus: SendOutcome["status"] = "failed";
      try {
        await sendQuickSms({
          workspaceId: "ws-redis-concurrency",
          to: spec.to,
          body: spec.body,
          demoBypass: true,
          idempotencyKey: spec.idempotencyKey,
          platformDispatchPriority: priority,
          senderRoute: ROUTE,
          omitConsumerTrackingLink: true,
        });
        dupStatus = "sent";
      } catch (err) {
        dupStatus = isPlatformDispatchDeferredError(err) ? "deferred" : "failed";
      }
      outcomes.push({
        idempotencyKey: `${spec.idempotencyKey}:dup`,
        label: `${spec.label}:duplicate_job`,
        priority,
        status: dupStatus,
        attempts: 1,
        firstAttemptMs: Date.now() - t0,
        sentAtMs: dupStatus === "sent" ? Date.now() - t0 : undefined,
      });
    }
  }

  const { disconnectPlatformDispatchRedis } = await import(
    "@/lib/messaging/platform-dispatch/redis-coordinator"
  );
  await disconnectPlatformDispatchRedis();

  return { workerId: payload.workerId, outcomes, pid: process.pid };
}

function spawnWorker(payload: WorkerPayload): Promise<WorkerResult> {
  const payloadPath = join(tmpdir(), `platform-dispatch-worker-${payload.workerId}-${Date.now()}.json`);
  writeFileSync(payloadPath, JSON.stringify(payload));

  return new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      ["tsx", SCRIPT, "--worker", payloadPath],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_OPTIONS: "--import ./scripts/preload-server-only.mjs",
          HEADLESS_PROVIDER_MODE: "recording",
          PLATFORM_DISPATCH_USE_MEMORY: "0",
          PLATFORM_DISPATCH_REQUIRE_REDIS: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += String(d);
    });
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    child.on("close", (code) => {
      try {
        unlinkSync(payloadPath);
      } catch {
        // ignore
      }
      if (code !== 0) {
        reject(new Error(`worker ${payload.workerId} exit ${code}: ${stderr || stdout}`));
        return;
      }
      const line = stdout.trim().split("\n").pop() || "";
      resolve(JSON.parse(line) as WorkerResult);
    });
  });
}

async function parentMain() {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    console.error("SKIP: REDIS_URL not set — cannot run Redis concurrency test");
    process.exit(0);
  }

  process.env.HEADLESS_PROVIDER_MODE = "recording";
  process.env.PLATFORM_DISPATCH_USE_MEMORY = "0";
  process.env.PLATFORM_DISPATCH_REQUIRE_REDIS = "1";
  process.env.PLATFORM_DISPATCH_MPS = process.env.PLATFORM_DISPATCH_MPS || "5";
  process.env.PLATFORM_DISPATCH_MAX_WAIT_MS = process.env.PLATFORM_DISPATCH_MAX_WAIT_MS || "80";

  const { resetPlatformDispatchRedisForTests } = await import(
    "@/lib/messaging/platform-dispatch/redis-coordinator"
  );
  const {
    PLATFORM_DISPATCH_PRIORITY_MCTB,
    PLATFORM_DISPATCH_PRIORITY_AR_REMINDER,
    PLATFORM_DISPATCH_PRIORITY_BULK,
  } = await import("@/lib/messaging/platform-dispatch/priority");

  await resetPlatformDispatchRedisForTests();

  const runId = Date.now().toString(36);
  const bulkSends = (worker: string, count: number, offset: number): SendSpec[] =>
    Array.from({ length: count }, (_, i) => ({
      idempotencyKey: `redis-bulk:${runId}:${worker}:${offset + i}`,
      priority: PLATFORM_DISPATCH_PRIORITY_BULK,
      label: "bulk",
      body: `campaign ${offset + i}`,
      to: `+1555555${String(1000 + offset + i).slice(-4)}`,
    }));

  const workers: WorkerPayload[] = [
    {
      workerId: "campaign-a",
      maxAttempts: 14,
      sends: bulkSends("a", 8, 0),
    },
    {
      workerId: "campaign-b",
      maxAttempts: 14,
      sends: bulkSends("b", 8, 100),
    },
    {
      workerId: "interactive",
      maxAttempts: 18,
      sends: [
        {
          idempotencyKey: `redis-mctb:${runId}`,
          priority: PLATFORM_DISPATCH_PRIORITY_MCTB,
          label: "mctb",
          body: "missed call recovery",
          to: "+15555550101",
        },
        ...Array.from({ length: 3 }, (_, i) => ({
          idempotencyKey: `redis-ar:${runId}:${i}`,
          priority: PLATFORM_DISPATCH_PRIORITY_AR_REMINDER,
          label: "ar_reminder",
          body: `reminder ${i}`,
          to: `+155555501${10 + i}`,
        })),
        {
          idempotencyKey: `redis-review:${runId}`,
          priority: PLATFORM_DISPATCH_PRIORITY_BULK,
          label: "review",
          body: "review invite",
          to: "+15555550120",
        },
        {
          idempotencyKey: `redis-idem:${runId}`,
          priority: PLATFORM_DISPATCH_PRIORITY_MCTB,
          label: "mctb_idempotency",
          body: "idempotent mctb",
          to: "+15555550199",
          duplicateRetry: true,
        },
      ],
    },
    {
      workerId: "burst-mctb",
      maxAttempts: 18,
      sends: [
        {
          idempotencyKey: `redis-mctb-late:${runId}`,
          priority: PLATFORM_DISPATCH_PRIORITY_MCTB,
          label: "mctb",
          body: "late mctb during bulk storm",
          to: "+15555550200",
        },
      ],
    },
  ];

  console.log(
    JSON.stringify({
      event: "redis_concurrency_test_start",
      mps: process.env.PLATFORM_DISPATCH_MPS,
      workers: workers.length,
      bulkMessages: 16,
      interactive: 6,
    }),
  );

  const results = await Promise.all(workers.map((w) => spawnWorker(w)));
  const allOutcomes = results.flatMap((r) => r.outcomes);

  const mctb = allOutcomes.filter((o) => o.label === "mctb" && o.status === "sent");
  assert.ok(mctb.length >= 2, "expected both MCTB sends to succeed with retries");

  const mctbLate = allOutcomes.find((o) => o.idempotencyKey.includes("mctb-late"));
  assert.equal(mctbLate?.status, "sent", "MCTB during bulk storm must eventually send");

  const bulkSent = allOutcomes.filter((o) => o.label === "bulk" && o.status === "sent");
  const bulkDeferred = allOutcomes.filter((o) => o.label === "bulk" && o.status === "deferred");
  assert.ok(bulkSent.length >= 6, "bulk should make progress under contention");
  console.log(
    JSON.stringify({
      event: "bulk_progress",
      sent: bulkSent.length,
      deferred: bulkDeferred.length,
      failed: allOutcomes.filter((o) => o.status === "failed").length,
    }),
  );

  const earliestMctb = Math.min(...mctb.map((o) => o.sentAtMs ?? Infinity));
  const bulkSentTimes = bulkSent.map((o) => o.sentAtMs ?? Infinity).sort((a, b) => a - b);
  const bulkAt5 = bulkSentTimes[4] ?? Infinity;
  assert.ok(
    earliestMctb <= bulkAt5 + 800,
    `MCTB should not trail bulk: mctb=${earliestMctb}ms bulk5=${bulkAt5}ms`,
  );

  const idemPrimary = allOutcomes.find((o) => o.idempotencyKey === `redis-idem:${runId}`);
  const idemDup = allOutcomes.find((o) => o.label === "mctb_idempotency:duplicate_job");
  assert.equal(idemPrimary?.status, "sent");
  assert.equal(idemDup?.status, "sent", "duplicate job delivery should idempotently replay");

  const arSent = allOutcomes.filter((o) => o.label === "ar_reminder" && o.status === "sent");
  assert.equal(arSent.length, 3, "all AR reminders should send");

  console.log(
    JSON.stringify({
      event: "redis_concurrency_test_pass",
      processes: results.map((r) => ({ workerId: r.workerId, pid: r.pid, sends: r.outcomes.length })),
      mctbSentAtMs: mctb.map((o) => o.sentAtMs),
    }),
  );
  const { disconnectPlatformDispatchRedis } = await import(
    "@/lib/messaging/platform-dispatch/redis-coordinator"
  );
  await disconnectPlatformDispatchRedis();

  console.log("PASS platform_dispatch_redis_multi_process_concurrency");
}

async function main() {
  const workerArg = process.argv.indexOf("--worker");
  if (workerArg >= 0) {
    const path = process.argv[workerArg + 1];
    const payload = JSON.parse(readFileSync(path, "utf8")) as WorkerPayload;
    const result = await runWorker(payload);
    console.log(JSON.stringify(result));
    return;
  }
  await parentMain();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
