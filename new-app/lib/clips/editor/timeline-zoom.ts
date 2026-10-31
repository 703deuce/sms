/**
 * Clip editor timeline zoom math (pure; no React). Scale is pixels per second of SOURCE time
 * across the trimmed span (trim.in..trim.out), matching how timeline.tsx lays out word chips.
 */

/** Readable default: ~36px for a 300ms word, enough for a short word at 10px. */
export const TIMELINE_DEFAULT_PX_PER_SEC = 120
export const TIMELINE_MIN_PX_PER_SEC = 4
export const TIMELINE_MAX_PX_PER_SEC = 800
export const TIMELINE_ZOOM_STEP = 1.25
/** Hide a word's text below this chip width (keeps the colored chip + tooltip). */
export const TIMELINE_MIN_LABEL_PX = 14

export function clampPxPerSec(pxPerSec: number): number {
  if (!Number.isFinite(pxPerSec) || pxPerSec <= 0) return TIMELINE_DEFAULT_PX_PER_SEC
  return Math.min(TIMELINE_MAX_PX_PER_SEC, Math.max(TIMELINE_MIN_PX_PER_SEC, pxPerSec))
}

/** Scale that makes the whole span fit the visible track width. */
export function fitPxPerSec(spanMs: number, viewportPx: number): number {
  if (spanMs <= 0 || viewportPx <= 0) return TIMELINE_DEFAULT_PX_PER_SEC
  return clampPxPerSec(viewportPx / (spanMs / 1000))
}

/** Initial zoom: readable default, but never wider than needed when the clip already fits. */
export function initialPxPerSec(spanMs: number, viewportPx: number): number {
  const fit = fitPxPerSec(spanMs, viewportPx)
  return fit >= TIMELINE_DEFAULT_PX_PER_SEC ? fit : TIMELINE_DEFAULT_PX_PER_SEC
}

/** Track width in px; never narrower than the viewport so short clips fill the panel. */
export function trackWidthPx(spanMs: number, pxPerSec: number, viewportPx = 0): number {
  const w = Math.round((Math.max(1, spanMs) / 1000) * clampPxPerSec(pxPerSec))
  return Math.max(Math.max(0, Math.round(viewportPx)), w, 1)
}

export function zoomBy(pxPerSec: number, direction: 'in' | 'out', step = TIMELINE_ZOOM_STEP): number {
  return clampPxPerSec(direction === 'in' ? pxPerSec * step : pxPerSec / step)
}

/**
 * Keep the content point under `anchorX` (px from the scroll viewport's left edge) fixed while the
 * track width changes from prevWidthPx to nextWidthPx. `offsetPx` is fixed content left of the track
 * (lane labels + padding); `extraPx` is all fixed non-track content width (offset + right padding).
 * Returns the new scrollLeft of the scroll container.
 */
export function anchoredScrollLeft(opts: {
  scrollLeft: number
  anchorX: number
  prevWidthPx: number
  nextWidthPx: number
  viewportPx: number
  offsetPx?: number
  extraPx?: number
}): number {
  const { scrollLeft, anchorX, prevWidthPx, nextWidthPx, viewportPx } = opts
  const offset = opts.offsetPx ?? 0
  const extra = opts.extraPx ?? offset
  if (prevWidthPx <= 0) return 0
  const trackX = scrollLeft + anchorX - offset
  const next = (trackX / prevWidthPx) * nextWidthPx + offset - anchorX
  const max = Math.max(0, nextWidthPx + extra - viewportPx)
  return Math.round(Math.min(max, Math.max(0, next)))
}

/**
 * Page-style autoscroll: when the playhead leaves the visible window, jump so it sits
 * `leadPx` from the left edge. Returns null when no scroll is needed.
 */
export function autoscrollLeftForPlayhead(opts: {
  playheadPx: number
  scrollLeft: number
  viewportPx: number
  trackWidthPx: number
  edgePx?: number
  leadPx?: number
}): number | null {
  const { playheadPx, scrollLeft, viewportPx, trackWidthPx: width } = opts
  const edge = opts.edgePx ?? 24
  const lead = opts.leadPx ?? Math.round(viewportPx * 0.1)
  if (viewportPx <= 0) return null
  if (playheadPx >= scrollLeft + edge && playheadPx <= scrollLeft + viewportPx - edge) return null
  const max = Math.max(0, width - viewportPx)
  const next = Math.round(Math.min(max, Math.max(0, playheadPx - lead)))
  return next === Math.round(scrollLeft) ? null : next
}

/** Zoom readout relative to the readable default (100% = TIMELINE_DEFAULT_PX_PER_SEC). */
export function zoomPercent(pxPerSec: number): number {
  return Math.round((clampPxPerSec(pxPerSec) / TIMELINE_DEFAULT_PX_PER_SEC) * 100)
}

/** Slider maps 0..100 logarithmically onto MIN..MAX px/s. */
export function sliderToPxPerSec(v: number): number {
  const t = Math.min(100, Math.max(0, v)) / 100
  const lo = Math.log(TIMELINE_MIN_PX_PER_SEC)
  const hi = Math.log(TIMELINE_MAX_PX_PER_SEC)
  return clampPxPerSec(Math.exp(lo + t * (hi - lo)))
}

export function pxPerSecToSlider(pxPerSec: number): number {
  const lo = Math.log(TIMELINE_MIN_PX_PER_SEC)
  const hi = Math.log(TIMELINE_MAX_PX_PER_SEC)
  return Math.round(((Math.log(clampPxPerSec(pxPerSec)) - lo) / (hi - lo)) * 100)
}

/** Percent position of a source-ms point on a track that spans trimIn..trimIn+spanMs. */
export function sourceMsToTrackPct(sourceMs: number, trimInMs: number, spanMs: number): number {
  if (spanMs <= 0) return 0
  return Math.min(100, Math.max(0, ((sourceMs - trimInMs) / spanMs) * 100))
}

/**
 * Output (post-cut) ms -> source ms over keep segments. Mirrors timeline.tsx outputToSource so the
 * playhead is drawn in the same (source) space as the word chips.
 */
export function outputMsToSourceMs(outputMs: number, keepSegs: Array<[number, number]>, fallbackMs: number): number {
  let acc = 0
  for (const [a, b] of keepSegs) {
    const len = b - a
    if (acc + len >= outputMs) return a + Math.max(0, outputMs - acc)
    acc += len
  }
  return fallbackMs
}
