/**
 * Batched terminal job_queue pruning (completed / failed only).
 *
 * DRY_RUN=1 (default): report counts only.
 * EXECUTE=1: delete eligible rows.
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/operations/prune-completed-job-queue.ts
 */
import { getPrisma } from "@/lib/db";
import {
  getJobQueueHealthSnapshot,
  getJobQueueRetentionConfig,
  pruneTerminalJobQueueRows,
} from "@/lib/jobs/job-queue-lifecycle";

async function main() {
  const execute = process.env.EXECUTE === "1";
  const retention = getJobQueueRetentionConfig();
  const healthBefore = await getJobQueueHealthSnapshot();

  console.log(
    JSON.stringify(
      {
        mode: execute ? "execute" : "dry_run",
        retention,
        healthBefore,
      },
      null,
      2,
    ),
  );

  if (!execute) {
    console.log("Set EXECUTE=1 to run batched deletes.");
    return;
  }

  const result = await pruneTerminalJobQueueRows();
  const healthAfter = await getJobQueueHealthSnapshot();
  console.log(JSON.stringify({ result, healthAfter }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect().catch(() => {});
  });
