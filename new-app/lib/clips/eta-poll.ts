/** Stage bucket for monotonic ETA (client polls + server status). */
export function etaStageKey(status?: string | null, stage?: string | null): string {
  if (!status) return ''
  if (status === 'TRANSCRIBING') return 'TRANSCRIBING:'
  if (status === 'FINDING_CLIPS' || status === 'SCANNING') return 'FINDING_CLIPS:'
  if (status === 'REFRAMING' || status === 'RENDERING') return 'REFRAME:'
  return `${status}:${stage ?? ''}`
}

const PIPELINE_STATUS_ORDER = [
  'DRAFT',
  'QUEUED',
  'UPLOADING',
  'PREPARING',
  'TRANSCRIBING',
  'SCANNING',
  'FINDING_CLIPS',
  'REFRAMING',
  'RENDERING',
  'READY',
  'FAILED',
  'CANCELED',
]

function pipelineRank(status: string): number {
  const i = PIPELINE_STATUS_ORDER.indexOf(status)
  return i >= 0 ? i : 0
}

export type ProjectPollSnapshot = {
  status: string
  stage: string | null
  progress: number
  etaSec: number
}

/** Never regress stepper stage/progress when a requeued job polls behind transient deploys. */
export function mergeMonotonicProjectPoll(prev: ProjectPollSnapshot, next: ProjectPollSnapshot): ProjectPollSnapshot {
  const terminal = ['READY', 'FAILED', 'CANCELED']
  if (terminal.includes(next.status)) return next
  if (terminal.includes(prev.status)) return prev

  let status = next.status
  let stage = next.stage
  let progress = Math.max(prev.progress, next.progress)

  if (pipelineRank(next.status) < pipelineRank(prev.status)) {
    status = prev.status
    stage = prev.stage
  }

  const etaSec = clampEtaBetweenPolls(
    next.etaSec,
    prev.etaSec,
    etaStageKey(status, stage),
    etaStageKey(prev.status, prev.stage),
  )

  return { status, stage, progress, etaSec }
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
