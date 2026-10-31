'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import type { BrollItem } from '@/lib/clips/broll'
import { BROLL_MIN_MS } from '@/lib/clips/broll'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { keepSegments, normalizeSectionOrder, wordDisplayText } from '@/lib/clips/edits'
import { clampTrimToExtendedBounds, clampTrimWithMediaBounds, extendedTrimLimits } from '@/lib/clips/trim-bounds'
import { buildCaptionWords } from '@/lib/clips/caption-words'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import type { SourceWord } from '@/lib/clips/source-words'
import { wordSourceMs } from '@/lib/clips/source-words'
import { layoutModeAtSourceMs } from '@/lib/clips/layout-segments'
import { shotIndexAt } from '@/lib/clips/crop-shots'
import type { CropShot } from '@/lib/server/clips/clip-detail'
import { AudioWaveformLane } from '@/components/clips/editor/audio-waveform-lane'
import {
  TIMELINE_DEFAULT_PX_PER_SEC,
  TIMELINE_MIN_LABEL_PX,
  anchoredScrollLeft,
  autoscrollLeftForPlayhead,
  fitPxPerSec,
  initialPxPerSec,
  outputMsToSourceMs,
  pxPerSecToSlider,
  sliderToPxPerSec,
  sourceMsToTrackPct,
  trackWidthPx,
  zoomBy,
  zoomPercent,
} from '@/lib/clips/editor/timeline-zoom'

/** Lane label column (w-14 = 56px) + container left padding (p-2 = 8px). */
const TRACK_OFFSET_PX = 64
/** Label column + left and right padding. */
const TRACK_EXTRA_PX = 72

