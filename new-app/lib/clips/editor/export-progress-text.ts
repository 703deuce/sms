/** FV4a: the export dialog's status line, from real worker progress (ffmpeg output time). */

export type ExportRenderDetail = { step: number; steps: number; stepPct: number | null }

/**
 * FV4b: overall % bands (worker + web agree): prep 0–10, encode 10–90, upload 90–100.
 * The ETA is hidden until the encode has really started (overall ≥ ETA_MIN_PROGRESS).
 */
export const EXPORT_PROGRESS_BANDS = { prep: [0, 10], encode: [10, 90], upload: [90, 100] } as const
export const ETA_MIN_PROGRESS = 10

/** FV4b: rounded, calm ETA text ("about 10 min left"); null hides it. */
export function formatEtaShort(etaSec: number | null | undefined): string | null {
  if (etaSec == null || !Number.isFinite(etaSec) || etaSec <= 0) return null
  const s = Math.round(etaSec)
  if (s < 60) return 'less than a minute left'
  if (s < 90) return 'about 1 min left'
  if (s < 600) return `about ${Math.round(s / 60)} min left`
  if (s < 3600) {
    const m = Math.round(s / 300) * 5 // 10+ min: nearest 5 min, so it doesn't twitch
    return m >= 60 ? 'about 1 h left' : `about ${m} min left`
  }
  const tenMin = Math.round(s / 600) // nearest 10 min
  const h = Math.floor(tenMin / 6)
  const m = (tenMin % 6) * 10
  return m ? `about ${h} h ${m} min left` : `about ${h} h left`
}

/** FV4b: the dialog's % never goes down for the same render (null = no value yet). */
export function monotonicPct(prev: number | null, next: number | null | undefined): number | null {
  if (typeof next !== 'number' || !Number.isFinite(next)) return prev
  const n = Math.max(0, Math.min(100, Math.round(next)))
  return prev == null ? n : Math.max(prev, n)
}

/** FV4b: a render of this clip is still in flight (Export MP4 must not start another one). */
const IN_FLIGHT_STATUSES = new Set(['QUEUED', 'RUNNING', 'RENDERING'])
export function isRenderInFlight(renderId: string | null, status: string | null): boolean {
  return Boolean(renderId && status && IN_FLIGHT_STATUSES.has(status))
}

export function formatExportProgressLine(input: {
  status: string
  progress: number | null
  phase: string | null
  etaSec: number | null
  detail?: ExportRenderDetail | null
}): string {
  if (input.status === 'QUEUED') return 'Queued for rendering…'
  let line = `Rendering export…${input.progress != null ? ` ${input.progress}%` : ''}`
  const d = input.detail
  if (d && d.steps > 1) {
    line += ` · step ${Math.min(d.step, d.steps)} of ~${d.steps}`
    if (d.stepPct != null) line += ` (${d.stepPct}%)`
  } else if (input.phase && input.phase !== 'render_clip') {
    line += ` (${input.phase.replace(/_/g, ' ')})`
  }
  // FV4b: no ETA during prep (it used to show a hard-coded "~2 min" that then jumped to ~12 min).
  const eta = input.progress != null && input.progress >= ETA_MIN_PROGRESS ? formatEtaShort(input.etaSec) : null
  if (eta) line += ` · ${eta}`
  return line
}

export function readRenderDetail(raw: unknown): ExportRenderDetail | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { step?: unknown; steps?: unknown; stepPct?: unknown }
  if (typeof r.step !== 'number' || typeof r.steps !== 'number') return null
  return {
    step: r.step,
    steps: r.steps,
    stepPct: typeof r.stepPct === 'number' ? r.stepPct : null,
  }
}

/** FV4c: an in-flight render the export dialog should re-attach to (from GET …/active-render). */
export type ActiveRenderResume = { renderId: string; status: 'QUEUED' | 'RENDERING' }

/** FV4c: parse the active-render response defensively; anything unexpected means "nothing to resume". */
export function activeRenderToResume(data: unknown): ActiveRenderResume | null {
  if (!data || typeof data !== 'object') return null
  const render = (data as { render?: unknown }).render
  if (!render || typeof render !== 'object') return null
  const { id, status } = render as { id?: unknown; status?: unknown }
  if (typeof id !== 'string' || !id) return null
  if (status !== 'QUEUED' && status !== 'RENDERING') return null
  return { renderId: id, status }
}
