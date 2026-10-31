/** FV4a: the export dialog's status line, from real worker progress (ffmpeg output time). */

export type ExportRenderDetail = { step: number; steps: number; stepPct: number | null }

export function formatEtaShort(etaSec: number | null | undefined): string | null {
  if (etaSec == null || !Number.isFinite(etaSec) || etaSec <= 0) return null
  const s = Math.round(etaSec)
  if (s < 90) return `~${s}s left`
  if (s < 3600) return `~${Math.round(s / 60)} min left`
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return m ? `~${h} h ${m} min left` : `~${h} h left`
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
  const eta = formatEtaShort(input.etaSec)
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
