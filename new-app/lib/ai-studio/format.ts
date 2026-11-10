import type { StudioJobStatus, StudioMediaKind, StudioMode, StudioModel } from './contract'

/** Credits only. Never returns `$`. */
export function formatCredits(n: number): string {
  const v = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
  return v === 1 ? '1 credit' : `${v} credits`
}

export function generateButtonLabel(n: number): string {
  return `Generate · ${formatCredits(n)}`
}

export function modeLabel(mode: StudioMode): string {
  switch (mode) {
    case 'text_to_video':
      return 'Text to video'
    case 'image_to_video':
      return 'Image to video'
    case 'text_to_image':
      return 'Text to image'
  }
}

export function kindLabel(kind: StudioMediaKind): string {
  return kind === 'video' ? 'Video' : 'Image'
}

export function statusLabel(status: StudioJobStatus): string {
  switch (status) {
    case 'queued':
      return 'Queued'
    case 'running':
      return 'Generating'
    case 'done':
      return 'Done'
    case 'failed':
      return 'Failed'
  }
}

export function modelOptionSummary(model: StudioModel): string {
  const parts: string[] = []
  if (model.resolutions.length) {
    parts.push(model.resolutions[0] === model.resolutions[model.resolutions.length - 1]
      ? model.resolutions[0]
      : `${model.resolutions[0]}–${model.resolutions[model.resolutions.length - 1]}`)
  }
  if (model.durationsSec.length) {
    const a = model.durationsSec[0]
    const b = model.durationsSec[model.durationsSec.length - 1]
    parts.push(a === b ? `${a}s` : `${a}–${b}s`)
  }
  return parts.join(' · ')
}

export function snapDuration(value: number, allowed: number[]): number {
  if (!allowed.length) return value
  let best = allowed[0]
  let bestDist = Math.abs(value - best)
  for (const n of allowed) {
    const d = Math.abs(value - n)
    if (d < bestDist) {
      best = n
      bestDist = d
    }
  }
  return best
}

export function editorProjectHref(projectId: string, clipId: string): string {
  return `/app/video-editor/${encodeURIComponent(projectId)}/edit/${encodeURIComponent(clipId)}`
}


export function elapsedLabel(fromIso: string | null | undefined, now = Date.now()): string | null {
  if (!fromIso) return null
  const t = Date.parse(fromIso)
  if (!Number.isFinite(t)) return null
  const sec = Math.max(0, Math.round((now - t) / 1000))
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s ? `${m}m ${s}s` : `${m}m`
}

export function formatJobTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
