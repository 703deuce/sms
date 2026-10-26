/** Pure helpers for job watchdog / reaper (unit-tested). */

/** No heartbeat on RUNNING jobs → requeue (worker crash / deploy mid-job). */
/** Must match worker JOB_LOCK_STALE_SECONDS (3 min). */
export const JOB_HEARTBEAT_STALE_MS = 3 * 60_000
/** Non-terminal streamer project with no QUEUED/RUNNING job for this long → recovery enqueue. */
export const STREAMER_ORPHAN_PROJECT_GRACE_MS = 2 * 60_000
export const JOB_MAX_ATTEMPTS_BEFORE_FAIL = 8
/** Non-terminal project with no progress → FAILED (Retry/Cancel in UI). */
export const PROJECT_STUCK_MS = 90 * 60_000
/** @deprecated use PROJECT_STUCK_MS */
export const STREAMER_PROJECT_STUCK_MS = PROJECT_STUCK_MS

export function reaperBackoffSeconds(attempts: number): number {
  const n = Math.max(1, attempts)
  return Math.min(600, 30 * 2 ** Math.min(n - 1, 4))
}

export function shouldFailJobAfterStale(attempts: number): boolean {
  return attempts >= JOB_MAX_ATTEMPTS_BEFORE_FAIL
}

export function stalledProjectErrorMessage(status: string): string {
  const step = status.replace(/_/g, ' ').toLowerCase()
  return `Processing stalled during ${step}. Use Retry processing to resume from the last completed step.`
}
