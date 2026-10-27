/** Keep displayed ETA monotonic (non-increasing) while a job is in progress. */
export function clampEtaBetweenPolls(
  rawSec: number,
  previousPollSec: number | undefined,
  stageKey?: string | null,
  previousStageKey?: string | null,
): number {
  const raw = Math.max(0, Math.round(rawSec))
  if (raw <= 0) return 0
  const stageChanged = stageKey && previousStageKey && stageKey !== previousStageKey
  if (previousPollSec === undefined || stageChanged) return raw
  return Math.min(raw, previousPollSec)
}
