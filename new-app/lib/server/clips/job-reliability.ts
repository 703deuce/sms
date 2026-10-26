/** Pure helpers for job watchdog / reaper (unit-tested). */

export const JOB_HEARTBEAT_STALE_MS = 15 * 60_000
export const JOB_MAX_ATTEMPTS_BEFORE_FAIL = 8
export const STREAMER_PROJECT_STUCK_MS = 90 * 60_000

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
