/** Keep displayed ETA monotonic (non-increasing) while a job is in progress. */
export function clampEtaBetweenPolls(rawSec: number, previousPollSec: number | undefined): number {
  const raw = Math.max(0, Math.round(rawSec))
  if (raw <= 0) return 0
  if (previousPollSec === undefined || previousPollSec <= 0) return raw
  return Math.min(raw, previousPollSec)
}
