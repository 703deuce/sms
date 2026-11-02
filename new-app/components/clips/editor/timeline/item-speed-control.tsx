'use client'

import { useRef, useState } from 'react'
import { Gauge } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { clampSpeed, setSegmentSpeed, speedAtSource, SPEED_MAX, SPEED_MIN, SPEED_PRESETS, type SmoothSlowmo } from '@/lib/clips/editor/speed'
import { SliderRow } from '@/components/clips/editor/e4/slider-row'
import {
  applyCustomCurve,
  applySpeedCurve,
  matchSpeedCurve,
  readCurveBars,
  SPEED_CURVE_IDS,
  SPEED_CURVES,
  type SpeedCurveId,
} from '@/lib/clips/editor/speed-curves'

/** Speed of a Video-lane item (source range), as stored: one SegmentSpeed covering the range. */
export function itemSpeed(edits: ClipEditsV2, srcInMs: number, srcOutMs: number): number {
  return speedAtSource(edits.segmentSpeeds, (srcInMs + srcOutMs) / 2)
}

const SMOOTH_OPTS: [SmoothSlowmo | null, string][] = [
  [null, 'Off'],
  ['blend', 'Frame blend'],
  ['motion', 'Optical flow'],
]

export function speedLabel(s: number): string {
  return `${Math.round(s * 100) / 100}×`
}

/**
 * E4 per-item speed (CapCut Speed → Normal): presets + a 0.25–4× slider for the selected Video item.
 * Source-anchored (edits.segmentSpeeds), so splitting / trimming keeps the speed with the footage.
 * Audio is pitch-preserved (atempo) on export; captions / overlays follow the warp.
 */
export function ItemSpeedControl({
  edits,
  srcInMs,
  srcOutMs,
  onCommit,
  readOnly,
}: {
  edits: ClipEditsV2
  srcInMs: number
  srcOutMs: number
  onCommit: (next: ClipEditsV2) => void
  readOnly?: boolean
}) {
  const cur = itemSpeed(edits, srcInMs, srcOutMs)
  const slowHere = (edits.segmentSpeeds ?? []).some((s) => s.speed < 1 && s.fromMs < srcOutMs && s.toMs > srcInMs)
  const curve = matchSpeedCurve(edits.segmentSpeeds, srcInMs, srcOutMs)
  const [customOpen, setCustomOpen] = useState(false)
  const bars = readCurveBars(edits.segmentSpeeds, srcInMs, srcOutMs)
  const isCustom = !curve && bars.length > 1 && bars.some((b) => b !== bars[0])
  const setCurve = (id: SpeedCurveId) => onCommit({ ...edits, segmentSpeeds: applySpeedCurve(edits.segmentSpeeds, srcInMs, srcOutMs, id) })
  const set = (s: number) => onCommit({ ...edits, segmentSpeeds: setSegmentSpeed(edits.segmentSpeeds, srcInMs, srcOutMs, s) })
  // Slider runs on a log2 scale so 1× sits in the middle of 0.25–4×.
  const toPos = (s: number) => Math.round(Math.log2(s) * 100)
  const fromPos = (p: number) => Math.round(2 ** (p / 100) * 100) / 100
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-card/40 px-2 py-1.5 text-[11px]" data-testid="item-speed">
      <span className="flex items-center gap-1 font-medium">
        <Gauge className="size-3.5" aria-hidden />
        Speed
      </span>
      <div className="flex gap-0.5">
        {SPEED_PRESETS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={readOnly}
            className={cn('rounded px-1.5 py-0.5 tabular-nums hover:bg-muted', Math.abs(cur - s) < 0.001 && 'bg-primary text-primary-foreground hover:bg-primary')}
            onClick={() => set(s)}
            data-testid={`item-speed-${s}`}
          >
            {speedLabel(s)}
          </button>
        ))}
      </div>
      <div className="min-w-[140px] flex-1">
        <SliderRow
          label="Custom"
          value={toPos(cur)}
          min={toPos(SPEED_MIN)}
          max={toPos(SPEED_MAX)}
          step={1}
          testId="item-speed-slider"
          disabled={readOnly}
          format={(p) => speedLabel(fromPos(p))}
          onCommit={(p) => set(p === 0 ? 1 : fromPos(p))}
        />
      </div>
      <span className="tabular-nums text-muted-foreground" data-testid="item-speed-value">
        {curve ? SPEED_CURVES[curve].label : isCustom ? 'Custom curve' : speedLabel(cur)}
      </span>
      {slowHere ? (
        // G4c smooth slow-mo (export-side, all slowed items): frame blending or optical flow.
        <div className="flex w-full flex-wrap items-center gap-0.5" data-testid="item-speed-smooth">
          <span className="mr-1 text-muted-foreground">Smooth slow-mo</span>
          {SMOOTH_OPTS.map(([v, label]) => (
            <button
              key={label}
              type="button"
              disabled={readOnly}
              className={cn('rounded px-1.5 py-0.5 hover:bg-muted', (edits.smoothSlowmo ?? null) === v && 'bg-primary text-primary-foreground hover:bg-primary')}
              onClick={() => onCommit({ ...edits, smoothSlowmo: v ?? undefined })}
              data-testid={`item-speed-smooth-${v ?? 'off'}`}
            >
              {label}
            </button>
          ))}
          <span className="w-full text-[11px] text-muted-foreground" data-testid="item-speed-smooth-note">
            {edits.smoothSlowmo
              ? 'Rendered on export for every slowed item; the preview repeats frames. Optical flow falls back to blending above 1080p or for more than 30 s of slow motion.'
              : 'Slowed footage repeats frames; blending or optical flow fills the gaps on export.'}
          </span>
        </div>
      ) : null}
      {/* G4b speed curves: stepped pieces on the same source-anchored speeds (preview = export). */}
      <div className="flex w-full flex-wrap items-center gap-0.5" data-testid="item-speed-curves">
        <span className="mr-1 text-muted-foreground">Curve</span>
        {SPEED_CURVE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            disabled={readOnly}
            className={cn('rounded px-1.5 py-0.5 hover:bg-muted', curve === id && 'bg-primary text-primary-foreground hover:bg-primary')}
            onClick={() => setCurve(id)}
            data-testid={`item-speed-curve-${id}`}
          >
            {SPEED_CURVES[id].label}
          </button>
        ))}
        <button
          type="button"
          disabled={readOnly}
          className={cn(
            'rounded px-1.5 py-0.5 hover:bg-muted',
            (isCustom || customOpen) && 'bg-primary text-primary-foreground hover:bg-primary',
          )}
          onClick={() => setCustomOpen((o) => !o)}
          data-testid="item-speed-curve-custom"
        >
          Custom
        </button>
      </div>
      {customOpen ? (
        <CurveBars
          bars={bars}
          readOnly={readOnly}
          onCommit={(b) => onCommit({ ...edits, segmentSpeeds: applyCustomCurve(edits.segmentSpeeds, srcInMs, srcOutMs, b) })}
        />
      ) : null}
    </div>
  )
}

