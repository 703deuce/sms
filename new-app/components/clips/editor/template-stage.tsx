'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TemplatePipSpec, TemplateSpecV2 } from '@/lib/clips/templates/geometry'

function useContainerSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (cr) setSize({ w: cr.width, h: cr.height })
    })
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [ref])
  return size
}

function panelVideoStyle(
  fit: string,
  src: { x: number; y: number; w: number; h: number },
  panelW: number,
  panelH: number,
  videoW: number,
  videoH: number,
): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    maxWidth: 'none',
    pointerEvents: 'none',
  }
  if (fit === 'contain_black' || fit === 'contain_blur') {
    const scale = Math.min(panelW / (src.w * videoW), panelH / (src.h * videoH))
    const elW = videoW * scale
    const elH = videoH * scale
    const left = -(src.x * videoW * scale) + (panelW - src.w * videoW * scale) / 2
    const top = -(src.y * videoH * scale) + (panelH - src.h * videoH * scale) / 2
    return { ...base, width: elW, height: elH, left, top, objectFit: 'contain' }
  }
  const scale = Math.max(panelW / (src.w * videoW), panelH / (src.h * videoH))
  const elW = videoW * scale
  const elH = videoH * scale
  const left = -(src.x * videoW * scale) - (src.w * videoW * scale - panelW) / 2
  const top = -(src.y * videoH * scale) - (src.h * videoH * scale - panelH) / 2
  return { ...base, width: elW, height: elH, left, top }
}

