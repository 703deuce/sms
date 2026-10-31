'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Diamond } from 'lucide-react'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  EASES,
  EASE_LABELS,
  PROP_SPECS,
  adjacentKeyframe,
  findTrack,
  pointAt,
  propsForTarget,
  setKeyframeEase,
  setPropertyAt,
  toggleKeyframeAt,
  trackValueAt,
  type Ease,
  type KeyProp,
  type KeyframeTarget,
} from '@/lib/clips/editor/keyframes'

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
}: {
  edits: ClipEditsV2
  target: KeyframeTarget
  label: string
  /** Playhead in the target's local time (ms). */
  localMs: number
  onCommit: (next: ClipEditsV2) => void
  onSeekLocal: (localMs: number) => void
  readOnly?: boolean
}) {
  const props = propsForTarget(target)
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border/60 bg-card/40 px-2 py-1"
      data-testid="keyframe-inspector"
      data-target={target}
      aria-label={`Keyframes · ${label}`}
    >
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
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
        />
      ))}
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
}: {
  edits: ClipEditsV2
  target: KeyframeTarget
  prop: KeyProp
  localMs: number
  onCommit: (next: ClipEditsV2) => void
  onSeekLocal: (localMs: number) => void
  readOnly: boolean
}) {
  const spec = PROP_SPECS[prop]
  const track = findTrack(edits, target, prop)
  const value = trackValueAt(track, prop, localMs)
  const here = pointAt(track, localMs)
  const hasPoints = Boolean(track?.points.length)
  const [draft, setDraft] = useState(fmt(value))
  useEffect(() => setDraft(fmt(value)), [value])
  const commitDraft = () => {
    const n = Number(draft)
    if (!Number.isFinite(n) || fmt(n) === fmt(value)) {
      setDraft(fmt(value))
      return
    }
    onCommit(setPropertyAt(edits, target, prop, localMs, n))
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
      <span className="w-3 text-[10px] text-muted-foreground">{spec.unit}</span>
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
        onClick={() => onCommit(toggleKeyframeAt(edits, target, prop, localMs))}
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
          data-value={here.ease ?? 'linear'}
        >
          {EASES.map((e) => {
            const on = (here.ease ?? 'linear') === e
            return (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={readOnly}
                title={EASE_LABELS[e]}
                onClick={() => !on && onCommit(setKeyframeEase(edits, target, prop, here.tMs, e))}
                className={`h-6 px-1 text-[9px] ${on ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                data-testid={`kf-ease-${prop}-${e}`}
              >
                {EASE_SHORT[e]}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
