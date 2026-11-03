'use client'

import type { ReactNode } from 'react'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { Button } from '@/components/ui/button'
function formatMsClock(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function PropertiesProjectSettings({
  edits,
  durationMs,
  layoutSlot,
  canvasBgSlot,
  onOpenTextPanel,
  onOpenCaptionsPanel,
  onOpenLayoutPanel,
}: {
  edits: ClipEditsV2
  durationMs: number
  layoutSlot: ReactNode
  canvasBgSlot: ReactNode
  onOpenTextPanel?: () => void
  onOpenCaptionsPanel?: () => void
  onOpenLayoutPanel?: () => void
}) {
  return (
    <div className="space-y-4 text-left" data-testid="properties-project-settings">
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Project</p>
        <p className="mb-3 text-[13px] text-muted-foreground">
          Clip settings apply to the whole edit. Select something on the timeline or preview for item properties.
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground">Aspect & layout</p>
        <div data-testid="properties-project-layout">{layoutSlot}</div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground">Canvas background</p>
        <div data-testid="properties-project-canvas-bg">{canvasBgSlot}</div>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-md border border-border/80 bg-muted/20 px-3 py-2">
        <span className="text-xs text-muted-foreground">Duration</span>
        <span className="text-sm tabular-nums text-foreground" data-testid="properties-project-duration">
          {formatMsClock(durationMs)}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" size="sm" variant="secondary" disabled={!onOpenTextPanel} onClick={onOpenTextPanel}>
          Add text
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={!onOpenCaptionsPanel} onClick={onOpenCaptionsPanel}>
          Captions style
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={!onOpenLayoutPanel} onClick={onOpenLayoutPanel}>
          Layout
        </Button>
      </div>
    </div>
  )
}
