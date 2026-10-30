'use client'

import { useEffect, useRef, useState } from 'react'
import type { TemplateSpecV2 } from '@/lib/clips/templates/geometry'

function coverStyle(
  src: { x: number; y: number; w: number; h: number },
  panelW: number,
  panelH: number,
  videoW: number,
  videoH: number,
): React.CSSProperties {
  const scale = Math.max(panelW / (src.w * videoW), panelH / (src.h * videoH))
  const elW = videoW * scale
  const elH = videoH * scale
  const left = -(src.x * videoW * scale) - (src.w * videoW * scale - panelW) / 2
  const top = -(src.y * videoH * scale) - (src.h * videoH * scale - panelH) / 2
  return {
    position: 'absolute',
    width: elW,
    height: elH,
    left,
    top,
    maxWidth: 'none',
  }
}

/** Presentational multi-panel preview (P2) — export-parity cover math. */
export function TemplateStage({
  spec,
  videoUrl,
  posterUrl,
  onReady,
}: {
  spec: TemplateSpecV2
  videoUrl?: string | null
  posterUrl?: string | null
  onReady?: () => void
}) {
  const [dims, setDims] = useState({ w: 1920, h: 1080 })
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = ref.current
    if (!v || !videoUrl) return
    const sync = () => {
      if (v.videoWidth > 0) setDims({ w: v.videoWidth, h: v.videoHeight })
      onReady?.()
    }
    v.addEventListener('loadeddata', sync)
    sync()
    return () => v.removeEventListener('loadeddata', sync)
  }, [videoUrl, onReady])

  if (!videoUrl) {
    return posterUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={posterUrl} alt="" className="size-full object-cover" />
    ) : null
  }

  const scale = spec.playW > 0 ? 1 : 1

  return (
    <div
      className="relative size-full overflow-hidden bg-black"
      data-testid="template-stage"
      style={{ aspectRatio: `${spec.playW}/${spec.playH}` }}
    >
      <video ref={ref} src={videoUrl} className="hidden" muted playsInline preload="auto" />
      {(spec.bands as { dest?: { x: number; y: number; w: number; h: number }; fill?: string }[]).map(
        (band, i) => {
          const d = band.dest
          if (!d) return null
          const isBlur = band.fill === 'blur' || band.fill === 'dark_gradient'
          return (
            <div
              key={`band-${i}`}
              className="absolute overflow-hidden"
              style={{
                left: (d.x / spec.playW) * 100 * scale,
                top: (d.y / spec.playH) * 100,
                width: (d.w / spec.playW) * 100,
                height: (d.h / spec.playH) * 100,
              }}
            >
              {isBlur ? (
                <video
                  src={videoUrl}
                  className="size-full scale-110 object-cover blur-2xl"
                  style={{ filter: 'blur(20px) brightness(0.92)' }}
                  muted
                  playsInline
                />
              ) : (
                <div className="size-full bg-black" />
              )}
            </div>
          )
        },
      )}
      {spec.panels.map((p, i) => (
        <div
          key={i}
          className="absolute overflow-hidden"
          style={{
            left: `${(p.dest.x / spec.playW) * 100}%`,
            top: `${(p.dest.y / spec.playH) * 100}%`,
            width: `${(p.dest.w / spec.playW) * 100}%`,
            height: `${(p.dest.h / spec.playH) * 100}%`,
          }}
        >
          <video
            src={videoUrl}
            style={coverStyle(p.src, p.dest.w, p.dest.h, dims.w, dims.h)}
            muted
            playsInline
          />
        </div>
      ))}
    </div>
  )
}
