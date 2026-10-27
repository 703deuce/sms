import { formatEtaSeconds } from '@/lib/clips/format-eta'

const TERMINAL = new Set(['READY', 'FAILED', 'CANCELED'])

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

export function formatClipQueueHint(queueAhead?: number): string {
  if (queueAhead == null) return ''
  if (queueAhead === 0) return ' · Next in queue'
  return ` · ${queueAhead + 1} in queue`
}

/** Secondary ETA line beside the progress bar. */
export function formatClipProgressEtaLine(opts: {
  etaSec: number
  progress: number
  status: string
  stage?: string | null
  waitingForWorker?: boolean
  queueAhead?: number
}): string {
  const { etaSec, progress, status, stage, waitingForWorker, queueAhead } = opts
  if (isClipWaitingForWorker(status, stage, progress, waitingForWorker)) {
    return `Waiting for a worker…${formatClipQueueHint(queueAhead)}`
  }
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
}): string {
  const { etaSec, progress, status, stage, stageDetail, waitingForWorker, queueAhead } = opts
  if (status === 'READY') return 'Ready'
  if (isClipWaitingForWorker(status, stage, progress, waitingForWorker)) {
    return `Waiting for a worker…${formatClipQueueHint(queueAhead)}`
  }
  if (etaSec <= 0 && progress >= 85 && isActiveClipProcessingStage(status, stage, progress)) {
    return 'Finishing up…'
  }
  return stageDetail || 'Processing…'
}
