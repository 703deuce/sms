/**
 * Clip editor timeline zoom math (pure; no React). Scale is pixels per second of SOURCE time
 * across the trimmed span (trim.in..trim.out), matching how timeline.tsx lays out word chips.
 */

/**
 * 100% zoom. E1fix: 120 px/s gave a 300 ms word 36 px, so "energy," / "capital," were cut off and
 * neighbours ran together (live test). 160 px/s is the floor; the initial zoom goes higher when the
 * clip's own words need it (readablePxPerSec).
 */
export const TIMELINE_DEFAULT_PX_PER_SEC = 160
/** Upper bound for the automatic initial zoom (manual zoom still goes to MAX). */
export const TIMELINE_READABLE_MAX_PX_PER_SEC = 360
/** Average glyph advance of the 11px chip font, plus chip padding. */
export const TIMELINE_WORD_CHAR_PX = 6.4
export const TIMELINE_WORD_PAD_PX = 6
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

/** Estimated px a word label needs at the chip font. */
export function wordLabelWidthPx(text: string): number {
  return Math.ceil(text.trim().length * TIMELINE_WORD_CHAR_PX + TIMELINE_WORD_PAD_PX)
}

/**
 * E1fix: scale at which `coverage` (default 75%) of this clip's words show their full label.
 * Clamped to [DEFAULT, READABLE_MAX]; DEFAULT when there are no usable words.
 */
export function readablePxPerSec(
  words: ReadonlyArray<{ text: string; durMs: number }>,
  coverage = 0.75,
): number {
  const need = words
    .filter((w) => w.durMs >= 40 && w.text.trim().length > 0)
    .map((w) => wordLabelWidthPx(w.text) / (w.durMs / 1000))
    .sort((a, b) => a - b)
  if (!need.length) return TIMELINE_DEFAULT_PX_PER_SEC
  const idx = Math.min(need.length - 1, Math.max(0, Math.floor(need.length * coverage)))
  return Math.min(TIMELINE_READABLE_MAX_PX_PER_SEC, Math.max(TIMELINE_DEFAULT_PX_PER_SEC, need[idx]))
}

/**
 * Initial zoom: readable (default, or what the clip's words need), but never wider than needed
 * when the clip already fits at that scale.
 */
export function initialPxPerSec(spanMs: number, viewportPx: number, readable = TIMELINE_DEFAULT_PX_PER_SEC): number {
  const fit = fitPxPerSec(spanMs, viewportPx)
  const want = clampPxPerSec(Math.max(TIMELINE_DEFAULT_PX_PER_SEC, readable))
  return fit >= want ? fit : want
}

export type TimelineZoomKeyAction = 'in' | 'out' | 'fit'

/** +/= zoom in, -/_ zoom out, 0 fit. No modifiers (Ctrl/Cmd +/-/0 stays browser zoom). */
export function timelineZoomKeyAction(e: {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
}): TimelineZoomKeyAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null
  if (e.key === '+' || e.key === '=') return 'in'
  if (e.key === '-' || e.key === '_') return 'out'
  if (e.key === '0') return 'fit'
  return null
}

const NON_TEXT_INPUT_TYPES = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file', 'image'])

/** True when typing into this element should not trigger editor shortcuts. */
export function isTextEntryTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false
  const el = target as {
    tagName?: string
    type?: string
    isContentEditable?: boolean
    getAttribute?: (n: string) => string | null
    closest?: (s: string) => unknown
  }
  const tag = (el.tagName || '').toUpperCase()
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') return !NON_TEXT_INPUT_TYPES.has((el.type || 'text').toLowerCase())
  if (el.isContentEditable) return true
  const role = el.getAttribute?.('role')
  if (role === 'textbox' || role === 'searchbox' || role === 'combobox' || role === 'spinbutton') return true
  return Boolean(el.closest?.('[contenteditable="true"],[contenteditable=""]'))
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
