'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import type { ClipBounds, ClipEditsV2 } from '@/lib/clips/edits'
import { editorWindowMs, extendedTrimLimits } from '@/lib/clips/trim-bounds'
import { nudgeTrimIn, nudgeTrimOut } from '@/lib/clips/editor/nudge'

const NUDGE_MS = 100
const NUDGE_BIG_MS = 1000

function msToTimeInput(ms: number): string {
  const s = Math.max(0, ms) / 1000
  const m = Math.floor(s / 60)
  const r = s - m * 60
  return `${m}:${r.toFixed(2).padStart(5, '0')}`
}

function parseTimeInput(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  if (t.includes(':')) {
    const [a, b] = t.split(':')
    const m = Number(a)
    const s = Number(b)
    if (!Number.isFinite(m) || !Number.isFinite(s)) return null
    return Math.round((m * 60 + s) * 1000)
  }
  const s = Number(t)
  if (!Number.isFinite(s)) return null
  return Math.round(s * 1000)
}

export function TrimRangeBar({
  bounds,
  trim,
  onCommitTrim,
}: {
  bounds: ClipBounds
  trim: ClipEditsV2['trim']
  onCommitTrim: (trim: { in: number; out: number }) => void
}) {
  const { minInMs, maxOutMs } = useMemo(() => {
    const win = editorWindowMs(bounds.trimMinMs, bounds.trimMaxMs, bounds.clipStartMs, bounds.clipEndMs)
    const limits =
      bounds.trimMinMs != null && bounds.trimMaxMs != null
        ? {
            minMs: Math.max(bounds.trimMinMs, win.min ?? bounds.trimMinMs),
            maxMs: Math.min(bounds.trimMaxMs, win.max ?? bounds.trimMaxMs),
          }
        : undefined
    return extendedTrimLimits(bounds.clipStartMs, bounds.clipEndMs, limits)
  }, [bounds])
  const limits = useMemo(
    () => ({
      clipStartMs: bounds.clipStartMs,
      clipEndMs: bounds.clipEndMs,
      trimMinMs: minInMs,
      trimMaxMs: maxOutMs,
    }),
    [bounds.clipEndMs, bounds.clipStartMs, maxOutMs, minInMs],
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
      <p className="text-[11px] text-muted-foreground">
        Extend up to ~90s before / 60s after the clip ({minInMs}–{maxOutMs} ms)
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <TrimEdgeRow
          label="In"
          ms={display.in}
          onNudge={(delta, big) => commit(nudgeTrimIn(display, big ? NUDGE_BIG_MS * Math.sign(delta || 1) : delta, limits))}
          onDragCommit={(ms) => commit({ in: ms, out: Math.max(ms + 500, display.out) })}
          onTypedCommit={(ms) => commit({ in: ms, out: Math.max(ms + 500, display.out) })}
          minMs={minInMs}
          maxMs={maxOutMs}
        />
        <TrimEdgeRow
          label="Out"
          ms={display.out}
          onNudge={(delta, big) => commit(nudgeTrimOut(display, big ? NUDGE_BIG_MS * Math.sign(delta || 1) : delta, limits))}
          onDragCommit={(ms) => commit({ in: Math.min(ms - 500, display.in), out: ms })}
          onTypedCommit={(ms) => commit({ in: Math.min(ms - 500, display.in), out: ms })}
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
  onTypedCommit,
}: {
  label: string
  ms: number
  minMs: number
  maxMs: number
  onNudge: (deltaMs: number, big?: boolean) => void
  onDragCommit: (ms: number) => void
  onTypedCommit: (ms: number) => void
}) {
  const [text, setText] = useState(() => msToTimeInput(ms))
  useEffect(() => {
    setText(msToTimeInput(ms))
  }, [ms])

  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-background px-2 py-1">
      <div className="flex items-center gap-1">
        <span className="w-8 text-[11px] font-medium">{label}</span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          aria-label={`Nudge ${label} earlier`}
          onClick={(e) => onNudge(-NUDGE_MS, e.shiftKey)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Slider
          className="min-w-0 flex-1"
          min={minMs}
          max={maxMs}
          value={[ms]}
          aria-label={`${label} trim`}
          onValueChange={(v) => {
            const next = v[0]
            if (next != null) onDragCommit(next)
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          aria-label={`Nudge ${label} later`}
          onClick={(e) => onNudge(NUDGE_MS, e.shiftKey)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2 pl-8">
        <Input
          data-trim-field={label}
          className="h-7 flex-1 font-mono text-[11px]"
          value={text}
          aria-label={`${label} time`}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const parsed = parseTimeInput(text)
            if (parsed != null) onTypedCommit(Math.max(minMs, Math.min(maxMs, parsed)))
            else setText(msToTimeInput(ms))
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        />
        <span className="w-14 text-right text-[11px] tabular-nums text-muted-foreground">{(ms / 1000).toFixed(2)}s</span>
      </div>
    </div>
  )
}