function CurveBars({ bars, readOnly, onCommit }: { bars: readonly number[]; readOnly?: boolean; onCommit: (b: number[]) => void }) {
  const [draft, setDraft] = useState(() => [...bars])
  const svgRef = useRef<SVGSVGElement | null>(null)
  const n = bars.length
  const logMin = Math.log2(SPEED_MIN)
  const logMax = Math.log2(SPEED_MAX)
  const yOf = (s: number) => {
    const t = (Math.log2(Math.max(SPEED_MIN, s)) - logMin) / (logMax - logMin)
    return 1 - t
  }
  const speedAtY = (fracY: number) => clampSpeed(Math.round(2 ** (logMin + (1 - fracY) * (logMax - logMin)) * 20) / 20)
  const paint = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect()
    const fx = Math.min(1, Math.max(0, (clientX - r.left) / Math.max(1, r.width)))
    const fy = Math.min(1, Math.max(0, (clientY - r.top) / Math.max(1, r.height)))
    const i = Math.min(n - 1, Math.max(0, Math.floor(fx * n)))
    const sp = speedAtY(fy)
    setDraft((prev) => {
      const next = [...prev]
      next[i] = sp
      return next
    })
  }
  const onDown = (e: React.PointerEvent) => {
    if (readOnly) return
    e.preventDefault()
    paint(e.clientX, e.clientY)
    const mv = (ev: PointerEvent) => paint(ev.clientX, ev.clientY)
    const up = () => {
      window.removeEventListener('pointermove', mv)
      window.removeEventListener('pointerup', up)
      setDraft((cur) => {
        onCommit(cur)
        return cur
      })
    }
    window.addEventListener('pointermove', mv)
    window.addEventListener('pointerup', up)
  }
  return (
    <svg ref={svgRef} className="h-16 w-full rounded border border-border bg-background" data-testid="item-speed-bars" onPointerDown={onDown}>
      <line x1="0" y1="50%" x2="100%" y2="50%" className="stroke-muted-foreground" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
      {draft.map((s, i) => {
        const w = 100 / n
        const h = yOf(s) * 100
        return (
          <rect
            key={i}
            x={`${i * w}%`}
            y={`${h}%`}
            width={`${w}%`}
            height={`${100 - h}%`}
            className="fill-primary/60"
            data-testid={`item-speed-bar-${i}`}
            data-speed={s}
          />
        )
      })}
    </svg>
  )
}
