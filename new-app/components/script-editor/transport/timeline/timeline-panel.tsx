'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'
import {
  buildGapChips,
  buildSourceWordChips,
  buildWordChips,
  groupWordbarItems,
  sourceTimelineClips,
  wordIndicesInOutputRange,
  outputRangeForWordIndices,
} from '@/lib/clips/script-editor/timeline-model'
import type { EdlSegment } from '@/lib/clips/script-edl/types'
import type { SourceCutRegion } from '@/lib/clips/script-editor/cut-regions'
import { TimelineRuler } from '@/components/script-editor/transport/timeline/timeline-ruler'
import { TimelineCaptionsLane } from '@/components/script-editor/transport/timeline/timeline-captions-lane'
import { TimelineScenesStrip } from '@/components/script-editor/transport/timeline/timeline-scenes-strip'
import { TimelineOverlayLane } from '@/components/script-editor/transport/timeline/timeline-overlay-lane'
import { TimelineWordbar } from '@/components/script-editor/transport/timeline/timeline-wordbar'
import { TimelineScriptTrack } from '@/components/script-editor/transport/timeline/timeline-script-track'
import { TimelineMusicLane } from '@/components/script-editor/transport/timeline/timeline-music-lane'
import {
  musicClipsForTimeline,
  overlayClipsForTimeline,
  sceneMarkersForTimeline,
} from '@/lib/clips/script-editor/timeline-lanes'
import { ChevronDown, ChevronUp, LayoutGrid, Maximize2, Rows3, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TimelineMarkersLane } from '@/components/script-editor/markers/timeline-markers-lane'
import type { ReactNode } from 'react'

const LANE_LABEL_W = 56

