'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClipEditsV2, ClipWord } from '@/lib/clips/edits'
import { wordsAfterEdits } from '@/lib/clips/edits'
import type { CropShot } from '@/lib/server/clips/clip-detail'
import { CaptionOverlay } from '@/components/clips/editor/caption-overlay'

function interpolateCrop(shots: CropShot[], tMs: number) {
  const shot = shots.find((s) => tMs >= s.startMs && tMs < s.endMs) || shots[shots.length - 1]
  if (!shot) return { x: 50, y: 45, scale: 1.15 }
  return { x: shot.cx, y: shot.cy, scale: shot.scale ?? 1.15 }
}

export function PreviewStage({
  videoUrl,
  edits,
  words,
  cropShots,
  clipStartMs = 0,
  onTime,
}: {
  videoUrl: string | null
  edits: ClipEditsV2
  words: ClipWord[]
  cropShots: CropShot[]
  clipStartMs?: number
  onTime?: (t: number) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [timeSec, setTimeSec] = useState(0)
  const { words: displayWords } = wordsAfterEdits(words, edits)

  const clipOffset = clipStartMs / 1000

  const skipCuts = useCallback(
    (t: number) => {
      const relMs = (t - clipOffset) * 1000
      for (const [s, e] of edits.cutRanges) {
        if (relMs >= s && relMs < e) return clipOffset + e / 1000
      }
      const trimIn = edits.trim.in / 1000
      const trimOut = edits.trim.out / 1000
      const rel = t - clipOffset
      if (rel < trimIn) return clipOffset + trimIn
      if (rel > trimOut) return clipOffset + trimOut
      return t
    },
    [clipOffset, edits],
  )

  useEffect(() => {
    const v = videoRef.current
    if (v && clipOffset > 0) v.currentTime = clipOffset
  }, [clipOffset, videoUrl])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    let raf = 0
    const tick = () => {
      if (!v.paused) {
        const fixed = skipCuts(v.currentTime)
        if (Math.abs(fixed - v.currentTime) > 0.02) v.currentTime = fixed
        setTimeSec(v.currentTime)
        onTime?.(v.currentTime)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [onTime, skipCuts])

  const tMs = timeSec * 1000 - clipStartMs
  const { x, y, scale } = interpolateCrop(cropShots, tMs)

  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[320px] overflow-hidden rounded-xl bg-black">
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          className="absolute inset-0 size-full object-cover"
          style={{
            transform: `translate(-${x}%, -${y}%) scale(${scale})`,
            transformOrigin: 'top left',
          }}
          playsInline
          onTimeUpdate={(e) => {
            const v = e.currentTarget
            const fixed = skipCuts(v.currentTime)
            if (Math.abs(fixed - v.currentTime) > 0.02) v.currentTime = fixed
            setTimeSec(v.currentTime)
            onTime?.(v.currentTime)
          }}
        />
      ) : (
        <div className="flex size-full items-center justify-center text-sm text-muted-foreground">No video</div>
      )}
      {edits.captions?.enabled !== false && (
        <CaptionOverlay
          words={displayWords}
          currentTimeSec={timeSec - clipOffset}
          presetId={edits.captions?.presetId}
        />
      )}
    </div>
  )
}

export function usePreviewControls(videoRef: React.RefObject<HTMLVideoElement | null>) {
  return {
    togglePlay: () => {
      const v = videoRef.current
      if (!v) return
      if (v.paused) void v.play()
      else v.pause()
    },
    seek: (sec: number) => {
      const v = videoRef.current
      if (v) v.currentTime = sec
    },
  }
}
