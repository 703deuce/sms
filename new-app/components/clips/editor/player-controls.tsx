'use client'

import { Button } from '@/components/ui/button'
import { Pause, Play } from 'lucide-react'

function formatClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function PlayerControls({
  playing,
  outputMs,
  outputDurationMs,
  onToggle,
  onScrub,
}: {
  playing: boolean
  outputMs: number
  outputDurationMs: number
  onToggle: () => void
  onScrub: (outputMs: number) => void
}) {
  const pct = outputDurationMs > 0 ? (outputMs / outputDurationMs) * 100 : 0
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Button type="button" size="sm" variant="outline" onClick={onToggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </Button>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {formatClock(outputMs)} / {formatClock(outputDurationMs)}
      </span>
      <input
        type="range"
        min={0}
        max={Math.max(1, outputDurationMs)}
        value={Math.min(outputMs, outputDurationMs)}
        className="min-w-0 flex-1"
        onChange={(e) => onScrub(Number(e.target.value))}
      />
      <span className="hidden w-10 text-right text-xs tabular-nums text-muted-foreground sm:inline">{Math.round(pct)}%</span>
    </div>
  )
}
