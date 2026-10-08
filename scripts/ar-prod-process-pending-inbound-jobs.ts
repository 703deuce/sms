/**
 * Ops: drain pending `ar_process_inbound_sms` / `ar_send_customer_sms` rows (DB mode or when BullMQ consumer missing).
 * Run in production web or SMS worker container:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-prod-process-pending-inbound-jobs.ts
 *
 * From Cloud Agent VM (hydrates prod env from Coolify web container):
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-prod-process-pending-inbound-jobs.ts
 */
import { execFileSync } from "node:child_process";
import { hydrateProdTestEnvFromCoolify } from "./cloud-agent/hydrate-prod-test-env";
import { claimDueJobs, completeJob, failJob } from "@/lib/messaging/enqueue-advance";
import { handleJob } from "@/lib/jobs/job-handlers";
import { AR_JOB_TYPES } from "@/lib/jobs/job-priority";
import { AR_QUEUE_NAME } from "@/lib/appointment-reminders/messaging/constants";
import { JobDeferredError, JobFailedError } from "@/lib/messaging/types";

function hydrateProdEnvVars(names: string[]): void {
  const missing = names.filter((n) => !process.env[n]?.trim());
  if (!missing.length) return;
  const remote = [
    "set -euo pipefail",
    "cid=$(docker ps --filter name=ds8s3hjin60qs6g7s0iqkixs --format '{{.ID}}' | head -1)",
    'if [ -z "$cid" ]; then exit 2; fi',
    ...missing.map(
      (v) =>
        `val=$(docker exec "$cid" printenv ${v} 2>/dev/null || true); if [ -n "$val" ]; then printf '%s=%s\\n' '${v}' "$val"; fi`,
    ),
  ].join("; ");
  try {
    const out = execFileSync(
      "ssh",
      ["-o", "BatchMode=yes", "-o", "ConnectTimeout=20", "coolify-server", "bash", "-lc", remote],
      { encoding: "utf8", maxBuffer: 128_000 },
    );
    for (const line of out.split("\n")) {
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq);
      const value = line.slice(eq + 1);
      if (value.trim() && missing.includes(key)) process.env[key] = value;
    }
  } catch {
    // optional when already in production container
  }
}

async function main() {
  process.env.DISABLE_INPROCESS_WORKER = "1";
  process.env.QUEUE_DRIVER = process.env.QUEUE_DRIVER || "db";
  hydrateProdTestEnvFromCoolify();
  hydrateProdEnvVars([
    "DATABASE_URL",
    "TELNYX_API_KEY",
    "OPENAI_API_KEY",
    "MICROSOFT_CLIENT_ID",
    "MICROSOFT_CLIENT_SECRET",
    "INTEGRATION_SECRET_KEY",
  ]);

  let processed = 0;
  for (let round = 0; round < 20; round += 1) {
    const claimed = await claimDueJobs(10, {
      jobTypes: [...AR_JOB_TYPES],
      queueNames: [AR_QUEUE_NAME],
    });
    if (!claimed.length) break;
    for (const job of claimed) {
      try {
        await handleJob(job.jobType, (job.payload || {}) as Record<string, unknown>);
        await completeJob(job.id);
        console.log("ok", job.jobType, job.id);
        processed += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof JobFailedError) {
          await failJob(job.id, message, undefined, undefined, true);
        } else {
          const deferMs = err instanceof JobDeferredError ? err.deferMs : 15_000;
          const soft = err instanceof JobDeferredError ? err.soft : false;
          await failJob(job.id, message, deferMs, soft);
        }
        console.error("fail", job.jobType, job.id, message);
      }
    }
  }
  console.log(JSON.stringify({ processed }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
