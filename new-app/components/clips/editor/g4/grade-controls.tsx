'use client'

/**
 * G4a Color panel controls: RGB curves, lift / gamma / gain wheels, HSL per hue range, effects.
 * Each control edits plain ColorSpec fields (normalizeGradeFields) — preview and export read the
 * same values. Drags call `onLive` (preview only); release calls `onCommit` (one undo step).
 */
import { useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { SliderRow } from '@/components/clips/editor/e4/slider-row'
import {
  CURVE_CHANNELS,
  CURVE_MAX_POINTS,
  HSL_CENTERS,
  HSL_LABELS,
  HSL_RANGES,
  WHEELS,
  curveEval,
  curveSlopes,
  normalizeCurve,
  type CurveChannel,
  type CurvePts,
  FX_ALL,
  type FxAnyKey,
  type FxKey,
  type HslAdj,
  type HslRange,
  type Wheel,
  type WheelId,
} from '@/lib/clips/editor/color-grade'
import type { ColorSpec } from '@/lib/clips/editor/color'
import { FX2_KEYS, FX2_LABELS, FX_PRESETS } from '@/lib/clips/editor/fx-library'

type Edit = { spec: ColorSpec; onLive: (s: ColorSpec) => void; onCommit: (s: ColorSpec, key?: string) => void; disabled?: boolean }

const CH_COLOR: Record<CurveChannel, string> = { m: '#e5e7eb', r: '#ef4444', g: '#22c55e', b: '#3b82f6' }
const CH_LABEL: Record<CurveChannel, string> = { m: 'Luma', r: 'Red', g: 'Green', b: 'Blue' }
const IDENT: CurvePts = [
  [0, 0],
  [1, 1],
]

function withCurve(spec: ColorSpec, ch: CurveChannel, pts: CurvePts | null): ColorSpec {
  const curves = { ...(spec.curves ?? {}) }
  const n = pts ? normalizeCurve(pts) : null
  if (n) curves[ch] = n
  else delete curves[ch]
  return { ...spec, curves: Object.keys(curves).length ? curves : undefined }
}

export function curvePath(pts: CurvePts, size: number): string {
  const m = curveSlopes(pts)
  const out: string[] = []
  for (let i = 0; i <= 64; i++) {
    const x = i / 64
    const y = Math.min(1, Math.max(0, curveEval(pts, m, x)))
    out.push(`${i ? 'L' : 'M'}${(x * size).toFixed(1)},${((1 - y) * size).toFixed(1)}`)
  }
  return out.join('')
}

export function CurvesEditor({ spec, onLive, onCommit, disabled }: Edit) {
  const [ch, setCh] = useState<CurveChannel>('m')
  const [drag, setDrag] = useState<{ i: number; pts: CurvePts } | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const S = 160
  const pts = drag?.pts ?? spec.curves?.[ch] ?? IDENT
  const path = useMemo(() => curvePath(pts, S), [pts])
  const at = (e: React.PointerEvent): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height))
    return [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]
  }
  const move = (e: React.PointerEvent) => {
    if (!drag) return
    const [x, y] = at(e)
    const p = drag.pts.map((q) => [...q] as [number, number])
    const lo = drag.i === 0 ? 0 : p[drag.i - 1]![0] + 0.01
    const hi = drag.i === p.length - 1 ? 1 : p[drag.i + 1]![0] - 0.01
    // End points keep their x (0 / 1); inner points stay between neighbours.
    p[drag.i] = [drag.i === 0 ? p[0]![0] : drag.i === p.length - 1 ? p[p.length - 1]![0] : Math.min(hi, Math.max(lo, x)), y]
    setDrag({ i: drag.i, pts: p })
    onLive(withCurve(spec, ch, p))
  }
  const up = () => {
    if (!drag) return
    onCommit(withCurve(spec, ch, drag.pts), `curve-${ch}`)
    setDrag(null)
  }
  return (
    <div className="space-y-2" data-testid="color-curves">
      <div className="flex gap-1" role="tablist" aria-label="Curve channel">
        {CURVE_CHANNELS.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={ch === c}
            onClick={() => setCh(c)}
            className={cn('rounded px-2 py-0.5 text-[11px]', ch === c ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
            data-testid={`color-curve-tab-${c}`}
          >
            <span className="mr-1 inline-block size-2 rounded-full" style={{ background: CH_COLOR[c] }} />
            {CH_LABEL[c]}
            {spec.curves?.[c] ? ' •' : ''}
          </button>
        ))}
        <button
          type="button"
          className="ml-auto rounded px-2 py-0.5 text-[11px] hover:bg-muted disabled:opacity-40"
          disabled={disabled || !spec.curves?.[ch]}
          onClick={() => onCommit(withCurve(spec, ch, null))}
          data-testid="color-curve-reset"
        >
          Reset
        </button>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${S} ${S}`}
        className="aspect-square w-full max-w-[220px] touch-none rounded border border-border bg-black/40"
        data-testid="color-curve-canvas"
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        onPointerDown={(e) => {
          if (disabled || drag) return
          const [x, y] = at(e)
          if (pts.length >= CURVE_MAX_POINTS) return
          const p = [...pts, [x, y] as [number, number]].sort((a, b) => a[0] - b[0])
          const i = p.findIndex((q) => q[0] === x && q[1] === y)
          ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
          setDrag({ i, pts: p })
          onLive(withCurve(spec, ch, p))
        }}
      >
        {[0.25, 0.5, 0.75].map((g) => (
          <g key={g} stroke="rgba(255,255,255,.12)">
            <line x1={g * S} x2={g * S} y1={0} y2={S} />
            <line y1={g * S} y2={g * S} x1={0} x2={S} />
          </g>
        ))}
        <line x1={0} y1={S} x2={S} y2={0} stroke="rgba(255,255,255,.2)" strokeDasharray="3 3" />
        <path d={path} fill="none" stroke={CH_COLOR[ch]} strokeWidth={1.6} />
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p[0] * S}
            cy={(1 - p[1]) * S}
            r={4}
            fill={CH_COLOR[ch]}
            stroke="#000"
            data-testid={`color-curve-pt-${i}`}
            onPointerDown={(e) => {
              e.stopPropagation()
              if (disabled) return
              ;(e.currentTarget.ownerSVGElement as Element | null)?.setPointerCapture?.(e.pointerId)
              setDrag({ i, pts })
            }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              if (disabled || i === 0 || i === pts.length - 1) return
              onCommit(withCurve(spec, ch, pts.filter((_, j) => j !== i)))
            }}
          />
        ))}
      </svg>
      <p className="text-[10px] text-muted-foreground">Click to add a point (up to {CURVE_MAX_POINTS}), drag to shape, double-click to remove.</p>
    </div>
  )
}

const WHEEL_LABEL: Record<WheelId, string> = { lift: 'Lift (shadows)', gamma: 'Gamma (midtones)', gain: 'Gain (highlights)' }

function withWheel(spec: ColorSpec, id: WheelId, w: Wheel | null): ColorSpec {
  const wheels = { ...(spec.wheels ?? {}) }
  const r = w ? { x: Math.round(w.x * 1000) / 1000, y: Math.round(w.y * 1000) / 1000, l: Math.round(w.l * 1000) / 1000 } : null
  if (r && (r.x || r.y || r.l)) wheels[id] = r
  else delete wheels[id]
  return { ...spec, wheels: Object.keys(wheels).length ? wheels : undefined }
}

/** x = cos φ, y = sin φ with φ = 0° red, 120° green, 240° blue (color_grade.wheel_d). */
function wheelFromPointer(e: React.PointerEvent, el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect()
  let x = ((e.clientX - r.left) / r.width) * 2 - 1
  let y = -(((e.clientY - r.top) / r.height) * 2 - 1)
  const d = Math.hypot(x, y)
  if (d > 1) {
    x /= d
    y /= d
  }
  return { x, y }
}

function WheelPad({ id, spec, onLive, onCommit, disabled }: Edit & { id: WheelId }) {
  const w = spec.wheels?.[id] ?? { x: 0, y: 0, l: 0 }
  const [drag, setDrag] = useState<Wheel | null>(null)
  const cur = drag ?? w
  const S = 72
  return (
    <div className="flex flex-col items-center gap-1" data-testid={`color-wheel-${id}`}>
      <div
        className="relative touch-none rounded-full border border-border"
        style={{
          width: S,
          height: S,
          // Hue ring matches the math: red at 0° (right), green at 120°, blue at 240° (counter-clockwise).
          background: 'conic-gradient(from 90deg, #f00, #f0f 60deg, #00f 120deg, #0ff 180deg, #0f0 240deg, #ff0 300deg, #f00)',
        }}
        onPointerDown={(e) => {
          if (disabled) return
          ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
          const p = wheelFromPointer(e, e.currentTarget)
          const n = { ...cur, ...p }
          setDrag(n)
          onLive(withWheel(spec, id, n))
        }}
        onPointerMove={(e) => {
          if (!drag) return
          const n = { ...drag, ...wheelFromPointer(e, e.currentTarget) }
          setDrag(n)
          onLive(withWheel(spec, id, n))
        }}
        onPointerUp={() => {
          if (!drag) return
          onCommit(withWheel(spec, id, drag), `wheel-${id}`)
          setDrag(null)
        }}
        onDoubleClick={() => !disabled && onCommit(withWheel(spec, id, { ...cur, x: 0, y: 0 }))}
        data-testid={`color-wheel-pad-${id}`}
      >
        <div className="absolute inset-[18%] rounded-full bg-background/70" />
        <span
          className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black bg-white"
          style={{ left: `${(cur.x * 0.5 + 0.5) * 100}%`, top: `${(0.5 - cur.y * 0.5) * 100}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground">{WHEEL_LABEL[id]}</span>
      <div className="w-full">
        <SliderRow
          label="Level"
          value={Math.round(cur.l * 100)}
          min={-100}
          max={100}
          disabled={disabled}
          testId={`color-wheel-${id}-l`}
          onLive={(v) => onLive(withWheel(spec, id, { ...cur, l: v / 100 }))}
          onCommit={(v) => onCommit(withWheel(spec, id, { ...cur, l: v / 100 }), `wheel-${id}-l`)}
        />
      </div>
    </div>
  )
}

