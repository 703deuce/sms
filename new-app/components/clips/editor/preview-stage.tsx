'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ClipBrandEdits } from '@/lib/clips/brand'
import type { ClipEditsV2, ClipWord } from '@/lib/clips/edits'
import { keepSegments } from '@/lib/clips/edits'
import { buildCaptionWords, captionWordsToClipWords } from '@/lib/clips/caption-words'
import type { CropTrack } from '@/lib/clips/crop-track'
import { shotAt } from '@/lib/clips/crop-track'
import type { SourceWord } from '@/lib/clips/source-words'
import { BrollPreviewVideo } from '@/components/clips/editor/broll-preview-video'
import { CaptionOverlay } from '@/components/clips/editor/caption-overlay'
import { applyPlaybackTime, outputDurationFromEdits } from '@/lib/clips/editor-playback'
import type { BrollMediaRow } from '@/lib/server/clips/broll-media'

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

export function PreviewStage({
  videoUrl,
  edits,
  words,
  previewWords,
  brandLogoUrl,
  cropTrack,
  brollMedia = [],
  videoRef,
  onTick,
}: {
  videoUrl: string | null
  edits: ClipEditsV2
  words: SourceWord[]
  previewWords?: ClipWord[]
  brandLogoUrl?: string | null
  cropTrack: CropTrack | null
  brollMedia?: BrollMediaRow[]
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
  const brollRefs = useRef<Record<string, HTMLVideoElement | null>>({})

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
      const outMs = out
      for (const item of editsRef.current.broll || []) {
        const media = brollMedia.find((m) => m.id === item.id)
        const el = brollRefs.current[item.id]
        if (!el || !media?.url) continue
        const active = item.startMs <= outMs && outMs < item.endMs
        el.style.opacity = active ? '1' : '0'
        if (active) {
          const rel = (outMs - item.startMs) / 1000
          if (Math.abs(el.currentTime - rel) > 0.15) el.currentTime = rel
          if (v && !v.paused && el.paused) void el.play()
          if (v && v.paused && !el.paused) el.pause()
        } else if (!el.paused) el.pause()
      }
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

  const captionWords =
    previewWords ?? captionWordsToClipWords(buildCaptionWords(words, edits))
  const brand = (edits.brand || {}) as ClipBrandEdits
  const pos = brand.logoPosition ?? 'TR'

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
              className="absolute left-0 top-0 z-[1] max-w-none"
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
            className="size-full object-cover"
            playsInline
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        ) : (
          <div className="flex size-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">No video</div>
        )}
        {(edits.broll || []).map((item) => {
          const media = brollMedia.find((m) => m.id === item.id)
          if (!media?.url) return null
          return (
            <BrollPreviewVideo
              key={`${item.id}:${media.url}`}
              src={media.url}
              videoRef={(el) => {
                brollRefs.current[item.id] = el
              }}
              className="pointer-events-none absolute z-[15] overflow-hidden"
              style={{ inset: 0, opacity: 0 }}
            />
          )
        })}
        {brandLogoUrl && brand.logoKey && (
          <img
            src={brandLogoUrl}
            alt=""
            className="pointer-events-none absolute z-[20]"
            style={{
              opacity: brand.logoOpacity ?? 0.9,
              width: `${brand.logoSizePct ?? 12}%`,
              top: pos.includes('T') ? 12 : undefined,
              bottom: pos.includes('B') ? 12 : undefined,
              left: pos.includes('L') ? 12 : undefined,
              right: pos.includes('R') ? 12 : undefined,
            }}
          />
        )}
        {edits.captions?.enabled !== false && (
          <CaptionOverlay
            words={captionWords}
            currentTimeSec={captionTimeSec}
            edits={edits as ClipEditsV2}
            boxHeightPx={box.h}
            outputDurationSec={outputDurationFromEdits(edits) / 1000}
          />
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
