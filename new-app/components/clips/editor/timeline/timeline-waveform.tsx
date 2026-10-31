'use client'

import type { AudioPeaks } from '@/components/clips/editor/use-audio-peaks'

/** Max device-friendly width of one waveform drawing (browsers drop pixels past ~16–32k px). */
const MAX_DRAW_PX = 6000
/** One envelope point per this many px. */
const PX_PER_POINT = 2

/**
 * FVfix: envelope values for media [fromMs, toMs) at `points` columns. Wide columns take the max of
 * their peaks; narrow columns (zoomed in past the peak rate) interpolate between neighbours, so the
 * shape stays smooth instead of drawing wide flat bars.
 */
export function waveformEnvelope(p: AudioPeaks, fromMs: number, toMs: number, points: number): number[] {
  if (!p.peaks.length || points <= 0 || toMs <= fromMs) return []
  const n = p.peaks.length
  const i0 = (fromMs / 1000) * p.peaksPerSec
  const i1 = (toMs / 1000) * p.peaksPerSec
  const step = (i1 - i0) / points
  const out = new Array<number>(points)
  for (let b = 0; b < points; b++) {
    const x0 = i0 + b * step
    if (step <= 1) {
      const x = x0 + step / 2 - 0.5
      const a = Math.floor(x)
      const t = x - a
      const va = a >= 0 && a < n ? p.peaks[a]! : 0
      const vb = a + 1 >= 0 && a + 1 < n ? p.peaks[a + 1]! : va
      out[b] = va + (vb - va) * t
    } else {
      const a = Math.max(0, Math.floor(x0))
      const z = Math.min(n, Math.max(a + 1, Math.floor(x0 + step)))
      let m = 0
      for (let i = a; i < z; i++) m = Math.max(m, p.peaks[i]!)
      out[b] = m
    }
  }
  return out
}

/** Mirrored filled envelope path in a `points` × 20 box. */
function envelopePath(vals: number[]): string {
  if (!vals.length) return ''
  const top: string[] = []
  const bot: string[] = []
  for (let i = 0; i < vals.length; i++) {
    const h = Math.max(0.25, vals[i]! * 9.5)
    top.push(`${i},${(10 - h).toFixed(2)}`)
    bot.push(`${i},${(10 + h).toFixed(2)}`)
  }
  const last = vals.length - 1
  return `M0,10 L${top.join(' L')} L${last + 1},10 L${bot.reverse().join(' L')} Z`
}

/**
 * Waveform for one lane item: media range [mediaFromMs, mediaToMs) over `widthPx`.
 * FVfix: only the visible window [visLeftPx, visRightPx) of the item is drawn (and never more than
 * MAX_DRAW_PX at once) — a 12-min item at 20 % zoom is ~23 000 px wide, and one drawing that wide
 * was cut off by the browser (the "waveform stops at 8:20" bug).
 */
export function TimelineWaveform({
  peaks,
  mediaFromMs,
  mediaToMs,
  widthPx,
  visLeftPx,
  visRightPx,
  className,
}: {
  peaks: AudioPeaks
  mediaFromMs: number
  mediaToMs: number
  widthPx: number
  visLeftPx?: number
  visRightPx?: number
  className?: string
}) {
  if (!(widthPx > 0) || !(mediaToMs > mediaFromMs) || !peaks.peaks.length) return null
  const a = Math.max(0, Math.min(widthPx, Math.floor(visLeftPx ?? 0)))
  const b = Math.max(a, Math.min(widthPx, Math.ceil(visRightPx ?? widthPx), a + MAX_DRAW_PX))
  if (b - a < 1) return null
  const msPerPx = (mediaToMs - mediaFromMs) / widthPx
  const points = Math.max(1, Math.round((b - a) / PX_PER_POINT))
  const vals = waveformEnvelope(peaks, mediaFromMs + a * msPerPx, mediaFromMs + b * msPerPx, points)
  if (!vals.length) return null
  return (
    <div className={`pointer-events-none overflow-hidden ${className ?? ''}`} aria-hidden>
      <svg
        className="absolute top-0 h-full"
        style={{ left: a, width: b - a }}
        viewBox={`0 0 ${vals.length} 20`}
        preserveAspectRatio="none"
        data-testid="timeline-waveform"
        data-from-px={a}
        data-to-px={b}
      >
        <path d={envelopePath(vals)} fill="currentColor" />
      </svg>
    </div>
  )
}
