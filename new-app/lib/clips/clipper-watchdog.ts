/** Progress-stall watchdog helpers (web reaper + UI). */

export type ClipperWatchdogSnap = {
  phase: string
  progress: number
  updatedAt: string
  lastChangeAt: string
}

export const WATCHDOG_AUTO_RETRY_MAX = 1

/** Max time without phase/progress movement before we fail or retry. */
export function phaseStallLimitMs(jobType: string, phase?: string): number {
  const p = (phase ?? '').toLowerCase()
  if (jobType === 'STREAM_RENDER') return 45 * 60_000
  if (jobType === 'RENDER_CLIP' || p.includes('render')) return 20 * 60_000
  if (jobType === 'STREAM_ANALYZE' || p.includes('transcrib')) return 60 * 60_000
  if (jobType === 'STREAM_IMPORT' || p.includes('import') || p.includes('pull')) return 60 * 60_000
  if (jobType === 'STREAM_AUTOPULL') return 90 * 60_000
  if (p.includes('prepar') || p.includes('upload')) return 20 * 60_000
  if (p.includes('find') || p.includes('scan') || p.includes('clip')) return 35 * 60_000
  if (p.includes('reframe') || p.includes('align')) return 40 * 60_000
  return 25 * 60_000
}

export function mergeWatchdogSnap(
  prev: ClipperWatchdogSnap | null | undefined,
  stage?: string,
  progress?: number,
  nowMs = Date.now(),
): ClipperWatchdogSnap {
  const phase = stage?.trim() || prev?.phase || 'working'
  const prog = typeof progress === 'number' && Number.isFinite(progress) ? progress : prev?.progress ?? 0
  const iso = new Date(nowMs).toISOString()
  const changed = !prev || prev.phase !== phase || prev.progress !== prog
  const lastChangeAt = changed ? iso : prev?.lastChangeAt ?? prev?.updatedAt ?? iso
  return { phase, progress: prog, updatedAt: iso, lastChangeAt }
}

export function progressStallExceeded(
  snap: ClipperWatchdogSnap | null | undefined,
  jobType: string,
  nowMs = Date.now(),
): boolean {
  if (!snap?.lastChangeAt) return false
  const age = nowMs - new Date(snap.lastChangeAt).getTime()
  return age > phaseStallLimitMs(jobType, snap.phase)
}

export function watchdogUserMessage(jobType: string, phase?: string): string {
  const label = humanPhaseLabel(phase ?? jobType)
  return `Export and processing stopped making progress during ${label}. We retried once automatically; you can try again or contact support if this keeps happening.`
}

export function watchdogRetryMessage(phase?: string): string {
  const label = humanPhaseLabel(phase ?? 'processing')
  return `No progress during ${label} for several minutes — retrying once automatically.`
}

function humanPhaseLabel(phase: string): string {
  const key = phase.toLowerCase().replace(/_/g, ' ')
  const map: Record<string, string> = {
    render_clip: 'export render',
    transcribing: 'transcription',
    preparing: 'import',
    'stream import': 'stream import',
    finding_clips: 'finding clips',
    scanning: 'scanning',
    ready: 'finish',
  }
  for (const [k, v] of Object.entries(map)) {
    if (key.includes(k.replace(/_/g, ' ')) || key.includes(k)) return v
  }
  return key || 'processing'
}

export function canAutoRetryWatchdog(autoRetries: number | undefined): boolean {
  return (autoRetries ?? 0) < WATCHDOG_AUTO_RETRY_MAX
}
