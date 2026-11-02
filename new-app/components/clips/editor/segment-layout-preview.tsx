'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, forwardRef, useCallback } from 'react'
import { MAIN_ANGLE } from '@/lib/clips/editor/multicam-manual'
import { normalizeSegmentLayout, type SourceSegmentLayout } from '@/lib/clips/editor/segment-layout'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { segmentMediaMs, sourceById, type SourceSegment } from '@/lib/clips/editor/sources'
import { corsMediaProps } from '@/components/clips/editor/g4/media-cors'
import { videoTimeFromSourceMs } from '@/lib/clips/editor-playback'
import { cn } from '@/lib/utils'

function partnerUrl(
  partnerId: string,
  edits: ClipEditsV2,
  sourceUrls: Record<string, string> | undefined,
  mainVideoUrl: string | null,
): string | null {
  if (partnerId === 'main' || partnerId === MAIN_ANGLE) return mainVideoUrl
  const src = sourceById(edits.sources, partnerId)
  if (!src || src.mediaType === 'audio') return null
  return sourceUrls?.[src.refId] ?? null
}

export type LayoutPane = {
  partnerId: string
  rect: { l: number; t: number; w: number; h: number }
  testId: string
}

/** Pane geometry mirrors worker media_sources.py (primary first, then layout partners). */
export function layoutPanesForSegment(
  layout: SourceSegmentLayout,
  primarySourceId: string,
): LayoutPane[] {
  const split = layout.split ?? 0.5
  const primary = primarySourceId
  if (layout.kind === 'side_by_side') {
    return [
      { partnerId: primary, rect: { l: 0, t: 0, w: split, h: 1 }, testId: 'preview-layout-pane-0' },
      { partnerId: layout.withSourceId, rect: { l: split, t: 0, w: 1 - split, h: 1 }, testId: 'preview-layout-pane-1' },
    ]
  }
  if (layout.kind === 'stack') {
    return [
      { partnerId: primary, rect: { l: 0, t: 0, w: 1, h: split }, testId: 'preview-layout-pane-0' },
      { partnerId: layout.withSourceId, rect: { l: 0, t: split, w: 1, h: 1 - split }, testId: 'preview-layout-pane-1' },
    ]
  }
  if (layout.kind === 'pip') {
    const scale = layout.pipScale ?? 0.3
    const m = 0.04
    const w = scale
    const h = scale * (9 / 16)
    const corner = layout.pipCorner ?? 'BR'
    let l = m
    let t = m
    if (corner === 'TR' || corner === 'BR') l = 1 - w - m
    if (corner === 'BL' || corner === 'BR') t = 1 - h - m
    return [
      { partnerId: primary, rect: { l: 0, t: 0, w: 1, h: 1 }, testId: 'preview-layout-pane-0' },
      { partnerId: layout.withSourceId, rect: { l, t, w, h }, testId: 'preview-layout-pane-1' },
    ]
  }
  const ids = [primary, layout.withSourceId, layout.withSourceId2 ?? 'main', layout.withSourceId3 ?? primary]
  const cells = [
    { l: 0, t: 0, w: 0.5, h: 0.5 },
    { l: 0.5, t: 0, w: 0.5, h: 0.5 },
    { l: 0, t: 0.5, w: 0.5, h: 0.5 },
    { l: 0.5, t: 0.5, w: 0.5, h: 0.5 },
  ]
  return ids.slice(0, 4).map((partnerId, i) => ({
    partnerId,
    rect: cells[i]!,
    testId: `preview-layout-pane-${i}`,
  }))
}

export function segmentLayoutAtSourceMs(
  edits: ClipEditsV2,
  previewSourceMs: number,
): { seg: SourceSegment; layout: SourceSegmentLayout } | null {
  const segs = edits.sourceSegments ?? []
  for (const seg of segs) {
    if (previewSourceMs < seg.startMs || previewSourceMs >= seg.endMs) continue
    const layout = normalizeSegmentLayout(seg.layout, edits.sources, seg.sourceId)
    if (layout) return { seg, layout }
  }
  return null
}