export function ColorWheels(p: Edit) {
  return (
    <div className="grid grid-cols-3 gap-2" data-testid="color-wheels">
      {WHEELS.map((id) => (
        <WheelPad key={id} id={id} {...p} />
      ))}
    </div>
  )
}

function withHsl(spec: ColorSpec, r: HslRange, a: HslAdj): ColorSpec {
  const hsl = { ...(spec.hsl ?? {}) }
  if (a.h || a.s || a.l) hsl[r] = a
  else delete hsl[r]
  return { ...spec, hsl: Object.keys(hsl).length ? hsl : undefined }
}

export function HslControls({ spec, onLive, onCommit, disabled }: Edit) {
  const [r, setR] = useState<HslRange>('red')
  const a = spec.hsl?.[r] ?? { h: 0, s: 0, l: 0 }
  return (
    <div className="space-y-2" data-testid="color-hsl">
      <div className="flex gap-1.5" role="tablist" aria-label="Hue range">
        {HSL_RANGES.map((k, i) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={r === k}
            aria-label={HSL_LABELS[k]}
            title={HSL_LABELS[k]}
            onClick={() => setR(k)}
            className={cn('size-5 rounded-full border-2', r === k ? 'border-foreground' : 'border-transparent', spec.hsl?.[k] ? 'ring-1 ring-primary' : '')}
            style={{ background: `hsl(${HSL_CENTERS[i]}, 85%, 50%)` }}
            data-testid={`color-hsl-tab-${k}`}
          />
        ))}
      </div>
      {(['h', 's', 'l'] as const).map((c) => (
        <SliderRow
          key={c}
          label={`${HSL_LABELS[r]} · ${c === 'h' ? 'Hue' : c === 's' ? 'Saturation' : 'Luminance'}`}
          value={a[c]}
          min={-100}
          max={100}
          disabled={disabled}
          testId={`color-hsl-${c}`}
          onLive={(v) => onLive(withHsl(spec, r, { ...a, [c]: v }))}
          onCommit={(v) => onCommit(withHsl(spec, r, { ...a, [c]: v }), `hsl-${r}-${c}`)}
        />
      ))}
    </div>
  )
}

