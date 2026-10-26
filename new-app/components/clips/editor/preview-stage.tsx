'use client'

import { useEffect, useRef, useState } from 'react'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { keepSegments, wordsAfterEdits } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import type { CropShot } from '@/lib/server/clips/clip-detail'
import { CaptionOverlay } from '@/components/clips/editor/caption-overlay'
import {
  applyPlaybackTime,
  cropTransformForFrame,
  interpolateShot,
} from '@/lib/clips/editor-playback'

export function PreviewStage({
  videoUrl,
  edits,
  words,
  cropShots,
  videoRef,
  onTick,
}: {
  videoUrl: string | null
  edits: ClipEditsV2
  words: SourceWord[]
  cropShots: CropShot[]
  videoRef: React.RefObject<HTMLVideoElement | null>
  onTick: (tick: { sourceMs: number; outputMs: number; playing: boolean }) => void
}) {
  const innerRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const editsRef = useRef(edits)
  editsRef.current = edits
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [videoSize, setVideoSize] = useState({ w: 1280, h: 720 })
  const [sourceMs, setSourceMs] = useState(edits.trim.in)
  const [playing, setPlaying] = useState(false)
  const [transform, setTransform] = useState({ scale: 1, translateX: 0, translateY: 0 })
  const [captionTimeSec, setCaptionTimeSec] = useState(0)

  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    ;(videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el
  }, [videoRef])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setContainerSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    setContainerSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const v = innerRef.current
    if (!v || !videoUrl) return
    v.currentTime = edits.trim.in / 1000
    setSourceMs(edits.trim.in)
  }, [videoUrl, edits.trim.in])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const v = innerRef.current
      const e = editsRef.current
      let src = editsRef.current.trim.in
      if (v) {
        src = v.currentTime * 1000
        if (!v.paused) {
          const stepped = applyPlaybackTime(src, e)
          if (Math.abs(stepped.sourceMs - src) > 5) {
            v.currentTime = stepped.sourceMs / 1000
            src = stepped.sourceMs
          }
          if (stepped.atEnd) {
            v.pause()
            setPlaying(false)
          }
        }
        setSourceMs(src)
      }
      const out = applyPlaybackTime(src, e).outputMs
      setCaptionTimeSec(out / 1000)
      onTick({ sourceMs: src, outputMs: out, playing: v ? !v.paused : playing })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [onTick])

  useEffect(() => {
    const shot = interpolateShot(cropShots, sourceMs, edits.layout.shotOverrides)
    const t = cropTransformForFrame(shot, containerSize.w, containerSize.h, videoSize.w, videoSize.h)
    setTransform(t)
  }, [sourceMs, cropShots, edits.layout.shotOverrides, containerSize, videoSize])

  const { words: captionWords } = wordsAfterEdits(words, edits)

  return (
    <div ref={stageRef} className="relative aspect-[9/16] h-full max-h-[68dvh] w-full overflow-hidden rounded-xl bg-black">
      {videoUrl ? (
        <video
          ref={innerRef}
          src={videoUrl}
          className="absolute left-0 top-0 h-full w-auto max-w-none origin-top-left"
          style={{
            transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`,
          }}
          playsInline
          onLoadedMetadata={(e) => {
            const v = e.currentTarget
            setVideoSize({ w: v.videoWidth, h: v.videoHeight })
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
      ) : (
        <div className="flex size-full items-center justify-center text-sm text-muted-foreground">No video</div>
      )}
      {edits.captions?.enabled !== false && (
        <CaptionOverlay words={captionWords} currentTimeSec={captionTimeSec} presetId={edits.captions?.presetId} />
      )}
    </div>
  )
}

export function seekToOutputMs(video: HTMLVideoElement, edits: ClipEditsV2, outputMs: number) {
  const segs = keepSegments(edits.trim.in, edits.trim.out, edits.cutRanges)
  let acc = 0
  let target = edits.trim.in
  for (const [a, b] of segs) {
    const len = b - a
    if (acc + len >= outputMs) {
      target = a + (outputMs - acc)
      break
    }
    acc += len
  }
  video.currentTime = target / 1000
}
