import type { QueueJobRecord } from "@/lib/queue/types";

/**
 * Only reuse jobs that are still live work. Canceled / failed / enqueue_failed
 * must create a new ledger row (or go through explicit admin retry).
 */
export function canReuseExistingJob(job: QueueJobRecord): boolean {
  if (job.status === "pending" || job.status === "running") {
    // Only fully handed-off jobs — never reuse enqueue_failed / half-created rows.
    return job.enqueueState === "enqueued";
  }
  return false;
}
