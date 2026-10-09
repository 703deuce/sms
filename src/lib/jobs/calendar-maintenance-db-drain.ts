import "server-only";

import {
  CALENDAR_MAINTENANCE_DB_JOB_TYPES,
  type CalendarMaintenanceDbJobType,
} from "@/lib/jobs/calendar-maintenance-db-job-types";
import { claimDueJobs, completeJob, failJob } from "@/lib/messaging/enqueue-advance";
import { handleJob } from "@/lib/jobs/job-handlers";
import { JobDeferredError, JobFailedError } from "@/lib/messaging/types";

export { CALENDAR_MAINTENANCE_DB_JOB_TYPES, type CalendarMaintenanceDbJobType } from "@/lib/jobs/calendar-maintenance-db-job-types";
export { isCalendarMaintenanceDbJob } from "@/lib/jobs/calendar-maintenance-db-job-types";

/**
 * Process calendar maintenance ticks via DB claim (BullMQ mode).
 * Reconcile/renew must not depend on Redis when the maintenance BullMQ worker is degraded.
 */
export async function drainCalendarMaintenanceFromDb(limit = 5) {
  const claimed = await claimDueJobs(limit, {
    queueNames: ["maintenance"],
    jobTypes: [...CALENDAR_MAINTENANCE_DB_JOB_TYPES],
  });

  const results: Array<{ id: string; jobType: string; ok: boolean; error?: string }> = [];

  for (const job of claimed) {
    try {
      const payload = (job.payload || {}) as Record<string, unknown>;
      await handleJob(job.jobType, payload);
      await completeJob(job.id);
      results.push({ id: job.id, jobType: job.jobType, ok: true });
    } catch (err) {
      if (err instanceof JobDeferredError) {
        await failJob(job.id, err.message, err.deferMs, err.soft);
        results.push({ id: job.id, jobType: job.jobType, ok: true });
        continue;
      }
      const message = err instanceof Error ? err.message : String(err);
      const terminal = err instanceof JobFailedError && err.terminal;
      await failJob(job.id, message, undefined, undefined, terminal);
      results.push({ id: job.id, jobType: job.jobType, ok: false, error: message });
    }
  }

  return { claimed: claimed.length, results };
}
