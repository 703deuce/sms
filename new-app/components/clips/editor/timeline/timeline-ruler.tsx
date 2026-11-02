'use client'

// FV2: longer steps so an hour-long timeline zoomed to fit stays readable.
const STEPS_MS = [100, 250, 500, 1000, 2000, 5000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000, 600_000, 900_000, 1_800_000, 3_600_000]

export function rulerStepMs(pxPerMs: number, minLabelPx = 56): number {
  for (const s of STEPS_MS) if (s * pxPerMs >= minLabelPx) return s
  return STEPS_MS[STEPS_MS.length - 1]!
}

export function formatRulerTime(ms: number, stepMs: number): string {
  const totalSec = ms / 1000
  if (totalSec >= 3600) {
    const h = Math.floor(totalSec / 3600)
    const mm = Math.floor((totalSec % 3600) / 60)
    const sec = Math.round(totalSec % 60)
    return `${h}:${String(mm).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  const m = Math.floor(totalSec / 60)
  const s = totalSec - m * 60
  const ss = stepMs < 1000 ? s.toFixed(stepMs < 250 ? 1 : 2).padStart(stepMs < 250 ? 4 : 5, '0') : String(Math.round(s)).padStart(2, '0')
  return `${m}:${ss}`
}

/** Timecode ruler (output time). Pointer down + drag scrubs the playhead. */
export function TimelineRuler({
  durationMs,
  pxPerMs,
  widthPx,
  height,
  onScrub,
  visFromPx,
  visToPx,
}: {
  durationMs: number
  pxPerMs: number
  widthPx: number
  height: number
  onScrub: (outMs: number) => void
  /** FV2: only draw ticks in this track-px window (long media); omit to draw all. */
  visFromPx?: number
  visToPx?: number
}) {
  const step = rulerStepMs(pxPerMs)
  const ticks: number[] = []
  const t0 = visFromPx != null && pxPerMs > 0 ? Math.max(0, Math.floor(visFromPx / pxPerMs / step) * step) : 0
  const t1 = visToPx != null && pxPerMs > 0 ? Math.min(durationMs + 1, visToPx / pxPerMs + step) : durationMs + 1
  for (let t = t0; t <= t1; t += step) ticks.push(t)
  const toMs = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    return Math.max(0, Math.min(durationMs, ((clientX - r.left) / Math.max(1, r.width)) * durationMs))
  }
  return (
    <div
      className="relative cursor-col-resize select-none border-b border-border/60 text-[11px] tabular-nums text-muted-foreground"
      style={{ width: widthPx, height }}
      data-testid="timeline-ruler"
      onPointerDown={(e) => {
        const el = e.currentTarget
        onScrub(toMs(e.clientX, el))
        const move = (ev: PointerEvent) => onScrub(toMs(ev.clientX, el))
        const up = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }}
    >
      {ticks.map((t) => (
        <span key={t} className="absolute top-0 h-full border-l border-border/70 pl-0.5" style={{ left: t * pxPerMs }}>
          {formatRulerTime(t, step)}
        </span>
      ))}
    </div>
  )
}
