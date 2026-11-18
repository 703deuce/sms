'use client'

import { useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipBack } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MS_LABELS } from '@/lib/motion-studio/config'
import { formatClock } from '@/lib/motion-studio/format'
import type { MsProject, MsScene } from '@/lib/motion-studio/types'
import { SceneFrame } from './scene-frame'

/**
 * Center preview (concept §3): the largest area. Plays the assembled preview when one exists;
 * until then it steps through storyboard frames on the same clock so timing can be reviewed.
 */
export function PreviewStage({
  project,
  scene,
  playheadMs,
  playing,
  onPlayingChange,
  onTime,
  onSelectScene,
}: {
  project: MsProject
  scene: MsScene | null
  playheadMs: number
  playing: boolean
  onPlayingChange: (playing: boolean) => void
  onTime: (ms: number) => void
  onSelectScene: (sceneId: string) => void
}) {
  const total = project.durationMs || project.scenes.at(-1)?.endMs || project.settings.lengthMin * 60_000
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoFailed, setVideoFailed] = useState(false)
  useEffect(() => setVideoFailed(false), [project.previewUrl])
  const playableVideo = Boolean(project.previewUrl && !videoFailed)
  const raf = useRef<number | null>(null)
  const last = useRef<number | null>(null)
  const playheadRef = useRef(playheadMs)
  playheadRef.current = playheadMs

  // Virtual clock for storyboard playback (no real render yet).
  useEffect(() => {
    if (playableVideo || !playing) return
    const tick = (t: number) => {
      const dt = last.current == null ? 0 : t - last.current
      last.current = t
      const next = playheadRef.current + dt
      if (next >= total) {
        onTime(total)
        onPlayingChange(false)
        return
      }
      onTime(next)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current)
      last.current = null
    }
  }, [playing, playableVideo, total, onTime, onPlayingChange])

  // Real preview: keep the <video> element in step with play/pause and seeks.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (playing && v.paused) void v.play().catch(() => onPlayingChange(false))
    if (!playing && !v.paused) v.pause()
  }, [playing, onPlayingChange])
  useEffect(() => {
    const v = videoRef.current
    if (v && Math.abs(v.currentTime * 1000 - playheadMs) > 400) v.currentTime = playheadMs / 1000
  }, [playheadMs])

  const ready = project.scenes.filter((s) => s.status === 'ready').length
  return (
    <div className="flex min-h-0 flex-col gap-2" data-testid="ms-preview">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-panel ring-1 ring-border">
        {playableVideo ? (
          <video
            ref={videoRef}
            src={project.previewUrl || undefined}
            onError={() => { setVideoFailed(true); onPlayingChange(false) }}
            className="size-full object-contain"
            playsInline
            onTimeUpdate={(e) => onTime(e.currentTarget.currentTime * 1000)}
            onEnded={() => onPlayingChange(false)}
          />
        ) : scene ? (
          <button type="button" className="size-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none" onClick={() => onSelectScene(scene.id)} aria-label={`Select scene ${scene.index + 1}: ${scene.title}`}>
            <SceneFrame scene={scene} animate />
          </button>
        ) : (
          <div className="grid size-full place-items-center text-sm text-muted-foreground">The preview appears once the visual plan is ready.</div>
        )}
        {!playableVideo && scene?.status === 'failed' ? (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-lg bg-destructive/85 px-3 py-2 text-xs text-white" role="status" data-testid="ms-preview-scene-failed">
            Scene {scene.index + 1} failed to render. {scene.error || 'Regenerate it to try again.'}
          </div>
        ) : null}
        {!playableVideo && project.scenes.length ? (
          <Badge variant="onMedia" className="absolute top-2 left-2">
            {ready === project.scenes.length ? 'Storyboard preview' : `Rendering ${ready} of ${project.scenes.length} scenes`}
          </Badge>
        ) : null}
      </div>
      {videoFailed ? <p role="status" className="text-xs text-amber-600">The rendered preview could not play. Showing the storyboard instead; original scene files remain available in the editor.</p> : null}
      <div className="flex items-center gap-2">
        <Button size="icon-sm" variant="ghost" aria-label="Back to start" onClick={() => onTime(0)}>
          <SkipBack className="size-4" />
        </Button>
        <Button size="icon-sm" variant="secondary" aria-label={playing ? 'Pause' : 'Play'} onClick={() => onPlayingChange(!playing)} disabled={!project.scenes.length} data-testid="ms-play">
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <input
          type="range"
          min={0}
          max={total}
          step={100}
          value={Math.min(total, playheadMs)}
          onChange={(e) => onTime(Number(e.target.value))}
          aria-label="Seek"
          className="min-w-0 flex-1 accent-[var(--primary)]"
        />
        <span className="font-mono text-xs text-muted-foreground tabular-nums" data-testid="ms-preview-time">
          {formatClock(playheadMs)} / {formatClock(total)}
        </span>
      </div>
      {scene ? <CurrentSceneCard scene={scene} /> : null}
    </div>
  )
}

/** "Current scene" card (ST-UX-045). */
export function CurrentSceneCard({ scene }: { scene: MsScene }) {
  return (
    <section className="rounded-lg border border-border bg-card px-3 py-2.5" aria-label={MS_LABELS.currentScene} data-testid="ms-current-scene">
      <p className="text-xs font-medium text-muted-foreground">{MS_LABELS.currentScene}</p>
      <p className="truncate text-sm font-semibold">{scene.title}</p>
      <p className="text-xs text-muted-foreground">
        {MS_LABELS.visualTreatment} <span className="text-foreground/90">{scene.treatment}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {MS_LABELS.camera} <span className="text-foreground/90">{scene.camera}</span> · {MS_LABELS.source} <span className="text-foreground/90">{scene.source}</span>
      </p>
    </section>
  )
}
