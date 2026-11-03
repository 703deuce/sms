'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ScriptViewWaveStrip({
  durationMs,
  outputMs,
  onSeekOutput,
  onShowTimeline,
  waveformSlot,
}: {
  durationMs: number
  outputMs: number
  onSeekOutput: (ms: number) => void
  onShowTimeline: () => void
  waveformSlot?: ReactNode
}) {
  const pct = durationMs > 0 ? Math.min(100, (outputMs / durationMs) * 100) : 0
  return (
    <div
      className="flex h-16 shrink-0 items-center gap-3 border-t border-border bg-card px-3"
      data-testid="script-view-wave-strip"
    >
      <Button type="button" size="sm" variant="secondary" data-testid="script-view-show-timeline" onClick={onShowTimeline}>
        Show timeline
      </Button>
      <div
        className="relative min-h-10 min-w-0 flex-1 cursor-pointer rounded-md bg-muted/40"
        role="slider"
        aria-label="Seek in clip"
        aria-valuemin={0}
        aria-valuemax={durationMs}
        aria-valuenow={outputMs}
        tabIndex={0}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
          onSeekOutput(Math.round(x * durationMs))
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') onSeekOutput(Math.max(0, outputMs - 500))
          if (e.key === 'ArrowRight') onSeekOutput(Math.min(durationMs, outputMs + 500))
        }}
      >
        {waveformSlot ? <div className="absolute inset-0 overflow-hidden rounded-md opacity-80">{waveformSlot}</div> : null}
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary shadow-sm"
          style={{ left: `${pct}%` }}
          data-testid="script-view-playhead"
        />
      </div>
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
            value === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
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
