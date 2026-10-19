#!/usr/bin/env node
/**
 * Obliterate BullMQ queue keys in Transovo Redis (stale jobs after DB wipe).
 * Requires REDIS_URL (same as web/SMS worker). Does not touch Coolify Redis.
 *
 *   REDIS_URL=redis://... node scripts/operations/fresh-start-flush-bullmq-redis.mjs
 *   EXECUTE=1 REDIS_URL=... node scripts/operations/fresh-start-flush-bullmq-redis.mjs
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const EXECUTE = process.env.EXECUTE === "1";
const redisUrl = process.env.REDIS_URL?.trim();
if (!redisUrl) {
  console.error("REDIS_URL is required");
  process.exit(1);
}

const QUEUES = [
  "mctb",
  "appointment_reminders",
  "automations",
  "sms-send",
  "review-campaign",
  "voice-calls",
  "email-send",
  "campaign_send",
  "drip",
  "fax",
  "crm",
  "maintenance",
];

async function main() {
  const { Queue } = require("bullmq");
  const IORedis = require("ioredis");
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  const report = {};
  for (const name of QUEUES) {
    const queue = new Queue(name, { connection });
    try {
      const counts = await queue.getJobCounts(
        "waiting",
        "active",
        "delayed",
        "failed",
        "completed",
        "paused",
      );
      report[name] = counts;
      if (EXECUTE) {
        await queue.obliterate({ force: true });
      }
      await queue.close();
    } catch (e) {
      report[name] = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  await connection.quit();
  console.log(
    JSON.stringify({
      event: EXECUTE ? "bullmq_obliterate_complete" : "bullmq_obliterate_dry_run",
      queues: report,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
