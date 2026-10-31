'use client'

import { Gauge } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { setSegmentSpeed, speedAtSource, SPEED_MAX, SPEED_MIN, SPEED_PRESETS } from '@/lib/clips/editor/speed'
import { SliderRow } from '@/components/clips/editor/e4/slider-row'

/** Speed of a Video-lane item (source range), as stored: one SegmentSpeed covering the range. */
export function itemSpeed(edits: ClipEditsV2, srcInMs: number, srcOutMs: number): number {
  return speedAtSource(edits.segmentSpeeds, (srcInMs + srcOutMs) / 2)
}

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
        {speedLabel(cur)}
      </span>
    </div>
  )
}