/** Presentational multi-panel preview — scaled export-parity layout. */
export function TemplateStage({
  spec,
  videoUrl,
  posterUrl,
  onReady,
  primaryVideoRef,
  paused = true,
  seekTime,
  lowResWarning,
}: {
  spec: TemplateSpecV2
  videoUrl?: string | null
  posterUrl?: string | null
  onReady?: () => void
  primaryVideoRef?: React.RefObject<HTMLVideoElement | null>
  paused?: boolean
  seekTime?: number
  lowResWarning?: boolean
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const { w: cw, h: ch } = useContainerSize(rootRef)
  const [dims, setDims] = useState({ w: 1920, h: 1080 })
  const syncVideosRef = useRef<HTMLVideoElement[]>([])

  const k = spec.playW > 0 && cw > 0 ? cw / spec.playW : 0

  const registerVideo = useCallback((el: HTMLVideoElement | null) => {
    if (!el) return
    if (!syncVideosRef.current.includes(el)) syncVideosRef.current.push(el)
  }, [])

  useEffect(() => {
    const primary = primaryVideoRef?.current
    const syncAll = () => {
      const t = primary?.currentTime ?? seekTime ?? 0
      for (const v of syncVideosRef.current) {
        if (v === primary) continue
        if (Math.abs(v.currentTime - t) > 0.08) v.currentTime = t
        v.paused !== (primary?.paused ?? paused) &&
          (primary?.paused ?? paused ? v.pause() : void v.play().catch(() => {}))
      }
    }
    if (primary) {
      primary.addEventListener('timeupdate', syncAll)
      primary.addEventListener('seeked', syncAll)
      primary.addEventListener('play', syncAll)
      primary.addEventListener('pause', syncAll)
    }
    syncAll()
    return () => {
      if (primary) {
        primary.removeEventListener('timeupdate', syncAll)
        primary.removeEventListener('seeked', syncAll)
        primary.removeEventListener('play', syncAll)
        primary.removeEventListener('pause', syncAll)
      }
    }
  }, [primaryVideoRef, paused, seekTime, spec.templateId])

  useEffect(() => {
    if (seekTime == null) return
    for (const v of syncVideosRef.current) {
      if (Math.abs(v.currentTime - seekTime) > 0.05) v.currentTime = seekTime
    }
  }, [seekTime])

  useEffect(() => {
    syncVideosRef.current = []
  }, [spec.templateId, JSON.stringify(spec.panels.map((p) => p.src))])

  if (!videoUrl) {
    return posterUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={posterUrl} alt="" className="size-full object-cover" />
    ) : null
  }

  const panelKey = `${spec.templateId}:${JSON.stringify(spec.panels.map((p) => p.src))}`

  return (
    <div
      ref={rootRef}
      className="relative size-full overflow-hidden bg-black"
      data-testid="template-stage"
      key={panelKey}
      style={{ aspectRatio: `${spec.playW}/${spec.playH}` }}
    >
      {lowResWarning ? (
        <div className="absolute left-1 top-1 z-20 rounded bg-black/70 px-2 py-0.5 text-[10px] text-amber-200">
          Low-res source (480p): facecam will be soft
        </div>
      ) : null}
      {spec.bands.map((band, i) => {
        const d = band.dest
        const isBlur = band.fill === 'blur' || band.fill === 'dark_gradient'
        const left = d.x * k
        const top = d.y * k
        const width = d.w * k
        const height = d.h * k
        return (
          <div
            key={`band-${i}`}
            className="absolute overflow-hidden"
            style={{ left, top, width, height }}
          >
            {isBlur ? (
              <video
                ref={registerVideo}
                src={videoUrl}
                className="size-full scale-110 object-cover"
                style={{ filter: 'blur(20px) brightness(0.92)' }}
                muted
                playsInline
                preload="auto"
              />
            ) : (
              <div className="size-full bg-black" />
            )}
          </div>
        )
      })}
      {spec.panels.map((p, i) => {
        const left = p.dest.x * k
        const top = p.dest.y * k
        const width = p.dest.w * k
        const height = p.dest.h * k
        const isPrimary = i === 0
        return (
          <div
            key={i}
            className="absolute overflow-hidden"
            style={{ left, top, width, height }}
          >
            {p.fit === 'contain_blur' ? (
              <>
                <video
                  ref={registerVideo}
                  src={videoUrl}
                  className="absolute inset-0 size-full scale-110 object-cover blur-2xl"
                  style={{ filter: 'blur(16px) brightness(0.9)' }}
                  muted
                  playsInline
                  preload="auto"
                />
                <video
                  ref={(el) => {
                    registerVideo(el)
                    if (isPrimary && primaryVideoRef && el) {
                      ;(primaryVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el
                      el.addEventListener('loadeddata', () => {
                        if (el.videoWidth > 0) setDims({ w: el.videoWidth, h: el.videoHeight })
                        onReady?.()
                      })
                    }
                  }}
                  src={videoUrl}
                  style={panelVideoStyle(p.fit, p.src, width, height, dims.w, dims.h)}
                  muted
                  playsInline
                  preload="auto"
                />
              </>
            ) : (
              <video
                ref={(el) => {
                  registerVideo(el)
                  if (isPrimary && primaryVideoRef && el) {
                    ;(primaryVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el
                    el.addEventListener('loadeddata', () => {
                      if (el.videoWidth > 0) setDims({ w: el.videoWidth, h: el.videoHeight })
                      onReady?.()
                    })
                  }
                }}
                src={videoUrl}
                style={panelVideoStyle(p.fit, p.src, width, height, dims.w, dims.h)}
                muted
                playsInline
                preload="auto"
              />
            )}
          </div>
        )
      })}
      {spec.pip ? (
        <PipOverlay pip={spec.pip} videoUrl={videoUrl} k={k} dims={dims} registerVideo={registerVideo} />
      ) : null}
    </div>
  )
}

function PipOverlay({
  pip,
  videoUrl,
  k,
  dims,
  registerVideo,
}: {
  pip: TemplatePipSpec
  videoUrl: string
  k: number
  dims: { w: number; h: number }
  registerVideo: (el: HTMLVideoElement | null) => void
}) {
  const d = pip.dest
  const size = d.w * k
  const left = d.x * k
  const top = d.y * k
  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left,
        top,
        width: size,
        height: size,
        borderRadius: pip.shape === 'circle' ? '50%' : undefined,
      }}
    >
      <video
        ref={registerVideo}
        src={videoUrl}
        style={panelVideoStyle('cover', pip.src, size, size, dims.w, dims.h)}
        muted
        playsInline
        preload="auto"
      />
    </div>
  )
}
