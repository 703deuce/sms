'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { keepSegments } from '@/lib/clips/edits'
import { buildCaptionWords, captionWordsToClipWords } from '@/lib/clips/caption-words'
import type { CropTrack } from '@/lib/clips/crop-track'
import { shotAt } from '@/lib/clips/crop-track'
import type { SourceWord } from '@/lib/clips/source-words'
import { CaptionOverlay } from '@/components/clips/editor/caption-overlay'
import { applyPlaybackTime } from '@/lib/clips/editor-playback'

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

export function PreviewStage({
  videoUrl,
  edits,
  words,
  cropTrack,
  videoRef,
  onTick,
}: {
  videoUrl: string | null
  edits: ClipEditsV2
  words: SourceWord[]
  cropTrack: CropTrack | null
  videoRef: React.RefObject<HTMLVideoElement | null>
  onTick: (tick: { sourceMs: number; outputMs: number; playing: boolean }) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const videoRefInner = useRef<HTMLVideoElement>(null)
  const blurRef = useRef<HTMLVideoElement>(null)
  const editsRef = useRef(edits)
  const trackRef = useRef(cropTrack)
  editsRef.current = edits
  trackRef.current = cropTrack
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [playing, setPlaying] = useState(false)
  const [captionTimeSec, setCaptionTimeSec] = useState(0)

  useEffect(() => {
    const el = videoRefInner.current
    if (!el) return
    ;(videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el
  }, [videoRef])

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width: W, height: H } = e.contentRect
      const h = Math.floor(Math.min(H, (W * 16) / 9))
      if (h > 0) setBox({ w: Math.floor((h * 9) / 16), h })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const v = videoRefInner.current
    const b = blurRef.current
    if (!v || !videoUrl) return
    v.src = videoUrl
    if (b) b.src = videoUrl
    v.currentTime = edits.trim.in / 1000
  }, [videoUrl, edits.trim.in])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const v = videoRefInner.current
      const blur = blurRef.current
      const e = editsRef.current
      const track = trackRef.current
      let src = e.trim.in
      if (v) {
        src = v.currentTime * 1000
        if (blur && Math.abs(blur.currentTime - v.currentTime) > 0.05) {
          blur.currentTime = v.currentTime
        }
        if (!v.paused) {
          const stepped = applyPlaybackTime(src, e)
          if (Math.abs(stepped.sourceMs - src) > 5) {
            v.currentTime = stepped.sourceMs / 1000
            if (blur) blur.currentTime = stepped.sourceMs / 1000
            src = stepped.sourceMs
          }
          if (stepped.atEnd) {
            v.pause()
            setPlaying(false)
          }
        }
      }
      const out = applyPlaybackTime(src, e).outputMs
      setCaptionTimeSec(out / 1000)
      onTick({ sourceMs: src, outputMs: out, playing: v ? !v.paused : playing })

      if (v && track && box.h > 0) {
        const s = box.h / track.H
        const fi = Math.round(((src - track.t0_ms) / 1000) * track.fps)
        const { i: shotI } = shotAt(track, src)
        const ov = e.layout.shotOverrides.find((o) => o.i === shotI)?.focus
        const wide = ov === 'both'
        const arr = ov === 'A' ? track.x0_A : ov === 'B' ? track.x0_B : track.x0
        const x0 = arr[clamp(fi, 0, arr.length - 1)]
        const fit = wide || x0 === -1
        if (fit) {
          v.style.height = `${box.h}px`
          v.style.width = `${box.w}px`
          v.style.left = '0'
          v.style.top = '0'
          v.style.transform = 'translate3d(0,0,0)'
          if (blur) {
            blur.style.display = 'block'
            blur.style.height = '100%'
            blur.style.width = '100%'
            blur.style.transform = 'scale(1.2)'
            blur.style.filter = 'blur(24px)'
          }
        } else {
          if (blur) blur.style.display = 'none'
          v.style.height = `${box.h}px`
          v.style.width = `${track.W * s}px`
          v.style.left = '0'
          v.style.top = '0'
          const x0s = x0 * s
          v.style.transform = `translate3d(${-x0s}px,0,0)`
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [box.h, box.w, onTick, playing])

  const captionWords = captionWordsToClipWords(buildCaptionWords(words, edits))

  return (
    <div ref={wrapRef} className="absolute inset-0 flex items-center justify-center">
      <div style={{ width: box.w || undefined, height: box.h || undefined }} className="relative overflow-hidden rounded-xl bg-black">
        {videoUrl && cropTrack ? (
          <>
            <video
              ref={blurRef}
              className="absolute inset-0 size-full max-w-none object-cover"
              muted
              playsInline
              aria-hidden
            />
            <video
              ref={videoRefInner}
              className="absolute left-0 top-0 max-w-none"
              style={{ position: 'absolute', left: 0, top: 0, maxWidth: 'none' }}
              playsInline
              onLoadedMetadata={() => {
                const v = videoRefInner.current
                const b = blurRef.current
                if (v && b) b.currentTime = v.currentTime
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          </>
        ) : videoUrl ? (
          <video
            ref={videoRefInner}
            className="size-full object-contain"
            playsInline
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        ) : (
          <div className="flex size-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">No video</div>
        )}
        {edits.captions?.enabled !== false && (
          <CaptionOverlay words={captionWords} currentTimeSec={captionTimeSec} presetId={edits.captions?.presetId} />
        )}
      </div>
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
