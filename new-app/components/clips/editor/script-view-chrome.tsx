'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ScriptViewWaveStrip({
  onShowTimeline,
  timelineSlot,
}: {
  onShowTimeline: () => void
  timelineSlot: ReactNode
}) {
  return (
    <div
      className="relative flex h-full min-h-0 shrink-0 flex-col border-t border-border bg-card px-2 py-1.5 sm:px-3"
      data-testid="script-view-wave-strip"
    >
      <div className="absolute left-2 top-1.5 z-20 sm:left-3">
        <Button type="button" size="sm" variant="secondary" data-testid="script-view-show-timeline" onClick={onShowTimeline}>
          Show timeline
        </Button>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{timelineSlot}</div>
    </div>
  )
}

export function EditorLayoutViewSwitch({
  value,
  onChange,
}: {
  value: 'timeline' | 'script'
  onChange: (v: 'timeline' | 'script') => void
}) {
  return (
    <div
      className="flex rounded-lg border border-border bg-muted/40 p-0.5"
      role="group"
      aria-label="Editor layout"
      data-testid="editor-layout-view-switch"
    >
      {(['script', 'timeline'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          data-testid={`editor-layout-view-${mode}`}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors',
            value === mode
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          )}
          aria-pressed={value === mode}
          onClick={() => onChange(mode)}
        >
          {mode === 'script' ? 'Script' : 'Timeline'}
        </button>
      ))}
    </div>
  )
}