export function Timeline({
  edits,
  words,
  shots,
  outputMs,
  clipOutputDurationMs,
  videoUrl = null,
  onSeekOutput,
  onTrimChange,
  onBrollChange,
  clipStartMs,
  clipEndMs,
  mediaMinMs,
  mediaMaxMs,
  trimMinMs,
  trimMaxMs,
  onSplitLayout,
  onCutSection,
  onSetLayoutMode,
}: {
  edits: ClipEditsV2
  words: SourceWord[]
  shots: CropShot[]
  outputMs: number
  clipOutputDurationMs: number
  videoUrl?: string | null
  onSeekOutput: (outputMs: number) => void
  onTrimChange: (trim: { in: number; out: number }) => void
  onBrollChange?: (id: string, patch: Partial<Pick<BrollItem, 'startMs' | 'endMs'>>) => void
  clipStartMs: number
  clipEndMs: number
  mediaMinMs?: number
  mediaMaxMs?: number
  trimMinMs?: number
  trimMaxMs?: number
  onSplitLayout?: () => void
  onCutSection?: () => void
  onSetLayoutMode?: (mode: ClipEditsV2['layout']['mode']) => void
}) {
  const previewEdits = useMemo(() => editorPreviewEdits(edits, words), [edits, words])
  const span = Math.max(1, previewEdits.trim.out - previewEdits.trim.in)
  const trimLimits = useMemo(() => {
    const min = trimMinMs ?? mediaMinMs
    const max = trimMaxMs ?? mediaMaxMs
    if (min != null && max != null) return { minMs: min, maxMs: max }
    return undefined
  }, [mediaMaxMs, mediaMinMs, trimMaxMs, trimMinMs])
  const { minInMs, maxOutMs } = extendedTrimLimits(clipStartMs, clipEndMs, trimLimits)
  const clampTrim = (next: { in: number; out: number }) =>
    clampTrimWithMediaBounds(clipStartMs, clipEndMs, next, mediaMinMs, mediaMaxMs, trimLimits)
  const aiInPct = ((clipStartMs - previewEdits.trim.in) / span) * 100
  const aiOutPct = ((clipEndMs - previewEdits.trim.in) / span) * 100
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [viewportPx, setViewportPx] = useState(0)
  const [pxPerSec, setPxPerSec] = useState<number | null>(null)
  const pendingScrollRef = useRef<number | null>(null)
  const trackViewportPx = Math.max(0, viewportPx - TRACK_EXTRA_PX)
  const effectivePxPerSec = pxPerSec ?? TIMELINE_DEFAULT_PX_PER_SEC
  const widthPx = trackWidthPx(span, effectivePxPerSec, trackViewportPx)
  const widthRef = useRef(widthPx)
  widthRef.current = widthPx
  const captionByI = new Map(buildCaptionWords(words, previewEdits).map((c) => [c.i, c]))

  const outputToSource = (outMs: number) =>
    outputMsToSourceMs(
      outMs,
      keepSegments(previewEdits.trim.in, previewEdits.trim.out, previewEdits.cutRanges),
      previewEdits.trim.out,
    )
  // Playhead is drawn on the SOURCE-span track (same space as word chips), not output %.
  const playheadPct = sourceMsToTrackPct(outputToSource(outputMs), previewEdits.trim.in, span)
  const playheadPx = (playheadPct / 100) * widthPx
  const playheadPxRef = useRef(playheadPx)
  playheadPxRef.current = playheadPx
  const pxPerSecRef = useRef(effectivePxPerSec)
  pxPerSecRef.current = effectivePxPerSec

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setViewportPx(el.clientWidth)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (pxPerSec == null && trackViewportPx > 0) setPxPerSec(initialPxPerSec(span, trackViewportPx))
  }, [pxPerSec, span, trackViewportPx])

  const applyZoom = useCallback(
    (nextPxPerSec: number, anchorX?: number) => {
      const el = scrollRef.current
      const prevW = widthRef.current
      const nextW = trackWidthPx(span, nextPxPerSec, trackViewportPx)
      if (el) {
        const playheadAnchor = TRACK_OFFSET_PX + playheadPxRef.current - el.scrollLeft
        const anchor =
          anchorX ??
          (playheadAnchor >= 0 && playheadAnchor <= el.clientWidth ? playheadAnchor : el.clientWidth / 2)
        pendingScrollRef.current = anchoredScrollLeft({
          scrollLeft: el.scrollLeft,
          anchorX: anchor,
          prevWidthPx: prevW,
          nextWidthPx: nextW,
          viewportPx: el.clientWidth,
          offsetPx: TRACK_OFFSET_PX,
          extraPx: TRACK_EXTRA_PX,
        })
      }
      setPxPerSec(nextPxPerSec)
    },
    [span, trackViewportPx],
  )

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || pendingScrollRef.current == null) return
    el.scrollLeft = pendingScrollRef.current
    pendingScrollRef.current = null
  }, [widthPx])

  const zoomIn = () => applyZoom(zoomBy(effectivePxPerSec, 'in'))
  const zoomOut = () => applyZoom(zoomBy(effectivePxPerSec, 'out'))
  const zoomFit = () => {
    pendingScrollRef.current = 0
    setPxPerSec(fitPxPerSec(span, trackViewportPx))
  }
  const zoomDefault = () => applyZoom(TIMELINE_DEFAULT_PX_PER_SEC)

  // Ctrl/Cmd + wheel zooms around the cursor (non-passive so the page does not zoom).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      applyZoom(zoomBy(pxPerSecRef.current, e.deltaY < 0 ? 'in' : 'out', 1.12), e.clientX - rect.left)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [applyZoom])

  // Keep the playhead in view while playing / after seeks (page-style jump).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const next = autoscrollLeftForPlayhead({
      playheadPx: TRACK_OFFSET_PX + playheadPx,
      scrollLeft: el.scrollLeft,
      viewportPx: el.clientWidth,
      trackWidthPx: widthPx + TRACK_EXTRA_PX,
    })
    if (next != null) el.scrollLeft = next
  }, [playheadPx, widthPx])

  const seekTimelineAtClientX = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0) return
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const sourceMs = previewEdits.trim.in + pct * span
    onSeekOutput(remapSourceToOutput(sourceMs, previewEdits))
  }

  const broll = edits.broll || []
  const reorderNote = Boolean(
    (edits.broll?.length ?? 0) > 0 &&
      normalizeSectionOrder(edits.sectionOrder, edits.trim.in, edits.trim.out),
  )
  const audio = edits.audio
  const outSpan = Math.max(1, clipOutputDurationMs)

  const layoutSegs = edits.layout.layoutSegments || []
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const segmentModeAtPlayhead = layoutModeAtSourceMs(edits, outputToSource(outputMs))

  useEffect(() => {
    if (!ctx) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtx(null)
    }
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setCtx(null)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
    }
  }, [ctx])
  const layoutModes: ClipEditsV2['layout']['mode'][] = [
    'speaker_follow',
    'split',
    'fit_blur',
    'center_crop',
    'screen_pip',
    'dynamic',
  ]
  const lanes = [
    { key: 'video', label: 'Video', top: 32, h: 32 },
    { key: 'layout', label: 'Layout', top: 68, h: 14 },
    { key: 'audio', label: 'Audio', top: 96, h: 20 },
    { key: 'broll', label: 'B-roll', top: 120, h: 24 },
  ] as const

  return (
    <div className="min-w-0 space-y-2">
      {reorderNote ? (
        <p className="text-xs text-muted-foreground">
          Section reorder is active — B-roll clips stay at their output times and may not match moved speech.
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-1" data-testid="timeline-zoom-controls">
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={zoomOut}
          aria-label="Zoom out timeline"
          title="Zoom out (-)"
          data-testid="timeline-zoom-out"
        >
          <ZoomOut className="size-4" />
        </button>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={pxPerSecToSlider(effectivePxPerSec)}
          onChange={(e) => applyZoom(sliderToPxPerSec(Number(e.target.value)))}
          className="h-1 w-24 cursor-pointer accent-primary"
          aria-label="Timeline zoom"
          data-testid="timeline-zoom-slider"
        />
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={zoomIn}
          aria-label="Zoom in timeline"
          title="Zoom in (+ or Ctrl/Cmd + scroll)"
          data-testid="timeline-zoom-in"
        >
          <ZoomIn className="size-4" />
        </button>
        <button
          type="button"
          className="min-w-[3rem] rounded px-1.5 py-1 text-[11px] tabular-nums text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={zoomDefault}
          title="Reset zoom to 100%"
          data-testid="timeline-zoom-label"
        >
          {zoomPercent(effectivePxPerSec)}%
        </button>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded px-1.5 text-[11px] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={zoomFit}
          aria-label="Fit timeline to view"
          title="Fit to view (0)"
          data-testid="timeline-zoom-fit"
        >
          <Maximize2 className="size-3.5" />
          Fit
        </button>
      </div>
    <div
      ref={scrollRef}
      className="min-w-0 overflow-x-auto rounded-lg border border-border bg-card/30 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      tabIndex={0}
      aria-label="Timeline (+/- to zoom, 0 to fit)"
      data-testid="timeline-scroll"
      data-px-per-sec={Math.round(effectivePxPerSec)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === '+' || e.key === '=') {
          e.preventDefault()
          zoomIn()
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault()
          zoomOut()
        } else if (e.key === '0') {
          e.preventDefault()
          zoomFit()
        }
      }}
    >
      <div className="flex" style={{ width: widthPx + 56 }}>
        <div className="relative w-14 shrink-0 text-[10px] font-medium text-muted-foreground">
          {lanes.map((lane) => (
            <span
              key={lane.key}
              className="absolute left-0 flex items-center"
              style={{ top: lane.top, height: lane.h }}
            >
              {lane.label}
            </span>
          ))}
        </div>
        <div
          className="relative h-[9.5rem] shrink-0 cursor-pointer"
          style={{ width: widthPx }}
          role="presentation"
          data-testid="timeline-track"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button')) return
            seekTimelineAtClientX(e.clientX, e.currentTarget)
          }}
          onContextMenu={(e) => {
            if (!onSplitLayout) return
            e.preventDefault()
            setCtx({ x: e.clientX, y: e.clientY })
          }}
        >
        <div
          className="pointer-events-none absolute top-8 bottom-6 border-x border-dashed border-primary/40"
          style={{
            left: `${Math.max(0, Math.min(100, aiInPct))}%`,
            width: `${Math.max(0.5, Math.min(100, aiOutPct - aiInPct))}%`,
          }}
          title="Original AI clip bounds"
          aria-hidden
        />
        <div className="absolute inset-x-0 top-8 h-8 rounded bg-muted" role="group" aria-label="Transcript timeline">
          {words.map((w) => {
            const { startMs, endMs } = wordSourceMs(w)
            if (endMs < previewEdits.trim.in || startMs > previewEdits.trim.out) return null
            const left = ((startMs - previewEdits.trim.in) / span) * 100
            const wPct = ((endMs - startMs) / span) * 100
            const shotI = shotIndexAt(shots, (startMs + endMs) / 2)
            const bg = shotI % 2 === 0 ? 'bg-sky-500/70' : 'bg-violet-500/70'
            const chipPx = ((endMs - startMs) / span) * widthPx
            const label = captionByI.get(w.i)?.text ?? wordDisplayText(w, edits.wordFixes)
            return (
              <button
                key={w.i}
                type="button"
                data-testid="timeline-word"
                className={`absolute top-1 h-6 overflow-hidden whitespace-nowrap rounded px-0.5 text-left text-[11px] leading-6 text-white ${bg}`}
                style={{ left: `${left}%`, width: `${Math.max(wPct, 0.4)}%` }}
                onClick={(ev) => {
                  ev.stopPropagation()
                  onSeekOutput(remapSourceToOutput(startMs, previewEdits))
                }}
                title={wordDisplayText(w, edits.wordFixes)}
              >
                {chipPx >= TIMELINE_MIN_LABEL_PX ? label : null}
              </button>
            )
          })}
        </div>
        <div className="absolute inset-x-0 top-[68px] h-3.5 rounded bg-muted/90" aria-label="Layout segments">
          {layoutSegs.map((seg, i) => {
            const left = ((seg.startMs - edits.trim.in) / span) * 100
            const wPct = ((seg.endMs - seg.startMs) / span) * 100
            const tint =
              seg.mode === 'split'
                ? 'bg-violet-500/70'
                : seg.mode === 'fit_blur'
                  ? 'bg-amber-500/70'
                  : 'bg-sky-500/70'
            return (
              <div
                key={`${seg.startMs}-${i}`}
                className={`absolute top-0.5 h-2.5 truncate rounded px-0.5 text-[8px] text-white ${tint}`}
                style={{ left: `${left}%`, width: `${Math.max(wPct, 0.5)}%` }}
                title={`${seg.mode} (${seg.startMs}–${seg.endMs} ms)`}
              >
                {seg.mode.replace(/_/g, ' ')}
              </div>
            )
          })}
        </div>
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-red-500"
          style={{ left: `${playheadPct}%` }}
          data-testid="timeline-playhead"
          aria-hidden
        />
        <TrimHandle
          label="In"
          ms={edits.trim.in}
          span={span}
          trimIn={edits.trim.in}
          minMs={minInMs}
          maxMs={maxOutMs}
          onChange={(inMs) =>
            onTrimChange(clampTrim({ in: inMs, out: Math.max(inMs + 500, edits.trim.out) }))
          }
        />
        <TrimHandle
          label="Out"
          ms={edits.trim.out}
          span={span}
          trimIn={edits.trim.in}
          minMs={minInMs}
          maxMs={maxOutMs}
          onChange={(outMs) =>
            onTrimChange(clampTrim({ in: Math.min(outMs - 500, edits.trim.in), out: outMs }))
          }
        />
        <div className="absolute inset-x-0 top-[96px] h-5 overflow-hidden rounded bg-emerald-950/40">
          <AudioWaveformLane videoUrl={videoUrl} className="absolute inset-0 size-full text-emerald-400/90" />
          {audio?.music && (
            <div
              className="pointer-events-none absolute top-0.5 h-4 rounded bg-emerald-500/40 mix-blend-screen"
              style={{ left: 0, width: '100%' }}
              title="Music"
            />
          )}
          {(audio?.sfx || []).map((s) => {
            const left = (s.atMs / outSpan) * 100
            return (
              <div
                key={s.generationId}
                className="absolute top-0.5 h-4 w-1 rounded bg-amber-400"
                style={{ left: `${left}%` }}
                title={`SFX @ ${s.atMs}ms`}
              />
            )
          })}
        </div>
        <div className="absolute inset-x-0 top-[120px] h-6 rounded bg-muted/80">
          {broll.map((item) => {
            const left = (item.startMs / outSpan) * 100
            const wPct = ((item.endMs - item.startMs) / outSpan) * 100
            const color = item.source === 'ai' ? 'bg-sky-500/80' : 'bg-neutral-500/80'
            return (
              <BrollBar
                key={item.id}
                className={color}
                leftPct={left}
                widthPct={wPct}
                item={item}
                outSpan={outSpan}
                onChange={onBrollChange}
              />
            )
          })}
        </div>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Right-click the timeline: split layout, delete a section (cut), or set layout for this segment. Drag In/Out up to 8s beyond the dashed AI bounds.
      </p>
      {ctx && onSplitLayout ? (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[200px] rounded-md border border-border bg-popover p-1 text-xs shadow-lg"
          style={{ left: ctx.x, top: ctx.y }}
          role="menu"
          aria-label="Timeline segment actions"
        >
          <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground">At playhead</p>
          <button
            type="button"
            className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            role="menuitem"
            onClick={() => {
              onSplitLayout()
              setCtx(null)
            }}
          >
            Split layout here
          </button>
          {onCutSection ? (
            <button
              type="button"
              className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              role="menuitem"
              onClick={() => {
                onCutSection()
                setCtx(null)
              }}
            >
              Delete section (cut)
            </button>
          ) : null}
          {onSetLayoutMode ? (
            <>
              <div className="my-1 border-t border-border" role="separator" />
              <p className="px-2 py-1 text-[10px] text-muted-foreground">
                Layout for this segment
                <span className="block font-normal text-foreground">
                  Current: {segmentModeAtPlayhead.replace(/_/g, ' ')}
                </span>
              </p>
              {layoutModes.map((m) => {
                const active = m === segmentModeAtPlayhead
                return (
                  <button
                    key={m}
                    type="button"
                    className={`block w-full rounded px-2 py-1.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-muted/80 font-medium' : ''}`}
                    role="menuitem"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => {
                      onSetLayoutMode(m)
                      setCtx(null)
                    }}
                  >
                    {m.replace(/_/g, ' ')}
                    {active ? ' · selected' : ''}
                  </button>
                )
              })}
            </>
          ) : null}
          <div className="my-1 border-t border-border" role="separator" />
          <button
            type="button"
            className="block w-full rounded px-2 py-1.5 text-left text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setCtx(null)}
          >
            Close
          </button>
        </div>
      ) : null}
    </div>
    </div>
  )
}

