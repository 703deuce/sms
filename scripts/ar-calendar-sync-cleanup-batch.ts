/**
 * Resumable calendar_connection_sync cleanup for approved disposable connection IDs.
 * Default: DRY_RUN=1 (no writes). Requires DISPOSABLE_CONNECTION_IDS_FILE JSON array.
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   DRY_RUN=1 \
 *   DISPOSABLE_CONNECTION_IDS_FILE=/path/disposable-connection-ids.json \
 *   BATCH_SIZE=500 \
 *   npx tsx scripts/ar-calendar-sync-cleanup-batch.ts
 */
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { getPrisma } from "../src/lib/db";

const JOB = "calendar_connection_sync";
const dryRun = process.env.DRY_RUN !== "0";
const batchSize = Math.min(5000, Math.max(50, Number(process.env.BATCH_SIZE || 500)));
const idsFile = process.env.DISPOSABLE_CONNECTION_IDS_FILE;
const logPath = process.env.CLEANUP_BATCH_LOG || "/tmp/calendar-cleanup-batch.log";
const checkpointPath = process.env.CLEANUP_CHECKPOINT || "/tmp/calendar-cleanup-checkpoint.json";

function log(line: string) {
  const row = `${new Date().toISOString()} ${line}\n`;
  appendFileSync(logPath, row);
  console.log(line);
}

async function main() {
  if (!idsFile || !existsSync(idsFile)) {
    throw new Error("DISPOSABLE_CONNECTION_IDS_FILE required (JSON array of connection ids)");
  }
  const disposableIds = new Set(JSON.parse(readFileSync(idsFile, "utf8")) as string[]);
  if (!disposableIds.size) throw new Error("empty disposable id list");

  let lastJobId = "";
  if (existsSync(checkpointPath)) {
    try {
      lastJobId = JSON.parse(readFileSync(checkpointPath, "utf8")).lastJobId ?? "";
    } catch {
      lastJobId = "";
    }
  }

  const prisma = getPrisma();
  let processed = 0;
  let matched = 0;
  let canceled = 0;

  while (processed < batchSize) {
    const take = Math.min(200, batchSize - processed);
    const jobs = await prisma.jobQueue.findMany({
      where: {
        jobType: JOB,
        status: { in: ["pending", "deferred"] },
        ...(lastJobId ? { id: { gt: lastJobId } } : {}),
      },
      orderBy: { id: "asc" },
      take,
      select: { id: true, payload: true, idempotencyKey: true, queueName: true },
    });
    if (!jobs.length) break;

    for (const job of jobs) {
      processed += 1;
      lastJobId = job.id;
      const connectionId = (job.payload as { connectionId?: string })?.connectionId ?? "";
      if (!disposableIds.has(connectionId)) continue;
      matched += 1;
      if (!dryRun) {
        await prisma.jobQueue.update({
          where: { id: job.id },
          data: {
            status: "failed",
            lastError: "admin_cleanup_disposable_test_sync",
            completedAt: new Date(),
            lockedAt: null,
          },
        });
        if (process.env.QUEUE_DRIVER === "bullmq" && job.idempotencyKey) {
          try {
            const { removeBullmqJobByIdempotencyKey } = await import(
              "@/lib/jobs/bullmq-cleanup"
            );
            await removeBullmqJobByIdempotencyKey(job.queueName || "default", job.idempotencyKey);
          } catch (e) {
            log(`bullmq_remove_skipped job=${job.id} ${e instanceof Error ? e.message : e}`);
          }
        }
      }
      canceled += 1;
    }

    if (jobs.length < take) break;
  }

  if (!dryRun) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(checkpointPath, JSON.stringify({ lastJobId, at: new Date().toISOString() }));
  }

  log(
    JSON.stringify({
      dryRun,
      processed,
      matchedDisposable: matched,
      canceledOrWouldCancel: canceled,
      lastJobId,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
