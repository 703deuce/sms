'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TemplatePipSpec, TemplateSpecV2 } from '@/lib/clips/templates/geometry'
import { TITLE_STYLES } from '@/lib/clips/templates/registry'

/**
 * T6.2: observe the element itself (callback-ref state), not a RefObject captured once.
 * The old version kept observing a detached root after a re-key; ResizeObserver then
 * reported 0x0, k became 0 and every panel collapsed (black preview until reload).
 */
function useContainerSize(el: HTMLElement | null) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    if (!el) return
    const apply = (w: number, h: number) => {
      if (w > 0 && h > 0) setSize((s) => (s.w === w && s.h === h ? s : { w, h }))
    }
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (cr) apply(cr.width, cr.height)
    })
    ro.observe(el)
    apply(el.clientWidth, el.clientHeight)
    return () => ro.disconnect()
  }, [el])
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

/**
 * Presentational multi-panel preview — scaled export-parity layout.
 *
 * T6.2 lifecycle rules (do not regress):
 * - No `key` on the root and panels keyed by index: switching templates / dragging boxes only
 *   restyles the existing <video> elements, it never remounts them.
 * - The primary <video> (panel 0) is the ONLY clock. PreviewStage's rAF tick reads/seeks it and
 *   already copies its currentTime to every other <video> under the preview wrapper; this
 *   component only mirrors play/pause. It never seeks the primary (the old `seekTime` prop was
 *   output-time seconds written into media time and pinned playback at 0:00).
 * - `staticPoster` renders <img> panels (template thumbnails) — no extra decoders/connections.
 */
export function TemplateStage({
  spec,
  videoUrl,
  posterUrl,
  onReady,
  onPlay,
  onPause,
  primaryVideoRef,
  staticPoster = false,
  lowResWarning,
}: {
  spec: TemplateSpecV2
  videoUrl?: string | null
  posterUrl?: string | null
  onReady?: () => void
  onPlay?: () => void
  onPause?: () => void
  primaryVideoRef?: React.RefObject<HTMLVideoElement | null>
  /** @deprecated T6.2 — ignored; PreviewStage owns the clock. */
  paused?: boolean
  /** @deprecated T6.2 — ignored; PreviewStage owns the clock. */
  seekTime?: number
  staticPoster?: boolean
  lowResWarning?: boolean
}) {
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null)
  const { w: cw } = useContainerSize(rootEl)
  const [dims, setDims] = useState({ w: 1920, h: 1080 })
  const [primaryEl, setPrimaryEl] = useState<HTMLVideoElement | null>(null)
  const followersRef = useRef<Set<HTMLVideoElement>>(new Set())

  const k = spec.playW > 0 && cw > 0 ? cw / spec.playW : 0

  const registerFollower = useCallback((el: HTMLVideoElement | null) => {
    if (el) followersRef.current.add(el)
  }, [])

  const setPrimary = useCallback(
    (el: HTMLVideoElement | null) => {
      if (primaryVideoRef) {
        ;(primaryVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el
      }
      setPrimaryEl((prev) => (prev === el ? prev : el))
    },
    [primaryVideoRef],
  )

  useEffect(() => {
    const primary = primaryEl
    if (!primary) return
    const mirror = () => {
      for (const v of Array.from(followersRef.current)) {
        if (!v.isConnected) {
          followersRef.current.delete(v)
          continue
        }
        if (Math.abs(v.currentTime - primary.currentTime) > 0.08) v.currentTime = primary.currentTime
        if (primary.paused && !v.paused) v.pause()
        else if (!primary.paused && v.paused) void v.play().catch(() => {})
      }
    }
    primary.addEventListener('play', mirror)
    primary.addEventListener('pause', mirror)
    primary.addEventListener('seeked', mirror)
    mirror()
    return () => {
      primary.removeEventListener('play', mirror)
      primary.removeEventListener('pause', mirror)
      primary.removeEventListener('seeked', mirror)
    }
  }, [primaryEl])

  const onPrimaryLoaded = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const el = e.currentTarget
    if (el.videoWidth > 0) setDims({ w: el.videoWidth, h: el.videoHeight })
    onReady?.()
  }

  if (!videoUrl && !(staticPoster && posterUrl)) {
    return posterUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={posterUrl} alt="" className="size-full object-cover" />
    ) : null
  }

  const media = (style: React.CSSProperties, className: string | undefined, primary: boolean) =>
    staticPoster ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={posterUrl ?? undefined}
        alt=""
        className={className}
        style={style}
        onLoad={
          primary
            ? (e) => {
                const im = e.currentTarget
                if (im.naturalWidth > 0) setDims({ w: im.naturalWidth, h: im.naturalHeight })
              }
            : undefined
        }
      />
    ) : primary ? (
      <video
        ref={setPrimary}
        src={videoUrl ?? undefined}
        className={className}
        style={style}
        playsInline
        preload="auto"
        onLoadedData={onPrimaryLoaded}
        onCanPlay={() => onReady?.()}
        onPlay={() => onPlay?.()}
        onPause={() => onPause?.()}
      />
    ) : (
      <video
        ref={registerFollower}
        src={videoUrl ?? undefined}
        className={className}
        style={style}
        muted
        playsInline
        preload="auto"
      />
    )

  return (
    <div
      ref={setRootEl}
      className="relative size-full overflow-hidden bg-black"
      data-testid="template-stage"
      data-template-id={spec.templateId}
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
        return (
          <div
            key={`band-${i}`}
            className="absolute overflow-hidden"
            style={{ left: d.x * k, top: d.y * k, width: d.w * k, height: d.h * k }}
          >
            {isBlur
              ? media({ filter: 'blur(20px) brightness(0.92)' }, 'size-full scale-110 object-cover', false)
              : <div className="size-full bg-black" />}
          </div>
        )
      })}
      {spec.panels.map((p, i) => {
        const width = p.dest.w * k
        const height = p.dest.h * k
        return (
          <div
            key={`panel-${i}`}
            className="absolute overflow-hidden"
            style={{ left: p.dest.x * k, top: p.dest.y * k, width, height }}
          >
            {p.fit === 'contain_blur'
              ? media(
                  { filter: 'blur(16px) brightness(0.9)' },
                  'absolute inset-0 size-full scale-110 object-cover',
                  false,
                )
              : null}
            {media(panelVideoStyle(p.fit, p.src, width, height, dims.w, dims.h), undefined, i === 0)}
          </div>
        )
      })}
      {spec.pip ? (
        <PipOverlay pip={spec.pip} k={k} dims={dims} render={(style) => media(style, undefined, false)} />
      ) : null}
    </div>
  )
}

