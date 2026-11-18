'use client'

import { useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { buildMotionTracks, type MsTrackItemTone } from '@/lib/motion-studio/timeline'
import { formatClock } from '@/lib/motion-studio/format'
import type { MsProject } from '@/lib/motion-studio/types'

const TONE: Record<MsTrackItemTone, string> = {
  scene: 'bg-foreground/10 text-foreground ring-foreground/15',
  broll: 'bg-lane-broll/20 text-foreground ring-lane-broll/40',
  ai: 'bg-lane-ai/20 text-foreground ring-lane-ai/40',
  voice: 'bg-lane-voice/20 text-foreground ring-lane-voice/40',
  music: 'bg-lane-music/20 text-foreground ring-lane-music/40',
  caption: 'bg-lane-caption/20 text-foreground ring-lane-caption/40',
}

/**
 * Motion Studio lanes: SCENES, VIDEO (handoff inserts), GRAPHICS, VOICE, MUSIC.
 * Rendered in the workspace Timeline view and inside the Compact Editor (EditorShell `motionStudioSlot`).
 */
export function MotionStudioTracks({
  project,
  playheadMs,
  selectedSceneId,
  onSeek,
  onSelectScene,
  className,
}: {
  project: Pick<MsProject, 'scenes' | 'audio' | 'durationMs' | 'settings' | 'assets'>
  playheadMs: number
  selectedSceneId?: string | null
  onSeek?: (ms: number) => void
  onSelectScene?: (sceneId: string) => void
  className?: string
}) {
  const { tracks, durationMs } = useMemo(() => buildMotionTracks(project), [project])
  const [visualsOpen,setVisualsOpen]=useState(false)
  const visibleTracks=tracks.filter(t=>visualsOpen || (t.id!=='video' && t.id!=='graphics'))
  const laneRef = useRef<HTMLDivElement>(null)
  const pct = (ms: number) => `${(Math.max(0, Math.min(durationMs, ms)) / Math.max(1, durationMs)) * 100}%`
  const ticks = useMemo(() => {
    const step = durationMs > 8 * 60_000 ? 60_000 : 30_000
    return Array.from({ length: Math.floor(durationMs / step) + 1 }, (_, i) => i * step)
  }, [durationMs])
  const seekFromEvent = (clientX: number) => {
    const el = laneRef.current
    if (!el || !onSeek) return
    const r = el.getBoundingClientRect()
    onSeek(Math.round(((clientX - r.left) / Math.max(1, r.width)) * durationMs))
  }
  return (
    <div className={cn('flex gap-2 select-none', className)} data-testid="ms-tracks" role="group" aria-label="Motion Studio timeline">
      <div className="flex w-22 shrink-0 flex-col gap-1">
        <span className="h-5" />
        {visibleTracks.map((track) => (
          <span key={track.id} className="flex h-7 items-center truncate text-xs font-medium tracking-wide text-muted-foreground">
            {track.id==='scenes' ? <button type="button" aria-expanded={visualsOpen}
              onClick={()=>setVisualsOpen(open=>!open)}>{visualsOpen?'▾':'▸'} Main Visuals</button>
              : track.id==='voice' ? 'Main Voice' : track.label}
          </span>
        ))}
      </div>
      <div className="relative flex min-w-0 flex-1 flex-col gap-1">
        <div
          ref={laneRef}
          className="relative h-5 cursor-pointer border-b border-border/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onPointerDown={(e) => seekFromEvent(e.clientX)}
          role="slider"
          tabIndex={0}
          aria-label="Playhead"
          aria-valuemin={0}
          aria-valuemax={Math.round(durationMs / 1000)}
          aria-valuenow={Math.round(playheadMs / 1000)}
          aria-valuetext={formatClock(playheadMs)}
          onKeyDown={(e) => {
            if (!onSeek) return
            if (e.key === 'ArrowRight') onSeek(Math.min(durationMs, playheadMs + 5000))
            if (e.key === 'ArrowLeft') onSeek(Math.max(0, playheadMs - 5000))
          }}
        >
          {ticks.map((t) => (
            <span key={t} className="absolute bottom-0 -translate-x-1/2 pb-0.5 font-mono text-xs text-muted-foreground tabular-nums first:translate-x-0" style={{ left: pct(t) }}>
              {formatClock(t)}
            </span>
          ))}
        </div>
        {visibleTracks.map((track) => (
          <div key={track.id} className="relative h-7 rounded-md bg-muted/40" data-testid={`ms-track-${track.id}`} aria-label={track.label}>
            {track.items.map((it) => {
              const selected = it.sceneId != null && it.sceneId === selectedSceneId
              return (
                <button
                  key={it.id}
                  type="button"
                  title={`${it.label} · ${formatClock(it.startMs)}–${formatClock(it.endMs)}`}
                  onClick={() => {
                    if (it.sceneId && onSelectScene) onSelectScene(it.sceneId)
                    onSeek?.(it.startMs)
                  }}
                  className={cn(
                    'absolute inset-y-0.5 overflow-hidden rounded px-1.5 text-left text-xs leading-6 whitespace-nowrap ring-1 ring-inset transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    TONE[it.tone],
                    it.status === 'rendering' && 'animate-pulse motion-reduce:animate-none',
                    it.status === 'failed' && 'ring-destructive/60',
                    selected && 'ring-2 ring-primary',
                  )}
                  style={{ left: pct(it.startMs), width: `calc(${pct(it.endMs - it.startMs)} - 2px)` }}
                >
                  {it.label}
                </button>
              )
            })}
          </div>
        ))}
        <span aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-primary" style={{ left: pct(playheadMs) }} />
      </div>
    </div>
  )
}
