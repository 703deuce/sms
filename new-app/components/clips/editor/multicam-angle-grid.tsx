'use client'

import { useEffect, useMemo, useRef } from 'react'
import { ImageIcon, Music2 } from 'lucide-react'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { angleAt, MAIN_ANGLE, multicamAngles, type Angle } from '@/lib/clips/editor/multicam-manual'
import type { ClipMediaSource } from '@/lib/clips/editor/sources'
import { sourceById } from '@/lib/clips/editor/sources'
import { cn } from '@/lib/utils'

export function MulticamAngleGrid({
  edits,
  library,
  sourceUrls,
  mainVideoUrl,
  playheadSourceMs,
  playing,
  onSwitchAngle,
}: {
  edits: ClipEditsV2
  library: readonly ClipMediaSource[]
  sourceUrls: Record<string, string>
  mainVideoUrl: string | null
  playheadSourceMs: number
  playing: boolean
  onSwitchAngle: (sourceId: string, opts?: { shiftKey?: boolean }) => void
}) {
  const angles = useMemo(() => multicamAngles(edits, library).slice(0, 9), [edits, library])
  const activeId = angleAt(edits, playheadSourceMs)
  const cols = angles.length <= 1 ? 1 : angles.length <= 4 ? 2 : 3

  return (
    <div
      className="grid gap-1 rounded-md border border-border bg-card/80 p-1"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      data-testid="multicam-angle-grid"
    >
      {angles.map((a) => (
        <AngleTile
          key={a.sourceId}
          angle={a}
          edits={edits}
          library={library}
          sourceUrls={sourceUrls}
          mainVideoUrl={mainVideoUrl}
          playheadSourceMs={playheadSourceMs}
          playing={playing}
          active={a.sourceId === activeId}
          onSwitch={(opts) => onSwitchAngle(a.sourceId, opts)}
        />
      ))}
    </div>
  )
}

function AngleTile({
  angle,
  edits,
  library,
  sourceUrls,
  mainVideoUrl,
  playheadSourceMs,
  playing,
  active,
  onSwitch,
}: {
  angle: Angle
  edits: ClipEditsV2
  library: readonly ClipMediaSource[]
  sourceUrls: Record<string, string>
  mainVideoUrl: string | null
  playheadSourceMs: number
  playing: boolean
  active: boolean
  onSwitch: (opts?: { shiftKey?: boolean }) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const src = angle.sourceId === MAIN_ANGLE ? undefined : sourceById(edits.sources, angle.sourceId) ?? library.find((s) => s.id === angle.sourceId)
  const url =
    angle.sourceId === MAIN_ANGLE ? mainVideoUrl : src?.refId ? sourceUrls[src.refId] ?? null : null
  const syncMs = angle.sourceId === MAIN_ANGLE ? 0 : src?.syncMs ?? 0
  const targetT = Math.max(0, (playheadSourceMs + syncMs) / 1000)

  useEffect(() => {
    const v = videoRef.current
    if (!v || !url) return
    if (!playing) {
      if (Math.abs(v.currentTime - targetT) > 0.05) v.currentTime = targetT
      v.pause()
      return
    }
    void v.play().catch(() => {})
    const id = window.setInterval(() => {
      if (!videoRef.current) return
      if (Math.abs(videoRef.current.currentTime - targetT) > 0.12) {
        videoRef.current.currentTime = targetT
      }
    }, 500)
    return () => window.clearInterval(id)
  }, [url, targetT, playing])

  const isAudio = src?.mediaType === 'audio'
  const isImage = src?.mediaType === 'image'

  return (
    <button
      type="button"
      data-testid={`multicam-grid-tile-${angle.key}`}
      className={cn(
        'relative aspect-video overflow-hidden rounded border text-left',
        active ? 'ring-2 ring-primary border-primary' : 'border-border/60 hover:border-primary/40',
      )}
      onClick={(e) => onSwitch({ shiftKey: e.shiftKey })}
    >
      <span className="absolute left-1 top-1 z-10 rounded bg-black/60 px-1 font-mono text-[10px] text-white">
        {angle.key}
      </span>
      {isAudio ? (
        <div className="flex size-full items-center justify-center bg-muted">
          <Music2 className="size-6 text-muted-foreground" aria-hidden />
        </div>
      ) : isImage && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" />
      ) : url ? (
        <video ref={videoRef} src={url} muted playsInline className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
          <ImageIcon className="size-4" aria-hidden />
        </div>
      )}
      <span className="absolute bottom-0 inset-x-0 truncate bg-black/50 px-1 text-[9px] text-white">{angle.label}</span>
    </button>
  )
}
