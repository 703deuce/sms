'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Diamond, Spline } from 'lucide-react'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  EASES,
  EASE_LABELS,
  PROP_SPECS,
  adjacentKeyframe,
  findTrack,
  pointAt,
  pointBz,
  propsForTarget,
  setKeyframeCurve,
  setKeyframeEase,
  setPropertyAt,
  toggleKeyframeAt,
  trackValueAt,
  targetOriginMs,
  type Ease,
  type KeyProp,
  type KeyframeTarget,
} from '@/lib/clips/editor/keyframes'
import { CROP_PROPS, isColorProp } from '@/lib/clips/editor/motion-schema'
import { KeyframeLanes } from '@/components/clips/editor/timeline/keyframe-lanes'

/**
 * G4cfix: a colour / effect track with no keyframes left is dropped, so the panel slider is the
 * static value again (a pointless static track used to keep the last keyframed value: stale 80).
 */
export function dropEmptyColorTrack(edits: ClipEditsV2, target: KeyframeTarget, prop: KeyProp): ClipEditsV2 {
  if (!isColorProp(prop)) return edits
  const t = findTrack(edits, target, prop)
  if (!t || t.points.length) return edits
  return { ...edits, keyframes: (edits.keyframes ?? []).filter((k) => k !== t) }
}

const EASE_SHORT: Record<Ease, string> = { linear: 'Lin', in: 'In', out: 'Out', inOut: 'In-Out' }

/**
 * CapCut-style keyframe inspector for the selected timeline item: one row per animatable property
 * with its value at the playhead, a ◇ toggle (add / remove a keyframe here), ◀ ▶ to jump between
 * keyframes and the ease of the segment that starts at this keyframe. Editing a value while the
 * property has keyframes auto-adds one at the playhead (CapCut behaviour).
 */
export function KeyframeInspector({
  edits,
  target,
  label,
  localMs,
  onCommit,
  onSeekLocal,
  readOnly = false,
  props: only,
  baseValue,
  span,
}: {
  edits: ClipEditsV2
  target: KeyframeTarget
  label: string
  /** Playhead in the target's local time (ms). */
  localMs: number
  onCommit: (next: ClipEditsV2) => void
  onSeekLocal: (localMs: number) => void
  readOnly?: boolean
  /** G1a: rows to show (default: the E3 transform / volume rows — crop lives in Properties). */
  props?: readonly KeyProp[]
  /** G4cfix: static (slider) value of a colour / effect row without keyframes. */
  baseValue?: (prop: KeyProp) => number | undefined
  /** KF-19: item-local span for per-property lanes (timeline inspector only). */
  span?: { fromMs: number; toMs: number }
}) {
  const props = only ?? propsForTarget(target).filter((p) => !(CROP_PROPS as readonly string[]).includes(p))
  const [lanesOpen, setLanesOpen] = useState(false)
  const originMs = targetOriginMs(edits, target)
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border/60 bg-card/40 px-2 py-1"
      data-testid="keyframe-inspector"
      data-target={target}
      aria-label={`Keyframes · ${label}`}
    >
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {props.map((p) => (
        <PropRow
          key={p}
          edits={edits}
          target={target}
          prop={p}
          localMs={localMs}
          onCommit={onCommit}
          onSeekLocal={onSeekLocal}
          readOnly={readOnly}
          baseValue={baseValue}
        />
      ))}
      {span ? (
        <button
          type="button"
          className="text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => setLanesOpen((o) => !o)}
          aria-expanded={lanesOpen}
          data-testid="kf-lanes-toggle"
        >
          Lanes {lanesOpen ? '▾' : '▸'}
        </button>
      ) : null}
      {span && lanesOpen ? (
        <KeyframeLanes
          edits={edits}
          target={target}
          props={props}
          span={span}
          localMs={localMs}
          originMs={originMs}
          onCommit={onCommit}
          onSeekLocal={onSeekLocal}
          readOnly={readOnly}
        />
      ) : null}
    </div>
  )
}

function fmt(v: number): string {
  return String(Math.round(v * 10) / 10)
}

