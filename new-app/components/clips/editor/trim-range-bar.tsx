'use client'

import { useCallback, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ClipBounds, ClipEditsV2 } from '@/lib/clips/edits'
import { extendedTrimLimits } from '@/lib/clips/trim-bounds'
import { nudgeTrimIn, nudgeTrimOut } from '@/lib/clips/editor/nudge'

const NUDGE_MS = 100

export function TrimRangeBar({
  bounds,
  trim,
  onCommitTrim,
}: {
  bounds: ClipBounds
  trim: ClipEditsV2['trim']
  onCommitTrim: (trim: { in: number; out: number }) => void
}) {
  const limits = useMemo(
    () => ({
      clipStartMs: bounds.clipStartMs,
      clipEndMs: bounds.clipEndMs,
      trimMinMs: bounds.trimMinMs,
      trimMaxMs: bounds.trimMaxMs,
    }),
    [bounds],
  )
  const { minInMs, maxOutMs } = extendedTrimLimits(
    bounds.clipStartMs,
    bounds.clipEndMs,
    bounds.trimMinMs != null && bounds.trimMaxMs != null
      ? { minMs: bounds.trimMinMs, maxMs: bounds.trimMaxMs }
      : undefined,
  )
  const [draft, setDraft] = useState(trim)
  const display = draft.in !== trim.in || draft.out !== trim.out ? draft : trim

  const commit = useCallback(
    (next: { in: number; out: number }) => {
      setDraft(next)
      onCommitTrim(next)
    },
    [onCommitTrim],
  )

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3" data-testid="trim-range-bar">
      <p className="text-xs font-medium text-muted-foreground">Trim range</p>
      <p className="text-[10px] text-muted-foreground">
        Limits {minInMs}–{maxOutMs} ms
        {bounds.trimMinMs != null ? ' (media bounds applied)' : ''}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <TrimEdgeRow
          label="In"
          ms={display.in}
          onNudge={(delta) => commit(nudgeTrimIn(display, delta, limits))}
          onDragCommit={(ms) => commit({ in: ms, out: Math.max(ms + 500, display.out) })}
          minMs={minInMs}
          maxMs={maxOutMs}
        />
        <TrimEdgeRow
          label="Out"
          ms={display.out}
          onNudge={(delta) => commit(nudgeTrimOut(display, delta, limits))}
          onDragCommit={(ms) => commit({ in: Math.min(ms - 500, display.in), out: ms })}
          minMs={minInMs}
          maxMs={maxOutMs}
        />
      </div>
    </div>
  )
}

function TrimEdgeRow({
  label,
  ms,
  minMs,
  maxMs,
  onNudge,
  onDragCommit,
}: {
  label: string
  ms: number
  minMs: number
  maxMs: number
  onNudge: (deltaMs: number) => void
  onDragCommit: (ms: number) => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1">
      <span className="w-8 text-[10px] font-medium">{label}</span>
      <Button type="button" size="icon" variant="ghost" className="size-7" aria-label={`Nudge ${label} earlier`} onClick={() => onNudge(-NUDGE_MS)}>
        <ChevronLeft className="size-4" />
      </Button>
      <input
        type="range"
        className="min-w-0 flex-1"
        min={minMs}
        max={maxMs}
        value={ms}
        aria-label={`${label} trim`}
        onChange={(e) => onDragCommit(Number(e.target.value))}
      />
      <Button type="button" size="icon" variant="ghost" className="size-7" aria-label={`Nudge ${label} later`} onClick={() => onNudge(NUDGE_MS)}>
        <ChevronRight className="size-4" />
      </Button>
      <span className="w-14 text-right text-[10px] tabular-nums text-muted-foreground">{(ms / 1000).toFixed(2)}s</span>
    </div>
  )
}
