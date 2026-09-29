#!/usr/bin/env npx tsx
/**
 * Isolated proof: Postgres jobQueue row survives Redis loss → outbox republish → completion.
 * Uses disposable smoke job only. Requires DATABASE_URL + REDIS_URL.
 */
import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { enqueueBullmq, syncDbOutboxToBullmq } from "@/lib/jobs/bullmq";
import { MCTB_QUEUE_NAME } from "@/lib/mctb/messaging/inbound-sms-ingress";
import { JOB_PRIORITY_MCTB_INBOUND_SMS } from "@/lib/jobs/job-priority";

const POLL_MS = 1500;
const TIMEOUT_MS = 120_000;

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const prisma = getPrisma();
  const stamp = Date.now();
  const key = `mctb-outbox-rebuild-smoke:${stamp}`;
  const row = await prisma.jobQueue.create({
    data: {
      jobType: "mctb_worker_smoke",
      queueName: MCTB_QUEUE_NAME,
      priority: JOB_PRIORITY_MCTB_INBOUND_SMS,
      maxAttempts: 3,
      idempotencyKey: key,
      payload: { purpose: "outbox_redis_rebuild_smoke", issuedAt: new Date().toISOString() },
      status: "pending",
    },
  });

  await enqueueBullmq(MCTB_QUEUE_NAME, "mctb_worker_smoke", row.payload as object, {
    jobId: key,
  });

  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) throw new Error("REDIS_URL required");
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const bullKey = `bull:${MCTB_QUEUE_NAME}:${key}`;
  await redis.del(bullKey).catch(() => undefined);
  await redis.del(`bull:${MCTB_QUEUE_NAME}:id`).catch(() => undefined);

  const sync = await syncDbOutboxToBullmq(25);

  const started = Date.now();
  let finalStatus = "unknown";
  while (Date.now() - started < TIMEOUT_MS) {
    const updated = await prisma.jobQueue.findUnique({ where: { id: row.id } });
    finalStatus = updated?.status ?? "missing";
    if (finalStatus === "completed") break;
    if (finalStatus === "failed") break;
    await sleep(POLL_MS);
  }

  await redis.quit();
  await prisma.jobQueue.delete({ where: { id: row.id } }).catch(() => undefined);

  const pass = finalStatus === "completed";
  console.log(
    JSON.stringify(
      {
        event: "postgres_outbox_redis_rebuild_smoke",
        pass,
        finalStatus,
        sync,
        note: "Simulated Redis job key removal; outbox sync must republish",
      },
      null,
      2,
    ),
  );
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