function PropRow({
  edits,
  target,
  prop,
  localMs,
  onCommit,
  onSeekLocal,
  readOnly,
  baseValue,
}: {
  edits: ClipEditsV2
  target: KeyframeTarget
  prop: KeyProp
  localMs: number
  onCommit: (next: ClipEditsV2) => void
  onSeekLocal: (localMs: number) => void
  readOnly: boolean
  baseValue?: (prop: KeyProp) => number | undefined
}) {
  const spec = PROP_SPECS[prop]
  const track = findTrack(edits, target, prop)
  const here = pointAt(track, localMs)
  const hasPoints = Boolean(track?.points.length)
  // G4cfix: colour / effect rows without keyframes show (and start from) the panel slider value.
  const colorRow = isColorProp(prop)
  const value = colorRow && !hasPoints ? (baseValue?.(prop) ?? trackValueAt(undefined, prop, localMs)) : trackValueAt(track, prop, localMs)
  const [draft, setDraft] = useState(fmt(value))
  const [graphOpen, setGraphOpen] = useState(false)
  useEffect(() => setDraft(fmt(value)), [value])
  const commitDraft = () => {
    const n = Number(draft)
    if (!Number.isFinite(n) || fmt(n) === fmt(value)) {
      setDraft(fmt(value))
      return
    }
    const set = setPropertyAt(edits, target, prop, localMs, n)
    // G4cfix: typing on a colour / effect row without keyframes starts one here (the static value
    // stays the panel slider's, so preview, slider and export never disagree).
    onCommit(colorRow && !hasPoints ? toggleKeyframeAt(set, target, prop, localMs) : set)
  }
  const toggle = () => {
    if (!colorRow) return onCommit(toggleKeyframeAt(edits, target, prop, localMs))
    const from = hasPoints ? edits : setPropertyAt(edits, target, prop, localMs, value)
    onCommit(dropEmptyColorTrack(toggleKeyframeAt(from, target, prop, localMs), target, prop))
  }
  const prev = adjacentKeyframe(edits, target, prop, localMs, -1)
  const next = adjacentKeyframe(edits, target, prop, localMs, 1)
  const btn =
    'inline-flex size-5 items-center justify-center rounded hover:bg-muted disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  return (
    <div className="flex items-center gap-0.5 text-[11px]" data-testid={`kf-row-${prop}`}>
      <label className="w-[62px] truncate text-muted-foreground" htmlFor={`kf-${target}-${prop}`}>
        {spec.label}
      </label>
      <input
        id={`kf-${target}-${prop}`}
        type="number"
        inputMode="decimal"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={draft}
        disabled={readOnly}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitDraft()
          }
          e.stopPropagation()
        }}
        className="h-6 w-14 rounded border border-border bg-background px-1 text-right tabular-nums"
        data-testid={`kf-value-${prop}`}
      />
      <span className="w-3 text-[11px] text-muted-foreground">{spec.unit}</span>
      <button
        type="button"
        className={btn}
        disabled={prev == null}
        onClick={() => prev != null && onSeekLocal(prev)}
        aria-label={`Previous ${spec.label} keyframe`}
        title="Previous keyframe"
        data-testid={`kf-prev-${prop}`}
      >
        <ChevronLeft className="size-3" />
      </button>
      <button
        type="button"
        className={`${btn} ${here ? 'text-amber-400' : hasPoints ? 'text-foreground' : 'text-muted-foreground'}`}
        disabled={readOnly}
        onClick={toggle}
        aria-pressed={Boolean(here)}
        aria-label={here ? `Remove ${spec.label} keyframe` : `Add ${spec.label} keyframe`}
        title={here ? 'Remove keyframe' : 'Add keyframe at playhead'}
        data-testid={`kf-toggle-${prop}`}
        data-active={here ? 'true' : undefined}
      >
        <Diamond className={`size-3 ${here ? 'fill-current' : ''}`} />
      </button>
      <button
        type="button"
        className={btn}
        disabled={next == null}
        onClick={() => next != null && onSeekLocal(next)}
        aria-label={`Next ${spec.label} keyframe`}
        title="Next keyframe"
        data-testid={`kf-next-${prop}`}
      >
        <ChevronRight className="size-3" />
      </button>
      {here ? (
        // Segmented ease picker (CapCut curve presets); the editor bans native select elements (§13 audit).
        <div
          className="flex overflow-hidden rounded border border-border"
          role="radiogroup"
          aria-label={`${spec.label} ease (from this keyframe to the next)`}
          data-testid={`kf-ease-${prop}`}
          data-value={here.bz ? 'curve' : (here.ease ?? 'linear')}
        >
          {EASES.map((e) => {
            const on = !here.bz && (here.ease ?? 'linear') === e
            return (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={readOnly}
                title={EASE_LABELS[e]}
                onClick={() => !on && onCommit(setKeyframeEase(edits, target, prop, here.tMs, e))}
                className={`h-6 px-1 text-[11px] ${on ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                data-testid={`kf-ease-${prop}-${e}`}
              >
                {EASE_SHORT[e]}
              </button>
            )
          })}
          <button
            type="button"
            role="radio"
            aria-checked={Boolean(here.bz)}
            disabled={readOnly}
            title="Custom curve"
            onClick={() => setGraphOpen((o) => !o)}
            className={`h-6 px-1 text-[11px] ${here.bz ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            data-testid={`kf-ease-${prop}-curve`}
          >
            <Spline className="size-3" />
          </button>
        </div>
      ) : null}
      {here && graphOpen ? (
        <EaseGraph
          value={pointBz(here)}
          readOnly={readOnly}
          testId={`kf-graph-${prop}`}
          onCommit={(bz) => onCommit(setKeyframeCurve(edits, target, prop, here.tMs, bz))}
        />
      ) : null}
    </div>
  )
}

/** KF-15: 96×64 curve; two handles at x = 1/3, 2/3 dragged vertically. Commits once on pointerup. */
function EaseGraph({
  value,
  onCommit,
  readOnly,
  testId,
}: {
  value: [number, number]
  onCommit: (bz: [number, number]) => void
  readOnly: boolean
  testId: string
}) {
  const W = 96
  const H = 64
  const [bz, setBz] = useState<[number, number]>(value)
  useEffect(() => setBz(value), [value[0], value[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  const svgRef = useRef<SVGSVGElement | null>(null)
  const yOf = (v: number) => H - v * H
  const path = `M0,${H} C${W / 3},${yOf(bz[0])} ${(2 * W) / 3},${yOf(bz[1])} ${W},0`
  const drag = (i: 0 | 1) => (e: React.PointerEvent) => {
    if (readOnly) return
    e.preventDefault()
    const r = svgRef.current!.getBoundingClientRect()
    let cur = bz
    const mv = (ev: PointerEvent) => {
      const v = Math.round(Math.min(1, Math.max(0, 1 - (ev.clientY - r.top) / Math.max(1, r.height))) * 100) / 100
      cur = (i === 0 ? [v, cur[1]] : [cur[0], v]) as [number, number]
      setBz(cur)
    }
    const up = () => {
      window.removeEventListener('pointermove', mv)
      window.removeEventListener('pointerup', up)
      onCommit(cur)
    }
    window.addEventListener('pointermove', mv)
    window.addEventListener('pointerup', up)
  }
  return (
    <svg ref={svgRef} width={W} height={H} className="rounded border border-border bg-background" data-testid={testId} data-bz={bz.join(',')}>
      <line x1={0} y1={H} x2={W / 3} y2={yOf(bz[0])} className="stroke-muted-foreground" strokeWidth={0.5} />
      <line x1={W} y1={0} x2={(2 * W) / 3} y2={yOf(bz[1])} className="stroke-muted-foreground" strokeWidth={0.5} />
      <path d={path} fill="none" className="stroke-primary" strokeWidth={1.5} />
      {([0, 1] as const).map((i) => (
        <circle
          key={i}
          cx={((i + 1) * W) / 3}
          cy={yOf(bz[i])}
          r={4}
          className="cursor-ns-resize fill-amber-400"
          onPointerDown={drag(i)}
          data-testid={`${testId}-h${i}`}
        />
      ))}
    </svg>
  )
}