export function PreviewSegmentLayout({
  edits,
  seg,
  layout,
  previewSourceMs,
  sourceUrls,
  mainVideoUrl,
  mediaOffsetMs,
  playing,
  videoRefsOut,
}: {
  edits: ClipEditsV2
  seg: SourceSegment
  layout: SourceSegmentLayout
  previewSourceMs: number
  sourceUrls?: Record<string, string>
  mainVideoUrl: string | null
  mediaOffsetMs: number
  playing: boolean
  videoRefsOut?: React.MutableRefObject<(HTMLVideoElement | null)[]>
}) {
  const panes = useMemo(() => layoutPanesForSegment(layout, seg.sourceId), [layout, seg.sourceId])
  const innerRefs = useRef<(HTMLVideoElement | null)[]>([])
  const isPip = layout.kind === 'pip'

  useEffect(() => {
    if (videoRefsOut) videoRefsOut.current = innerRefs.current
  })

  const mediaTimeForPane = useCallback(
    (pane: LayoutPane) => {
      const isMain = pane.partnerId === 'main' || pane.partnerId === MAIN_ANGLE
      const srcDef = isMain ? null : sourceById(edits.sources, pane.partnerId)
      if (isMain) return videoTimeFromSourceMs(previewSourceMs, mediaOffsetMs)
      if (!srcDef) return 0
      return segmentMediaMs(seg, srcDef, previewSourceMs) / 1000
    },
    [edits.sources, mediaOffsetMs, previewSourceMs, seg],
  )

  const syncPaneTimes = useCallback(() => {
    panes.forEach((pane, i) => {
      const el = innerRefs.current[i]
      if (!el) return
      const t = mediaTimeForPane(pane)
      if (Number.isFinite(t) && t >= 0 && Math.abs(el.currentTime - t) > 0.08) {
        try {
          el.currentTime = t
        } catch {
          /* metadata pending */
        }
      }
      if (playing && el.paused) void el.play().catch(() => {})
      if (!playing && !el.paused) el.pause()
    })
  }, [mediaTimeForPane, panes, playing])

  useLayoutEffect(() => {
    syncPaneTimes()
  }, [syncPaneTimes])

  useEffect(() => {
    syncPaneTimes()
    const id = window.setInterval(syncPaneTimes, 100)
    return () => window.clearInterval(id)
  }, [syncPaneTimes])

  const gridClass =
    layout.kind === 'side_by_side'
      ? 'grid-cols-2 grid-rows-1'
      : layout.kind === 'stack'
        ? 'grid-cols-1 grid-rows-2'
        : layout.kind === 'grid'
          ? 'grid-cols-2 grid-rows-2'
          : ''

  if (isPip) {
    const [bg, inset] = panes
    return (
      <div className="pointer-events-none absolute inset-0 z-[25] overflow-hidden bg-black" data-testid={`preview-layout-${layout.kind}`}>
        <LayoutPaneVideo
          ref={(el) => {
            innerRefs.current[0] = el
          }}
          url={partnerUrl(bg!.partnerId, edits, sourceUrls, mainVideoUrl)}
          mediaTimeSec={mediaTimeForPane(bg!)}
          className="absolute inset-0 size-full object-cover"
          testId={bg!.testId}
        />
        <LayoutPaneVideo
          ref={(el) => {
            innerRefs.current[1] = el
          }}
          url={partnerUrl(inset!.partnerId, edits, sourceUrls, mainVideoUrl)}
          mediaTimeSec={mediaTimeForPane(inset!)}
          className="absolute rounded border border-white/40 object-cover"
          style={{
            left: `${inset!.rect.l * 100}%`,
            top: `${inset!.rect.t * 100}%`,
            width: `${inset!.rect.w * 100}%`,
            height: `${inset!.rect.h * 100}%`,
          }}
          testId={inset!.testId}
        />
      </div>
    )
  }

  return (
    <div
      className={cn('pointer-events-none absolute inset-0 z-[25] grid gap-px bg-black', gridClass)}
      data-testid={`preview-layout-${layout.kind}`}
    >
      {panes.map((pane, i) => (
        <div key={pane.testId} className="relative min-h-0 min-w-0 overflow-hidden bg-black" data-testid={pane.testId}>
          <LayoutPaneVideo
            ref={(el) => {
              innerRefs.current[i] = el
            }}
            url={partnerUrl(pane.partnerId, edits, sourceUrls, mainVideoUrl)}
            mediaTimeSec={mediaTimeForPane(pane)}
            className="size-full object-cover"
            testId={`${pane.testId}-video`}
          />
        </div>
      ))}
    </div>
  )
}

const LayoutPaneVideo = forwardRef<
  HTMLVideoElement,
  {
    url: string | null
    className?: string
    style?: React.CSSProperties
    testId: string
    mediaTimeSec: number
  }
>(function LayoutPaneVideo({ url, className, style, testId, mediaTimeSec }, ref) {
  const seek = (el: HTMLVideoElement | null) => {
    if (!el || !Number.isFinite(mediaTimeSec) || mediaTimeSec < 0) return
    if (el.readyState >= 1 && Math.abs(el.currentTime - mediaTimeSec) > 0.08) {
      try {
        el.currentTime = mediaTimeSec
      } catch {
        /* ignore */
      }
    }
  }
  const setRef = (el: HTMLVideoElement | null) => {
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
    seek(el)
  }
  if (!url) {
    return <div className={cn(className, 'bg-neutral-900')} data-testid={testId} data-layout-pane="1" style={style} />
  }
  return (
    <video
      ref={setRef}
      {...corsMediaProps(url)}
      src={url}
      className={className}
      style={style}
      muted
      playsInline
      preload="auto"
      data-testid={testId}
      data-own-clock="1"
      data-layout-pane="1"
      onLoadedData={(e) => seek(e.currentTarget)}
      onLoadedMetadata={(e) => seek(e.currentTarget)}
    />
  )
})
