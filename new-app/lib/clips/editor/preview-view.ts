import type { ExportAspect } from '@/lib/clips/export-aspect'
import { exportPixelSize } from '@/lib/clips/export-aspect'

export type PreviewQuality = 'auto' | 'full' | 'half'
export const PREVIEW_ZOOM_STEPS = [25, 50, 75, 100, 150, 200] as const
export type PreviewZoom = 'fit' | (typeof PREVIEW_ZOOM_STEPS)[number]

const QUALITY_KEY = 'transovo.editor.previewQuality'

export function readPreviewQuality(): PreviewQuality {
  if (typeof window === 'undefined') return 'auto'
  const v = window.localStorage.getItem(QUALITY_KEY)
  if (v === 'full' || v === 'half' || v === 'auto') return v
  return 'auto'
}

export function writePreviewQuality(q: PreviewQuality): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(QUALITY_KEY, q)
}

export function fitPercent(fit: { w: number; h: number }, aspect: ExportAspect, dpr: number): number {
  const exp = exportPixelSize(aspect, '1080p')
  const pctW = (fit.w * dpr * 100) / exp.width
  const pctH = (fit.h * dpr * 100) / exp.height
  return Math.round(Math.min(pctW, pctH))
}

export function stageBoxForZoom(
  fit: { w: number; h: number },
  aspect: ExportAspect,
  zoom: PreviewZoom,
  dpr: number,
): { w: number; h: number } {
  if (zoom === 'fit') return fit
  const exp = exportPixelSize(aspect, '1080p')
  const scale = zoom / 100 / dpr
  return { w: Math.round(exp.width * scale), h: Math.round(exp.height * scale) }
}

function nearestStep(pct: number): (typeof PREVIEW_ZOOM_STEPS)[number] {
  let best = PREVIEW_ZOOM_STEPS[0]!
  let dist = Math.abs(pct - best)
  for (const s of PREVIEW_ZOOM_STEPS) {
    const d = Math.abs(pct - s)
    if (d < dist) {
      best = s
      dist = d
    }
  }
  return best
}

export function nextZoom(cur: PreviewZoom, dir: 1 | -1, fitPct: number): PreviewZoom {
  if (cur === 'fit') {
    if (dir > 0) {
      const above = PREVIEW_ZOOM_STEPS.find((s) => s > fitPct)
      return above ?? PREVIEW_ZOOM_STEPS[PREVIEW_ZOOM_STEPS.length - 1]!
    }
    const below = [...PREVIEW_ZOOM_STEPS].reverse().find((s) => s < fitPct)
    return below ?? PREVIEW_ZOOM_STEPS[0]!
  }
  const i = PREVIEW_ZOOM_STEPS.indexOf(cur as (typeof PREVIEW_ZOOM_STEPS)[number])
  if (i < 0) return nearestStep(fitPct)
  const next = i + dir
  if (next < 0) return 'fit'
  if (next >= PREVIEW_ZOOM_STEPS.length) return PREVIEW_ZOOM_STEPS[PREVIEW_ZOOM_STEPS.length - 1]!
  return PREVIEW_ZOOM_STEPS[next]!
}

export function clampPan(
  pan: { x: number; y: number },
  box: { w: number; h: number },
  viewport: { w: number; h: number },
): { x: number; y: number } {
  const maxX = Math.max(0, (box.w - viewport.w) / 2)
  const maxY = Math.max(0, (box.h - viewport.h) / 2)
  return {
    x: Math.max(-maxX, Math.min(maxX, pan.x)),
    y: Math.max(-maxY, Math.min(maxY, pan.y)),
  }
}

export function renderScaleFor(
  q: PreviewQuality,
  opts: { boxPx: number; dpr: number; dropRatio: number; prev: number },
): 1 | 0.5 {
  if (q === 'full') return 1
  if (q === 'half') return 0.5
  const load = opts.boxPx * opts.dpr * opts.dpr
  if (opts.prev === 0.5) {
    if (opts.dropRatio < 0.02 && load < 1_600_000) return 1
    return 0.5
  }
  if (load > 2_000_000 || opts.dropRatio > 0.08) return 0.5
  return 1
}