const FX_LABEL: Record<FxKey, string> = { sharpen: 'Sharpen', vignette: 'Vignette', grain: 'Grain' }

function withFx(spec: ColorSpec, k: FxAnyKey, v: number): ColorSpec {
  const fx = { ...(spec.fx ?? {}) }
  if (v) fx[k] = v
  else delete fx[k]
  return { ...spec, fx: Object.keys(fx).length ? fx : undefined }
}

/** G4b: a preset replaces the effect sliders (the grade itself is untouched). */
function withFxPreset(spec: ColorSpec, fxSet: Partial<Record<FxAnyKey, number>> | null): ColorSpec {
  const fx = fxSet ? { ...fxSet } : {}
  return { ...spec, fx: Object.keys(fx).length ? fx : undefined }
}

export function FxControls({ spec, onLive, onCommit, disabled }: Edit) {
  const keys: { k: FxAnyKey; label: string }[] = [
    ...(['sharpen', 'vignette', 'grain'] as const).map((k) => ({ k, label: FX_LABEL[k] })),
    ...FX2_KEYS.map((k) => ({ k, label: FX2_LABELS[k] })),
  ]
  const presetOn = (fx: Partial<Record<FxAnyKey, number>>) =>
    FX_ALL.every((k) => (spec.fx?.[k] ?? 0) === (fx[k] ?? 0))
  return (
    <div className="space-y-3" data-testid="color-fx">
      <div className="flex flex-wrap gap-1" data-testid="color-fx-presets">
        {FX_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            className={cn(
              'rounded-md border border-border px-2 py-0.5 text-[11px] hover:bg-muted disabled:opacity-40',
              presetOn(p.fx) && 'border-primary bg-muted',
            )}
            onClick={() => onCommit(withFxPreset(spec, p.fx), `fx-preset-${p.id}`)}
            data-testid={`color-fx-preset-${p.id}`}
          >
            {p.label}
          </button>
        ))}
        {spec.fx ? (
          <button
            type="button"
            disabled={disabled}
            className="rounded-md px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
            onClick={() => onCommit(withFxPreset(spec, null), 'fx-clear')}
            data-testid="color-fx-clear"
          >
            Clear
          </button>
        ) : null}
      </div>
      {keys.map(({ k, label }) => (
        <SliderRow
          key={k}
          label={label}
          value={spec.fx?.[k] ?? 0}
          min={0}
          max={100}
          disabled={disabled}
          testId={`color-fx-${k}`}
          onLive={(v) => onLive(withFx(spec, k, v))}
          onCommit={(v) => onCommit(withFx(spec, k, v), `fx-${k}`)}
        />
      ))}
    </div>
  )
}
