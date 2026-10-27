/** Stage bucket for monotonic ETA (client polls + server status). */
export function etaStageKey(status?: string | null, stage?: string | null): string {
  if (!status) return ''
  if (status === 'TRANSCRIBING') return 'TRANSCRIBING:'
  if (status === 'FINDING_CLIPS' || status === 'SCANNING') return 'FINDING_CLIPS:'
  if (status === 'REFRAMING' || status === 'RENDERING') return 'REFRAME:'
  return `${status}:${stage ?? ''}`
}

/** Keep displayed ETA monotonic (non-increasing) while a job is in progress. */
export function clampEtaBetweenPolls(
  rawSec: number,
  previousPollSec: number | undefined,
  stageKey?: string | null,
  previousStageKey?: string | null,
): number {
  const raw = Math.max(0, Math.round(rawSec))
  if (raw <= 0) return 0
  if (previousPollSec === undefined || previousPollSec <= 0) return raw
  if (!stageKey || !previousStageKey) return Math.min(raw, previousPollSec)
  if (stageKey === previousStageKey) return Math.min(raw, previousPollSec)
  return Math.min(raw, previousPollSec)
}