function BrollBar({
  item,
  leftPct,
  widthPct,
  className,
  outSpan,
  onChange,
}: {
  item: BrollItem
  leftPct: number
  widthPct: number
  className: string
  outSpan: number
  onChange?: (id: string, patch: Partial<Pick<BrollItem, 'startMs' | 'endMs'>>) => void
}) {
  const drag = (mode: 'move' | 'start' | 'end', e: React.MouseEvent) => {
    if (!onChange) return
    e.preventDefault()
    const startX = e.clientX
    const start = { ...item }
    const parent = (e.target as HTMLElement).parentElement
    const onMove = (ev: MouseEvent) => {
      const w = parent?.clientWidth ?? 640
      const deltaMs = ((ev.clientX - startX) / w) * outSpan
      if (mode === 'move') {
        const len = start.endMs - start.startMs
        let s = Math.round(start.startMs + deltaMs)
        s = Math.max(0, Math.min(outSpan - len, s))
        onChange(item.id, { startMs: s, endMs: s + len })
      } else if (mode === 'start') {
        const s = Math.max(0, Math.min(start.endMs - BROLL_MIN_MS, Math.round(start.startMs + deltaMs)))
        onChange(item.id, { startMs: s })
      } else {
        const end = Math.max(start.startMs + BROLL_MIN_MS, Math.min(outSpan, Math.round(start.endMs + deltaMs)))
        onChange(item.id, { endMs: end })
      }
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      className={`absolute top-1 h-4 rounded ${className}`}
      style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 0.5)}%` }}
      onMouseDown={(e) => drag('move', e)}
    >
      <span className="absolute left-0 top-0 h-full w-1 cursor-ew-resize" onMouseDown={(e) => drag('start', e)} />
      <span className="absolute right-0 top-0 h-full w-1 cursor-ew-resize" onMouseDown={(e) => drag('end', e)} />
    </div>
  )
}

function remapSourceToOutput(sourceMs: number, edits: ClipEditsV2) {
  const segs = keepSegments(edits.trim.in, edits.trim.out, edits.cutRanges)
  let acc = 0
  for (const [a, b] of segs) {
    if (sourceMs >= a && sourceMs < b) return acc + (sourceMs - a)
    acc += b - a
  }
  return acc
}

function TrimHandle({
  label,
  ms,
  span,
  trimIn,
  minMs,
  maxMs,
  onChange,
}: {
  label: string
  ms: number
  span: number
  trimIn: number
  minMs: number
  maxMs: number
  onChange: (ms: number) => void
}) {
  const [dragMs, setDragMs] = useState<number | null>(null)
  const displayMs = dragMs ?? ms
  return (
    <button
      type="button"
      className="absolute top-16 -translate-x-1/2 rounded border border-border bg-background px-1 text-[10px] shadow"
      style={{ left: `${((displayMs - trimIn) / span) * 100}%` }}
      onMouseDown={(e) => {
        e.preventDefault()
        const startX = e.clientX
        const startMs = displayMs
        let latestMs = startMs
        const onMove = (ev: MouseEvent) => {
          const parent = (e.target as HTMLElement).parentElement
          const w = parent?.clientWidth ?? 640
          const delta = ((ev.clientX - startX) / w) * span
          latestMs = Math.round(startMs + delta)
          latestMs = Math.max(minMs, Math.min(maxMs, latestMs))
          setDragMs(latestMs)
        }
        const onUp = () => {
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
          setDragMs(null)
          onChange(latestMs)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
      }}
    >
      {label}
    </button>
  )
}
