'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SliderRow } from '@/components/clips/editor/e4/slider-row'
import { valueAtPoints } from '@/lib/clips/editor/keyframes'
import { PROP_SPECS } from '@/lib/clips/editor/motion-schema'
import {
  MOTION_PRESETS,
  presetKeys,
  setTrackMotionValue,
  TRACK_MOTION_PROPS,
  type MotionPreset,
  type TrackMotionKey,
  type TrackMotionProp,
} from '@/lib/clips/editor/track-motion'

const MAIN_PRESETS: MotionPreset[] = ['full', 'left_half', 'right_half', 'left_third', 'center_third', 'right_third']

/**
 * G1c track motion inspector (track header ⋯ → Track motion…): position / scale / crop for every
 * item on the track. "Animate" writes keyframes at the playhead (output time). Presets: 2-up,
 * PiP corners, 3-up; the main picture can take the matching slot.
 */
export function TrackMotionPanel({
  trackId,
  label,
  keys,
  playheadMs,
  onChange,
  onMainPreset,
  onClose,
  readOnly = false,
}: {
  trackId: string
  label: string
  keys: readonly TrackMotionKey[]
  playheadMs: number
  onChange: (next: TrackMotionKey[] | null) => void
  onMainPreset: (p: MotionPreset) => void
  onClose: () => void
  readOnly?: boolean
}) {
  const [animate, setAnimate] = useState(() => keys.some((k) => k.points.length > 0))
  const cur = (p: TrackMotionProp) => {
    const k = keys.find((x) => x.prop === p)
    if (!k) return PROP_SPECS[p].def
    return k.points.length ? valueAtPoints(k.points, playheadMs, PROP_SPECS[p].def) : (k.value ?? PROP_SPECS[p].def)
  }
  const set = (p: TrackMotionProp, v: number) => onChange(setTrackMotionValue(keys, p, v, animate ? playheadMs : null))
  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-card/40 p-2 text-[11px]" data-testid={`track-motion-panel-${trackId}`}>
      <div className="flex items-center gap-2">
        <span className="font-medium">Track motion · {label}</span>
        <label className="ml-2 flex items-center gap-1">
          <input type="checkbox" checked={animate} disabled={readOnly} onChange={(e) => setAnimate(e.target.checked)} data-testid="track-motion-animate" />
          Animate (keyframe at playhead)
        </label>
        <span className="ml-auto flex items-center gap-1">
          <Button size="xs" variant="ghost" disabled={readOnly || !keys.length} onClick={() => onChange(null)} data-testid="track-motion-reset">
            Reset
          </Button>
          <button type="button" className="rounded p-0.5 hover:bg-muted" onClick={onClose} aria-label="Close track motion" data-testid="track-motion-close">
            <X className="size-3.5" />
          </button>
        </span>
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Track presets">
        {MOTION_PRESETS.map((p) => (
          <Button key={p.id} size="xs" variant="outline" disabled={readOnly} onClick={() => onChange(p.id === 'full' ? null : presetKeys(p.id))} data-testid={`track-motion-preset-${p.id}`}>
            {p.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Main video slot">
        <span className="text-muted-foreground">Main video:</span>
        {MAIN_PRESETS.map((id) => (
          <Button key={id} size="xs" variant="ghost" disabled={readOnly} onClick={() => onMainPreset(id)} data-testid={`track-motion-main-${id}`}>
            {MOTION_PRESETS.find((p) => p.id === id)!.label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {TRACK_MOTION_PROPS.map((p) => (
          <SliderRow
            key={p}
            label={PROP_SPECS[p].label}
            value={cur(p)}
            min={PROP_SPECS[p].min}
            max={PROP_SPECS[p].max}
            step={PROP_SPECS[p].step}
            unit={PROP_SPECS[p].unit}
            disabled={readOnly}
            onCommit={(v) => set(p, v)}
            testId={`track-motion-${p}`}
          />
        ))}
      </div>
    </div>
  )
}
