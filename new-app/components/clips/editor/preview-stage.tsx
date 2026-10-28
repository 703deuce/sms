'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ClipBrandEdits } from '@/lib/clips/brand'
import type { ClipEditsV2, ClipWord } from '@/lib/clips/edits'
import { keepSegments } from '@/lib/clips/edits'
import { editorPreviewCaptionClipWords, editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import { cropPanX, normalizeCropTrack, type CropTrack } from '@/lib/clips/crop-track'
import type { ExportAspect } from '@/lib/clips/export-aspect'
import { shotAt } from '@/lib/clips/crop-track'
import type { SourceWord } from '@/lib/clips/source-words'
import { BrollPreviewVideo } from '@/components/clips/editor/broll-preview-video'
import {
  LAYOUT_HEADLINE_PREVIEW_FRAC,
  layoutReservesHeadlineBand,
  layoutUsesLetterboxBlurPreview,
} from '@/lib/clips/layout-preview'
import { CaptionOverlay } from '@/components/clips/editor/caption-overlay'
import { ExportTemplateOverlay } from '@/components/clips/export-template-overlay'
import { applyPlaybackTime, outputDurationFromEdits } from '@/lib/clips/editor-playback'
import type { BrollMediaRow } from '@/lib/server/clips/broll-media'

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function usesSpeakerCropPreview(edits: ClipEditsV2, track: CropTrack | null): boolean {
  if (!track) return false
  const mode = edits.layout?.mode ?? 'speaker_follow'
  if (
    mode === 'center_crop' ||
    mode === 'fill' ||
    mode === 'fit' ||
    mode === 'fit_blur' ||
    mode === 'fit_top' ||
    mode === 'full_frame'
  ) {
    return false
  }
  return true
}

function aspectRatioParts(aspect: ExportAspect | undefined): { aw: number; ah: number } {
  switch (aspect) {
    case '16:9':
      return { aw: 16, ah: 9 }
    case '1:1':
      return { aw: 1, ah: 1 }
    case '4:5':
      return { aw: 4, ah: 5 }
    default:
      return { aw: 9, ah: 16 }
  }
}

export function PreviewStage({
  videoUrl,
  posterUrl = null,
  edits,
  words,
  previewWords,
  brandLogoUrl,
  cropTrack,
  brollMedia = [],
  videoRef,
  onTick,
  channelDisplay,
  chatPreviewEnabled = false,
}: {
  videoUrl: string | null
  posterUrl?: string | null
  edits: ClipEditsV2
  words: SourceWord[]
  previewWords?: ClipWord[]
  brandLogoUrl?: string | null
  cropTrack: CropTrack | null
  brollMedia?: BrollMediaRow[]
  videoRef: React.RefObject<HTMLVideoElement | null>
  onTick: (tick: { sourceMs: number; outputMs: number; playing: boolean }) => void
  channelDisplay?: string | null
  chatPreviewEnabled?: boolean
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const videoRefInner = useRef<HTMLVideoElement>(null)
  const blurRef = useRef<HTMLVideoElement>(null)
  const editsRef = useRef(edits)
  const trackRef = useRef(cropTrack)
  const aspect = edits.aspectRatio ?? '9:16'
  const layoutMode = edits.layout?.mode ?? 'speaker_follow'
  const letterboxPreview = layoutUsesLetterboxBlurPreview(layoutMode)
  const headlineBandPreview = layoutReservesHeadlineBand(layoutMode)
  const headlineBandPct = headlineBandPreview ? LAYOUT_HEADLINE_PREVIEW_FRAC * 100 : 0
  const normalizedTrack = cropTrack ? normalizeCropTrack(cropTrack) : null
  const cropPreview = Boolean(
    videoUrl && normalizedTrack && usesSpeakerCropPreview(edits, normalizedTrack) && !letterboxPreview,
  )
  editsRef.current = edits
  trackRef.current = normalizedTrack
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [playing, setPlaying] = useState(false)
  const [canPlay, setCanPlay] = useState(false)
  const [captionTimeSec, setCaptionTimeSec] = useState(0)
  const brollRefs = useRef<Record<string, HTMLVideoElement | null>>({})
  const onTickRef = useRef(onTick)
  const boxSizeRef = useRef({ w: 0, h: 0 })
  const captionTimeRef = useRef(0)
  const wordsRef = useRef(words)
  wordsRef.current = words
  onTickRef.current = onTick
  boxSizeRef.current = box

  useEffect(() => {
    const el = videoRefInner.current
    if (!el) return
    ;(videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el
  }, [videoRef, cropPreview, letterboxPreview, aspect, videoUrl])

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width: W, height: H } = e.contentRect
      const { aw, ah } = aspectRatioParts(aspect)
      const h = Math.floor(Math.min(H, (W * ah) / aw))
      if (h <= 0) return
      const w = Math.floor((h * aw) / ah)
      const prev = boxSizeRef.current
      if (prev.w === w && prev.h === h) return
      boxSizeRef.current = { w, h }
      setBox({ w, h })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [aspect])

  useEffect(() => {
    const v = videoRefInner.current
    const b = blurRef.current
    if (!v || !videoUrl) {
      setCanPlay(false)
      return
    }
    setCanPlay(false)
    v.src = videoUrl
    if (b && (cropPreview || letterboxPreview)) b.src = videoUrl
    v.currentTime = edits.trim.in / 1000
  }, [videoUrl, edits.trim.in, cropPreview, letterboxPreview])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const v = videoRefInner.current
      const blur = blurRef.current
      const e = editsRef.current
      const playbackEdits = editorPreviewEdits(e, wordsRef.current)
      const track = trackRef.current
      const letterbox = layoutUsesLetterboxBlurPreview(e.layout?.mode ?? 'speaker_follow')
      let src = e.trim.in
      if (v) {
        src = v.currentTime * 1000
        if (blur && Math.abs(blur.currentTime - v.currentTime) > 0.05) {
          blur.currentTime = v.currentTime
        }
        if (!v.paused) {
          const stepped = applyPlaybackTime(src, playbackEdits)
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
      const out = applyPlaybackTime(src, playbackEdits).outputMs
      const outSec = out / 1000
      if (Math.abs(captionTimeRef.current - outSec) >= 0.02) {
        captionTimeRef.current = outSec
        setCaptionTimeSec(outSec)
      }
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
      onTickRef.current({ sourceMs: src, outputMs: out, playing: v ? !v.paused : playing })

      const { w: boxW, h: boxH } = boxSizeRef.current
      if (v && track && usesSpeakerCropPreview(e, track) && boxH > 0 && Array.isArray(track.shots) && track.shots.length > 0) {
        const s = boxH / track.H
        const fi = Math.round(((src - track.t0_ms) / 1000) * track.fps)
        const { i: shotI } = shotAt(track, src)
        const overrides = Array.isArray(e.layout?.shotOverrides) ? e.layout.shotOverrides : []
        const ov = overrides.find((o) => o.i === shotI)?.focus
        const wide = ov === 'both'
        const arr = ov === 'A' ? track.x0_A : ov === 'B' ? track.x0_B : track.x0
        const raw = arr?.length ? arr[clamp(fi, 0, arr.length - 1)] : cropPanX(track, fi)
        const x0 = raw ?? cropPanX(track, fi)
        const fit = wide || x0 <= -2
        if (fit) {
          v.style.height = `${boxH}px`
          v.style.width = `${boxW}px`
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
          v.style.height = `${boxH}px`
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
  }, [])

  const previewEdits = useMemo(() => editorPreviewEdits(edits, words), [edits, words])
  const captionWords = useMemo(() => {
    if (previewWords?.length) return previewWords.map((w) => ({
      ...w,
      w: typeof w.w === 'string' ? w.w : String(w.w ?? ''),
    }))
    return editorPreviewCaptionClipWords(words, edits)
  }, [previewWords, words, edits])
  const brand = (edits.brand || {}) as ClipBrandEdits
  const pos = brand.logoPosition ?? 'TR'

  return (
    <div ref={wrapRef} className="absolute inset-0 flex items-center justify-center">
      <div style={{ width: box.w || undefined, height: box.h || undefined }} className="relative overflow-hidden rounded-xl bg-black">
        {posterUrl && !canPlay ? (
          <img
            src={posterUrl}
            alt=""
            className="absolute inset-0 z-0 size-full object-cover"
          />
        ) : null}
        {!canPlay && videoUrl ? (
          <div
            className="absolute inset-0 z-[2] animate-pulse bg-gradient-to-b from-muted/40 via-muted/20 to-muted/40"
            aria-hidden
          />
        ) : null}
        {letterboxPreview ? (
          <>
            {headlineBandPreview ? (
              <div
                className="absolute inset-x-0 top-0 z-[2] border-b border-white/20 bg-white/95"
                style={{ height: `${headlineBandPct}%` }}
                aria-hidden
              />
            ) : null}
            <video
              ref={blurRef}
              className="absolute inset-0 size-full max-w-none scale-110 object-cover blur-2xl"
              muted
              playsInline
              aria-hidden
            />
            <video
              ref={videoRefInner}
              className={`absolute inset-x-0 z-[1] max-h-none max-w-none object-contain transition-opacity ${canPlay ? 'opacity-100' : 'opacity-0'}`}
              style={{
                top: `${headlineBandPct}%`,
                height: `${100 - headlineBandPct}%`,
              }}
              playsInline
              poster={posterUrl ?? undefined}
              onLoadedMetadata={() => {
                const v = videoRefInner.current
                const b = blurRef.current
                if (v && b) b.currentTime = v.currentTime
              }}
              onCanPlay={() => setCanPlay(true)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          </>
        ) : cropPreview ? (
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
              className={`absolute left-0 top-0 z-[1] max-w-none transition-opacity ${canPlay ? 'opacity-100' : 'opacity-0'}`}
              style={{ position: 'absolute', left: 0, top: 0, maxWidth: 'none' }}
              playsInline
              poster={posterUrl ?? undefined}
              onLoadedMetadata={() => {
                const v = videoRefInner.current
                const b = blurRef.current
                if (v && b) b.currentTime = v.currentTime
              }}
              onCanPlay={() => setCanPlay(true)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          </>
        ) : videoUrl ? (
          <video
            ref={videoRefInner}
            className={`size-full object-contain transition-opacity ${canPlay ? 'opacity-100' : 'opacity-0'}`}
            playsInline
            poster={posterUrl ?? undefined}
            onCanPlay={() => setCanPlay(true)}
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
            outputDurationSec={outputDurationFromEdits(previewEdits) / 1000}
          />
        )}
        <ExportTemplateOverlay
          edits={edits as ClipEditsV2}
          boxWidth={box.w}
          boxHeight={box.h}
          channelDisplay={channelDisplay}
          chatPreviewEnabled={chatPreviewEnabled}
        />
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
