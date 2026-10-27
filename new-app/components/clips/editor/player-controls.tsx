'use client'

import { Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

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
  muted,
  volume,
  onMuteToggle,
  onVolumeChange,
}: {
  playing: boolean
  outputMs: number
  outputDurationMs: number
  onToggle: () => void
  onScrub: (outputMs: number) => void
  muted?: boolean
  volume?: number
  onMuteToggle?: () => void
  onVolumeChange?: (pct: number) => void
}) {
  const max = Math.max(1, outputDurationMs)
  const pct = outputDurationMs > 0 ? (outputMs / outputDurationMs) * 100 : 0
  return (
    <div className="flex w-full min-w-0 max-w-full items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 sm:gap-3">
      <Button type="button" size="icon" variant="outline" className="shrink-0" onClick={onToggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </Button>
      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
        {formatClock(outputMs)} / {formatClock(outputDurationMs)}
      </span>
      {onMuteToggle ? (
        <Button type="button" size="icon" variant="ghost" className="shrink-0" onClick={onMuteToggle} aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </Button>
      ) : null}
      {onVolumeChange ? (
        <Slider
          className="hidden w-20 shrink-0 sm:flex sm:w-24"
          min={0}
          max={100}
          value={[volume ?? 100]}
          onValueChange={(v) => onVolumeChange(Array.isArray(v) ? v[0] ?? 100 : 100)}
          aria-label="Volume"
        />
      ) : null}
      <div className="flex min-w-[120px] flex-1 basis-0 items-center gap-2">
        <Slider
          className="min-w-[120px] flex-1"
          min={0}
          max={max}
          step={50}
          value={[Math.min(outputMs, max)]}
          onValueChange={(v) => {
            const n = Array.isArray(v) ? v[0] : v
            onScrub(typeof n === 'number' ? n : 0)
          }}
          aria-label="Playback position"
        />
        <span className="hidden w-10 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground sm:inline">
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  )
}