export function TimelinePanel({
  expanded,
  heightPx,
  document,
  edl,
  orderedWords,
  deletedSet,
  rangeStartMs,
  sourceDurationMs,
  playheadSourceMs,
  cutRegions,
  showDeletedWords,
  videoUrl,
  selectedWordIds,
  selAnchor,
  selEnd,
  pxPerMs,
  scrollLeftPx,
  onToggleExpanded,
  onResizeStart,
  onZoom,
  onFit,
  onScrollLeft,
  onSeekOutput,
  onSelectIndices,
  onPadDragEnd,
  onTrimClipEdge,
  timelineView,
  onTimelineViewChange,
  playheadOutMs,
  outputDurationMs,
  markerToolbarExtra,
}: {
  expanded: boolean
  heightPx: number
  document: ScriptDocumentV1
  edl: EdlSegment[]
  orderedWords: EditorWord[]
  deletedSet: Set<string>
  rangeStartMs: number
  sourceDurationMs: number
  playheadSourceMs: number
  cutRegions: SourceCutRegion[]
  showDeletedWords: boolean
  videoUrl: string | null
  selectedWordIds: Set<string>
  selAnchor: number | null
  selEnd: number | null
  pxPerMs: number
  scrollLeftPx: number
  onToggleExpanded: () => void
  onResizeStart: (e: React.MouseEvent) => void
  onZoom: (factor: number, anchorOutMs: number) => void
  onFit: () => void
  onScrollLeft: (px: number) => void
  onSeekOutput: (outMs: number) => void
  onSelectIndices: (lo: number, hi: number) => void
  onPadDragEnd?: (wordId: string, padMs: number) => void
  onTrimClipEdge?: (clipKey: string, edge: 'start' | 'end', deltaOutMs: number) => void
  timelineView?: 'timeline' | 'storyboard'
  onTimelineViewChange?: (v: 'timeline' | 'storyboard') => void
  playheadOutMs?: number
  outputDurationMs?: number
  markerToolbarExtra?: ReactNode
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const span = Math.max(
    1,
    sourceDurationMs,
    edl.reduce((m, s) => (s.kind === 'source' ? Math.max(m, s.outOutMs) : Math.max(m, s.outInMs + s.durMs)), 0),
  )
  const widthPx = span * pxPerMs

  const chips = useMemo(
    () => buildWordChips(document, orderedWords, edl, deletedSet),
    [document, orderedWords, edl, deletedSet],
  )
  const sourceChips = useMemo(
    () => buildSourceWordChips(orderedWords, deletedSet, rangeStartMs),
    [orderedWords, deletedSet, rangeStartMs],
  )
  const wordbarChips = useMemo(
    () => (showDeletedWords ? chips : chips.filter((c) => !c.deleted)),
    [chips, showDeletedWords],
  )
  const wordbarItems = useMemo(() => groupWordbarItems(wordbarChips, pxPerMs), [wordbarChips, pxPerMs])
  const gapChips = useMemo(
    () =>
      buildGapChips(edl).map((g) => ({
        outStartMs: g.outStartMs,
        outEndMs: g.outEndMs,
        label: `${(g.durMs / 1000).toFixed(1)}s`,
      })),
    [edl],
  )
  const clips = useMemo(
    () => sourceTimelineClips(orderedWords, deletedSet, rangeStartMs, span),
    [orderedWords, deletedSet, rangeStartMs, span],
  )
  const sceneMarkers = useMemo(
    () => sceneMarkersForTimeline(document, orderedWords, edl),
    [document, orderedWords, edl],
  )
  const overlayClips = useMemo(() => overlayClipsForTimeline(document), [document])
  const musicClips = useMemo(() => musicClipsForTimeline(document), [document])
  const overlayLayerCount = Math.max(1, ...overlayClips.map((c) => c.layer + 1), 1)

  const selectionOutRange = useMemo(() => {
    if (selAnchor == null || selEnd == null) return null
    const range = outputRangeForWordIndices(
      chips,
      orderedWords,
      Math.min(selAnchor, selEnd),
      Math.max(selAnchor, selEnd),
    )
    if (!range) return null
    return { lo: range.outLo, hi: range.outHi }
  }, [selAnchor, selEnd, chips, orderedWords])

  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollLeft = scrollLeftPx
  }, [scrollLeftPx])

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault()
        const rect = scrollerRef.current?.getBoundingClientRect()
        const x = rect ? e.clientX - rect.left + scrollLeftPx - LANE_LABEL_W : span / 2
        const anchorOut = Math.max(0, x / pxPerMs)
        onZoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, anchorOut)
        return
      }
      if (e.shiftKey) {
        e.preventDefault()
        onScrollLeft(scrollLeftPx + e.deltaY)
      }
    },
    [onScrollLeft, onZoom, pxPerMs, scrollLeftPx, span],
  )

  return (
    <div className="flex shrink-0 flex-col border-t border-border bg-background" style={{ height: expanded ? heightPx : 44 }}>
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border/60 px-2">
        <Button type="button" size="icon-sm" variant="ghost" onClick={onToggleExpanded} title="Toggle timeline (Ctrl+Alt+T)">
          {expanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={() => onZoom(1.15, playheadSourceMs)} title="Zoom in">
          <ZoomIn className="size-4" />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={() => onZoom(1 / 1.15, playheadSourceMs)} title="Zoom out">
          <ZoomOut className="size-4" />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={onFit} title="Fit composition">
          <Maximize2 className="size-4" />
        </Button>
        {onTimelineViewChange && (
          <div className="flex h-7 overflow-hidden rounded-lg border border-border">
            <Button
              type="button"
              size="icon-sm"
              variant={timelineView === 'timeline' ? 'secondary' : 'ghost'}
              className="h-7 w-8 rounded-none"
              title="Timeline view"
              data-testid="timeline-view-timeline"
              onClick={() => onTimelineViewChange('timeline')}
            >
              <Rows3 className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant={timelineView === 'storyboard' ? 'secondary' : 'ghost'}
              className="h-7 w-8 rounded-none"
              title="Storyboard view"
              data-testid="timeline-view-storyboard"
              onClick={() => onTimelineViewChange('storyboard')}
            >
              <LayoutGrid className="size-4" />
            </Button>
          </div>
        )}
        {markerToolbarExtra}
        <div
          role="separator"
          aria-orientation="horizontal"
          className="ml-auto h-6 w-16 cursor-row-resize rounded bg-border/50 hover:bg-primary/30"
          title="Resize timeline"
          onMouseDown={onResizeStart}
        />
      </div>
      {expanded && (
        <div
          ref={scrollerRef}
          data-timeline-scroller
          className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden"
          onWheel={onWheel}
        >
          <div className="relative flex min-h-full" style={{ width: widthPx + LANE_LABEL_W }}>
            <div className="sticky left-0 z-20 w-14 shrink-0 border-r border-border/60 bg-background text-[10px] text-muted-foreground">
              <div className="flex h-6 items-center px-1">Ruler</div>
              <div className="flex h-7 items-center px-1">Markers</div>
              <div className="flex h-7 items-center px-1">Scenes</div>
              <div className="flex h-6 items-center px-1">Captions</div>
              {Array.from({ length: overlayLayerCount }, (_, i) => (
                <div key={`ol-${i}`} className="flex h-6 items-center px-1">
                  {i === 0 ? 'Overlay' : `O-${i + 1}`}
                </div>
              ))}
              <div className="flex h-6 items-center px-1">Words</div>
              <div className="flex min-h-[64px] items-start px-1 pt-2">Script</div>
              <div className="flex h-6 items-center px-1 pb-1">Music</div>
            </div>
            <div className="relative min-w-0 flex-1" style={{ width: widthPx }}>
              <TimelineRuler durationMs={span} pxPerMs={pxPerMs} widthPx={widthPx} onSeekOutput={onSeekOutput} />
              <TimelineMarkersLane document={document} widthPx={widthPx} pxPerMs={pxPerMs} onSeek={onSeekOutput} />
              {cutRegions.map((cut) => (
                <div
                  key={`cut-${cut.loMs}-${cut.wordIds[0]}`}
                  className="pointer-events-none absolute top-6 bottom-0 z-[5] border-l-2 border-red-500/90 bg-red-500/10"
                  style={{
                    left: cut.loMs * pxPerMs,
                    width: Math.max(2, (cut.hiMs - cut.loMs) * pxPerMs),
                  }}
                  title="Cut region"
                />
              ))}
              <TimelineScenesStrip
                widthPx={widthPx}
                pxPerMs={pxPerMs}
                scenes={sceneMarkers}
                onSeekOutput={onSeekOutput}
              />
              <TimelineCaptionsLane widthPx={widthPx} />
              {Array.from({ length: overlayLayerCount }, (_, i) => (
                <TimelineOverlayLane key={i} widthPx={widthPx} pxPerMs={pxPerMs} clips={overlayClips} layerIndex={i} />
              ))}
              <TimelineWordbar
                items={wordbarItems}
                gapChips={gapChips}
                cutRegions={cutRegions}
                pxPerMs={pxPerMs}
                widthPx={widthPx}
                selectedWordIds={selectedWordIds}
                ghostWordIds={showDeletedWords ? deletedSet : undefined}
                onSelectWord={(wordId) => {
                  const idx = orderedWords.findIndex((w) => w.id === wordId)
                  if (idx >= 0) onSelectIndices(idx, idx)
                }}
                onPadDragEnd={onPadDragEnd}
              />
              <TimelineScriptTrack
                clips={clips}
                cutRegions={cutRegions}
                pxPerMs={pxPerMs}
                widthPx={widthPx}
                durationMs={span}
                videoUrl={videoUrl}
                selectionOutRange={selectionOutRange}
                onSelectOutputRange={(lo, hi) => {
                  const range = wordIndicesInOutputRange(chips, orderedWords, lo, hi)
                  if (range) onSelectIndices(range.lo, range.hi)
                }}
                onTrimClipEdge={onTrimClipEdge}
              />
              <TimelineMusicLane widthPx={widthPx} pxPerMs={pxPerMs} clips={musicClips} />
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-sky-500"
                style={{ left: playheadSourceMs * pxPerMs }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
