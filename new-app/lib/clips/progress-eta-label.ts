import { formatEtaSeconds } from '@/lib/clips/format-eta'

const TERMINAL = new Set(['READY', 'FAILED', 'CANCELED'])

/** Warn when queued with no worker progress (seconds). */
export const CLIP_QUEUE_WARN_ELAPSED_SEC = 3 * 60
/** Treat as stalled queue — surface explicit error-style copy (seconds). */
export const CLIP_QUEUE_ERROR_ELAPSED_SEC = 10 * 60

/** True when the worker is actively processing (not queued/upload-only). */
export function isActiveClipProcessingStage(status: string, stage?: string | null, progress = 0): boolean {
  if (TERMINAL.has(status)) return false
  if (status === 'QUEUED' || status === 'UPLOADING' || status === 'DRAFT') return false
  const st = (stage ?? '').toLowerCase()
  if (st === 'queued') return false
  if (progress <= 0 && (status === 'QUEUED' || status === 'PREPARING')) return false
  return true
}

export function isClipWaitingForWorker(
  status: string,
  stage?: string | null,
  progress = 0,
  waitingForWorker?: boolean,
): boolean {
  if (waitingForWorker) return true
  if (status !== 'QUEUED') return false
  if (progress > 0) return false
  const st = (stage ?? '').toLowerCase()
  return st === 'queued' || st === '' || stage == null
}

export type ClipQueueAttention = 'none' | 'waiting' | 'slow' | 'stalled'

/** Queue / worker availability UX tied to `waitingForWorker` from status API. */
export function clipQueueAttention(opts: {
  waitingForWorker?: boolean
  status: string
  stage?: string | null
  progress?: number
  queuedElapsedSec?: number
}): ClipQueueAttention {
  const progress = opts.progress ?? 0
  if (!isClipWaitingForWorker(opts.status, opts.stage, progress, opts.waitingForWorker)) {
    return 'none'
  }
  const elapsed = opts.queuedElapsedSec ?? 0
  if (elapsed >= CLIP_QUEUE_ERROR_ELAPSED_SEC) return 'stalled'
  if (elapsed >= CLIP_QUEUE_WARN_ELAPSED_SEC) return 'slow'
  return 'waiting'
}

export function formatClipQueueHint(queueAhead?: number): string {
  if (queueAhead == null) return ''
  if (queueAhead === 0) return ' · Next in queue'
  return ` · ${queueAhead + 1} in queue`
}

function queueWaitSuffix(queuedElapsedSec?: number): string {
  if (queuedElapsedSec == null || queuedElapsedSec <= 0) return ''
  return ` · waiting ${formatEtaSeconds(queuedElapsedSec)}`
}

export function formatClipQueueAttentionMessage(opts: {
  attention: ClipQueueAttention
  queueAhead?: number
  queuedElapsedSec?: number
}): string | null {
  const { attention, queueAhead, queuedElapsedSec } = opts
  const hint = formatClipQueueHint(queueAhead)
  const waited = queueWaitSuffix(queuedElapsedSec)
  switch (attention) {
    case 'waiting':
      return `Waiting for a worker…${hint}${waited}`
    case 'slow':
      return `Queue is slow — workers may be busy.${hint}${waited} Processing will start automatically when a worker is free.`
    case 'stalled':
      return `Still waiting for a worker.${hint}${waited} If this continues, use Retry processing or check back later.`
    default:
      return null
  }
}

/** Secondary ETA line beside the progress bar. */
export function formatClipProgressEtaLine(opts: {
  etaSec: number
  progress: number
  status: string
  stage?: string | null
  waitingForWorker?: boolean
  queueAhead?: number
  queuedElapsedSec?: number
}): string {
  const { etaSec, progress, status, stage, waitingForWorker, queueAhead, queuedElapsedSec } = opts
  const attention = clipQueueAttention({
    waitingForWorker,
    status,
    stage,
    progress,
    queuedElapsedSec,
  })
  const queueLine = formatClipQueueAttentionMessage({ attention, queueAhead, queuedElapsedSec })
  if (queueLine) return queueLine
  if (etaSec > 0) return `ETA ${formatEtaSeconds(etaSec)}`
  if (!isActiveClipProcessingStage(status, stage, progress)) return ''
  if (progress >= 85) return 'Finishing up…'
  if (progress >= 15) return 'Almost done…'
  return ''
}

/** Panel / stage description when ETA is unknown. */
export function formatClipProgressStageLabel(opts: {
  etaSec: number
  progress: number
  status: string
  stage?: string | null
  stageDetail?: string | null
  waitingForWorker?: boolean
  queueAhead?: number
  queuedElapsedSec?: number
}): string {
  const { etaSec, progress, status, stage, stageDetail, waitingForWorker, queueAhead, queuedElapsedSec } = opts
  if (status === 'READY') return 'Ready'
  const attention = clipQueueAttention({
    waitingForWorker,
    status,
    stage,
    progress,
    queuedElapsedSec,
  })
  const queueLine = formatClipQueueAttentionMessage({ attention, queueAhead, queuedElapsedSec })
  if (queueLine) return queueLine
  if (etaSec <= 0 && progress >= 85 && isActiveClipProcessingStage(status, stage, progress)) {
    return 'Finishing up…'
  }
  return stageDetail || 'Processing…'
}