function PipOverlay({
  pip,
  k,
  dims,
  render,
}: {
  pip: TemplatePipSpec
  k: number
  dims: { w: number; h: number }
  render: (style: React.CSSProperties) => React.ReactNode
}) {
  const d = pip.dest
  const w = d.w * k
  const h = (d.h || d.w) * k
  return (
    <div
      className="absolute overflow-hidden"
      data-testid="template-pip"
      style={{
        left: d.x * k,
        top: d.y * k,
        width: w,
        height: h,
        borderRadius: pip.shape === 'circle' ? '50%' : 8,
      }}
    >
      {render(panelVideoStyle('cover', pip.src, w, h, dims.w, dims.h))}
    </div>
  )
}

type TitleStyleLite = {
  text?: string
  font?: string
  case?: string
  bg?: { kind?: string; color?: string; radiusPx?: number }
}

/**
 * T6.2: title preview for template mode — mirrors worker clip_export_template._t6_title_burn
 * (spec.titleRect, else a top bar of 384/1920) and the chip's TITLE_STYLES entry.
 */
export function TemplateTitleOverlay({
  spec,
  text,
  styleId,
  boxWidth,
  fontFamily,
}: {
  spec: TemplateSpecV2
  text: string
  styleId?: string | null
  boxWidth: number
  fontFamily?: string
}) {
  if (!text.trim() || boxWidth <= 0 || spec.playW <= 0) return null
  const k = boxWidth / spec.playW
  const r = spec.titleRect && spec.titleRect.h >= 8
    ? spec.titleRect
    : { x: 0, y: 0, w: spec.playW, h: Math.round((384 / 1920) * spec.playH) }
  const st = ((TITLE_STYLES as unknown as Record<string, TitleStyleLite>)[styleId ?? 'white_on_black'] ??
    (TITLE_STYLES as unknown as Record<string, TitleStyleLite>).white_on_black ??
    {}) as TitleStyleLite
  const kind = st.bg?.kind ?? 'band'
  const dark = (st.text ?? '#FFFFFF').toUpperCase() === '#111111' || (st.text ?? '').toUpperCase() === '#000000'
  const display = st.case === 'upper' ? text.toUpperCase() : text
  const w = r.w * k
  const h = r.h * k
  const fontPx = Math.max(10, Math.min(h * 0.38, (w * 0.88) / Math.max(6, display.length * 0.5)))
  const bgStyle: React.CSSProperties =
    kind === 'band'
      ? { backgroundColor: st.bg?.color ?? '#000000' }
      : kind === 'blur'
        ? {
            // T6.3: parity with clip_export_template._t6_title_burn — the blur is tinted so
            // black text always sits on a light backdrop (and white text on a dark one).
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            backgroundColor: dark ? 'rgba(255,255,255,0.62)' : 'rgba(0,0,0,0.45)',
          }
        : {}
  return (
    <div
      className="pointer-events-none absolute z-[26] flex items-center justify-center"
      data-testid="template-title"
      data-title-style={styleId ?? 'white_on_black'}
      style={{ left: r.x * k, top: r.y * k, width: w, height: h, ...bgStyle }}
    >
      <span
        className="text-center font-bold leading-[1.05]"
        style={{
          color: st.text ?? '#FFFFFF',
          fontFamily,
          fontSize: fontPx,
          padding: kind === 'box' ? `${0.14 * h}px ${0.05 * w}px` : `0 ${0.06 * w}px`,
          backgroundColor: kind === 'box' ? st.bg?.color ?? '#FFFFFF' : undefined,
          borderRadius: kind === 'box' ? (st.bg?.radiusPx ?? 0) * k : undefined,
        }}
      >
        {display}
      </span>
    </div>
  )
}
