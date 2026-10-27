'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { T2vDraftV1, T2vScene } from '@/lib/t2v/types'
import { estimateSceneMs } from '@/lib/t2v/estimate'
import { cn } from '@/lib/utils'

export function T2vScenePreviewPlayer({
  draftId,
  doc,
  sceneId,
  builtVideoUrl,
  aspect,
  onSelectScene,
}: {
  draftId: string
  doc: T2vDraftV1
  sceneId: string | null
  builtVideoUrl?: string | null
  aspect: string
  onSelectScene?: (id: string) => void
}) {
  const [playing, setPlaying] = useState(false)
  const [builtMode, setBuiltMode] = useState(false)
  const [chainScenes, setChainScenes] = useState(false)
  const [preview, setPreview] = useState<{
    mediaUrl: string | null
    voiceUrl: string | null
    kind: string
    focalX: number
    focalY: number
  } | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const chainTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const idx = doc.scenes.findIndex((s) => s.id === sceneId)
  const scene: T2vScene | null = idx >= 0 ? doc.scenes[idx] : null
  const durMs = scene ? estimateSceneMs(scene) : 0

  const goScene = useCallback(
    (delta: number) => {
      if (!sceneId || !onSelectScene) return
      const i = doc.scenes.findIndex((s) => s.id === sceneId)
      const next = doc.scenes[i + delta]
      if (next) onSelectScene(next.id)
    },
    [doc.scenes, onSelectScene, sceneId],
  )

  const loadPreview = useCallback(async () => {
    if (!sceneId || builtMode) return
    const res = await fetch(`/api/t2v/drafts/${draftId}/scenes/${sceneId}/preview`)
    const body = await res.json()
    if (res.ok) setPreview(body.data)
  }, [draftId, sceneId, builtMode])

  useEffect(() => {
    void loadPreview()
  }, [loadPreview])

  useEffect(() => {
    if (!playing || builtMode) return
    const v = videoRef.current
    const a = audioRef.current
    void v?.play().catch(() => {})
    void a?.play().catch(() => {})
    if (chainScenes && scene && onSelectScene) {
      if (chainTimer.current) clearTimeout(chainTimer.current)
      chainTimer.current = setTimeout(() => {
        const i = doc.scenes.findIndex((s) => s.id === scene.id)
        const next = doc.scenes[i + 1]
        if (next) {
          onSelectScene(next.id)
        } else {
          setPlaying(false)
        }
      }, durMs)
    }
    return () => {
      v?.pause()
      a?.pause()
      if (chainTimer.current) clearTimeout(chainTimer.current)
    }
  }, [playing, preview?.mediaUrl, preview?.voiceUrl, builtMode, chainScenes, scene, durMs, doc.scenes, onSelectScene])

  const aspectClass =
    aspect === '9:16' ? 'aspect-[9/16]' : aspect === '1:1' ? 'aspect-square' : aspect === '4:5' ? 'aspect-[4/5]' : 'aspect-video'

  const togglePlay = () => setPlaying((p) => !p)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-black/90 p-3">
      <div className={cn('relative mx-auto w-full max-h-[520px] overflow-hidden rounded-lg bg-black', aspectClass)}>
        {builtMode && builtVideoUrl ? (
          <video src={builtVideoUrl} className="size-full object-contain" controls playsInline />
        ) : preview?.mediaUrl && preview.kind === 'video' ? (
          <video
            ref={videoRef}
            src={preview.mediaUrl}
            className="size-full object-cover"
            style={{ objectPosition: `${(preview.focalX ?? 0.5) * 100}% ${(preview.focalY ?? 0.5) * 100}%` }}
            muted
            playsInline
            loop={!chainScenes}
          />
        ) : preview?.mediaUrl ? (
          <img
            src={preview.mediaUrl}
            alt=""
            className="size-full object-cover transition-transform duration-[8s] ease-linear"
            style={{
              objectPosition: `${(preview.focalX ?? 0.5) * 100}% ${(preview.focalY ?? 0.5) * 100}%`,
              transform: playing ? 'scale(1.08)' : 'scale(1)',
            }}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-muted-foreground">No preview</div>
        )}
        {scene ? (
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
            Scene {idx + 1}/{doc.scenes.length} · {(durMs / 1000).toFixed(1)}s
          </span>
        ) : null}
        {preview?.voiceUrl ? <audio ref={audioRef} src={preview.voiceUrl} /> : null}
      </div>
      <div className="mt-2 flex h-12 flex-wrap items-center justify-center gap-2 text-white">
        <Button type="button" size="icon-sm" variant="ghost" className="text-white" onClick={() => goScene(-1)} aria-label="Previous scene">
          <SkipBack className="size-4" />
        </Button>
        <Button type="button" size="icon" variant="secondary" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" className="text-white" onClick={() => goScene(1)} aria-label="Next scene">
          <SkipForward className="size-4" />
        </Button>
        <label className="ml-2 flex items-center gap-1 text-xs text-white/80">
          <input type="checkbox" checked={chainScenes} onChange={(e) => setChainScenes(e.target.checked)} />
          Play all scenes
        </label>
        {builtVideoUrl ? (
          <button
            type="button"
            className="ml-2 text-xs text-white/80 underline"
            onClick={() => {
              setBuiltMode((b) => !b)
              setPlaying(false)
            }}
          >
            {builtMode ? 'Scene preview' : 'Play built video'}
          </button>
        ) : null}
        <span className="ml-auto text-xs text-white/60">{aspect}</span>
      </div>
    </div>
  )
}
