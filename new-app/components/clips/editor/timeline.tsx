'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { TimelineInsertMarkers } from '@/components/clips/editor/timeline-insert-markers'
import { Blend, Magnet, Maximize2, Redo2, Scissors, Trash2, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import { toast } from 'sonner'
import type { BrollItem } from '@/lib/clips/broll'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { wordDisplayText } from '@/lib/clips/edits'
import { clampTrimWithMediaBounds } from '@/lib/clips/trim-bounds'
import { buildCaptionWords } from '@/lib/clips/caption-words'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import { wordSourceMs, type SourceWord } from '@/lib/clips/source-words'
import { layoutModeAtSourceMs } from '@/lib/clips/layout-segments'
import { shotIndexAt } from '@/lib/clips/crop-shots'
import type { CropShot } from '@/lib/server/clips/clip-detail'
import { groupWordbarItems, type TimelineWordChip } from '@/lib/clips/script-editor/timeline-model'
import {
  LANE_LABELS,
  LANE_ORDER,
  arrowStepMs,
  buildTimelineItems,
  deleteItems,
  joinVideoSplits,
  laneState,
  moveItems,
  outputToSource,
  realCutIndices,
  refKey,
  setLaneState,
  snapMoveDelta,
  snapTargets,
  snapValue,
  sourceToOutput,
  splitAt,
  splitNoopMessage,
  timebaseFor,
  trimItem,
  type ItemRef,
  type LaneId,
  type OpCtx,
  type TimelineItem,
  videoJoinOptions,
} from '@/lib/clips/editor/clip-timeline'
import { CUT_HANDLE_ROW_TOP_PX, layoutCutHandles } from '@/lib/clips/editor/cut-handle-layout'
import { useAudioPeaks } from '@/components/clips/editor/use-audio-peaks'
import { TimelineLaneHeader } from '@/components/clips/editor/timeline/timeline-lane-header'
import { TimelineRuler } from '@/components/clips/editor/timeline/timeline-ruler'
import { TimelineWaveform } from '@/components/clips/editor/timeline/timeline-waveform'
import { SourceSegmentFilmstrip, TimelineFilmstrip } from '@/components/clips/editor/timeline/timeline-filmstrip'
import { useFilmstripFrames } from '@/components/clips/editor/timeline/use-filmstrip-frames'
import type { EditorAssets } from '@/lib/clips/editor/editor-assets'
import { KeyframeInspector } from '@/components/clips/editor/timeline/keyframe-inspector'
import { ItemSpeedControl, itemSpeed, speedLabel } from '@/components/clips/editor/timeline/item-speed-control'
import { TransitionPopover } from '@/components/clips/editor/timeline/transition-popover'
import { MEDIA_DND_TYPE, type MediaDropLane } from '@/lib/clips/editor/media-add'
import { segmentMediaMs, sourceById, sourceSegmentWindows } from '@/lib/clips/editor/sources'
import {
  deleteKeyframesAt,
  keyframeTimes,
  moveKeyframesAt,
  targetForItem,
  targetOriginMs,
  type KeyframeTarget,
} from '@/lib/clips/editor/keyframes'
import {
  TRANSITION_INFO,
  applyBrollTransitionToAll,
  applyCutTransitionToAll,
  brollTransitionWindows,
  cutTransitionWindows,
  transitionAtCut,
  setBrollTransition,
  setCutTransition,
  type TransitionSpec,
} from '@/lib/clips/editor/transitions'
import {
  TIMELINE_DEFAULT_PX_PER_SEC,
  TIMELINE_MIN_LABEL_PX,
  timelineMinPxPerSec,
  anchoredScrollLeft,
  autoscrollLeftForPlayhead,
  fitPxPerSec,
  initialPxPerSec,
  isTextEntryTarget,
  pxPerSecToSlider,
  readablePxPerSec,
  sliderToPxPerSec,
  timelineZoomKeyAction,
  trackWidthPx,
  zoomBy,
  zoomPercent,
} from '@/lib/clips/editor/timeline-zoom'

/** Track left padding inside the scroller (lane headers live outside it, CapCut-style). */
const TRACK_OFFSET_PX = 8
/** Left + right padding. */
const TRACK_EXTRA_PX = 16
const RULER_H = 18
// FV2: Video lane is taller so the filmstrip (top) and word chips (bottom) both show; B-roll gets a strip too.
const LANE_H: Record<LaneId, number> = { text: 20, video: 58, broll: 30, voice: 24, music: 22, sfx: 20 }
/** Word-chip bar height at the bottom of the Video lane (filmstrip fills the space above it). */
const VIDEO_WORDBAR_H = 18
/** FV2: above this span (full videos) the timeline windows its DOM and opens at Fit; clips are unchanged. */
const LONG_MEDIA_MS = 10 * 60 * 1000
/** Timeline-side view of a B-roll media row (filmstrip source). */
type TimelineBrollMedia = { id: string; url: string | null; thumbUrl?: string; mediaType?: string }
const SNAP_PX = 8
const DRAG_SLOP_PX = 3

const LANE_COLORS: Record<LaneId, string> = {
  text: 'bg-fuchsia-500/75',
  video: 'bg-sky-600/40',
  broll: 'bg-indigo-500/80',
  voice: 'bg-emerald-950/50',
  music: 'bg-teal-600/60',
  sfx: 'bg-amber-500/80',
}

type TransitionTarget =
  | { kind: 'cut'; srcMs: number; maxMs: number; x: number; y: number }
  | { kind: 'broll'; id: string; edge: 'in' | 'out'; maxMs: number; x: number; y: number }

type DragState = {
  mode: 'move' | 'start' | 'end'
  item: TimelineItem
  refs: ItemRef[]
  originX: number
  deltaMs: number
  snappedTo: number | null
  moved: boolean
}

/** E5: lanes that accept a Media-panel drop. */
const MEDIA_DROP_LANES = new Set<string>(['video', 'broll', 'music', 'sfx'])

export function Timeline({
  edits,
  words,
  shots,
  outputMs,
  clipOutputDurationMs,
  videoUrl = null,
  onSeekOutput,
  clipStartMs,
  clipEndMs,
  mediaMinMs,
  mediaMaxMs,
  trimMinMs,
  trimMaxMs,
  onSplitLayout,
  onCutSection,
  onSetLayoutMode,
  onCommitEdits,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  mediaOffsetMs = 0,
  musicUrl = null,
  sfxDurationsMs,
  onOpenCover,
  onSelectionChange,
  editorAssets = null,
  brollMedia,
  sourceUrls = null,
  onDropMedia,
  onSelectSourceSegment,
  selectedSourceSegmentId = null,
}: {
  edits: ClipEditsV2
  words: SourceWord[]
  shots: CropShot[]
  outputMs: number
  clipOutputDurationMs: number
  videoUrl?: string | null
  onSeekOutput: (outputMs: number) => void
  /** @deprecated E2 trims the clip in/out via the Video lane edges (onCommitEdits). */
  onTrimChange?: (trim: { in: number; out: number }) => void
  /** @deprecated E2 commits B-roll moves through onCommitEdits (one undo step per drag). */
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
  /** E2: every timeline edit is ONE call (= one undo step in useEditorState). Omit for read-only. */
  onCommitEdits?: (next: ClipEditsV2) => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  /** Source ms at media time 0 of `videoUrl` (waveform slicing). */
  mediaOffsetMs?: number
  musicUrl?: string | null
  sfxDurationsMs?: Record<string, number>
  onOpenCover?: () => void
  /** E4: the single selected item (Color / Text panels follow it); null when 0 or 2+ selected. */
  onSelectionChange?: (item: TimelineItem | null) => void
  /** FV2: full-video peaks + filmstrip sprite (null for clips). */
  editorAssets?: EditorAssets | null
  /** FV2: B-roll media rows (filmstrip on B-roll items). */
  brollMedia?: TimelineBrollMedia[]
  /** E5×FV2: media URL by refId, so other-source Video-lane spans show their own frames. */
  sourceUrls?: Record<string, string> | null
  /** E5: a Media-panel card dropped on a lane at OUTPUT ms. */
  onDropMedia?: (lane: MediaDropLane, outMs: number, mediaId: string) => void
  /** E5: click on a source segment chip (Video lane) → Media panel segment editor. */
  onSelectSourceSegment?: (id: string) => void
  selectedSourceSegmentId?: string | null
}) {
  const previewEdits = useMemo(() => editorPreviewEdits(edits, words), [edits, words])
  const tb = useMemo(() => timebaseFor(previewEdits), [previewEdits])
  // Single time base: OUTPUT ms of the effective edits (what preview plays and export renders).
  const span = Math.max(1, tb.durationMs || clipOutputDurationMs)
  const trimLimits = useMemo(() => {
    const min = trimMinMs ?? mediaMinMs
    const max = trimMaxMs ?? mediaMaxMs
    if (min != null && max != null) return { minMs: min, maxMs: max }
    return undefined
  }, [mediaMaxMs, mediaMinMs, trimMaxMs, trimMinMs])
  const clampTrim = useCallback(
    (next: { in: number; out: number }) =>
      clampTrimWithMediaBounds(clipStartMs, clipEndMs, next, mediaMinMs, mediaMaxMs, trimLimits),
    [clipEndMs, clipStartMs, mediaMaxMs, mediaMinMs, trimLimits],
  )

  // ---- zoom (E1) -----------------------------------------------------------
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [viewportPx, setViewportPx] = useState(0)
  const [pxPerSec, setPxPerSec] = useState<number | null>(null)
  const pendingScrollRef = useRef<number | null>(null)
  const trackViewportPx = Math.max(0, viewportPx - TRACK_EXTRA_PX)
  // FV2: long media can zoom out until the whole hour fits; clips keep the 4 px/s floor.
  const minPx = timelineMinPxPerSec(span, trackViewportPx)
  const minPxRef = useRef(minPx)
  minPxRef.current = minPx
  const longMedia = span > LONG_MEDIA_MS
  const effectivePxPerSec = pxPerSec ?? (longMedia ? minPx : TIMELINE_DEFAULT_PX_PER_SEC)
  const widthPx = trackWidthPx(span, effectivePxPerSec, trackViewportPx, minPx)
  const pxPerMs = widthPx / span
  const widthRef = useRef(widthPx)
  widthRef.current = widthPx

  const playheadMs = Math.max(0, Math.min(span, outputMs))
  const playheadPct = (playheadMs / span) * 100
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

  // E1fix: initial zoom is what this clip's words need to be readable (>= 100%), Fit if it fits.
  const readableScale = useMemo(
    () =>
      readablePxPerSec(
        words
          .map((w) => {
            const { startMs, endMs } = wordSourceMs(w)
            return { text: wordDisplayText(w, edits.wordFixes), durMs: endMs - startMs, startMs, endMs }
          })
          .filter((w) => w.endMs >= previewEdits.trim.in && w.startMs <= previewEdits.trim.out),
      ),
    [words, edits.wordFixes, previewEdits.trim.in, previewEdits.trim.out],
  )
  useEffect(() => {
    if (pxPerSec == null && trackViewportPx > 0)
      setPxPerSec(
        longMedia
          ? fitPxPerSec(span, trackViewportPx, minPx)
          : initialPxPerSec(span, trackViewportPx, readableScale, minPx),
      )
  }, [pxPerSec, span, trackViewportPx, readableScale, longMedia, minPx])

  const applyZoom = useCallback(
    (nextPxPerSec: number, anchorX?: number) => {
      const el = scrollRef.current
      const prevW = widthRef.current
      const nextW = trackWidthPx(span, nextPxPerSec, trackViewportPx, minPxRef.current)
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

  const zoomIn = () => applyZoom(zoomBy(effectivePxPerSec, 'in', undefined, minPx))
  const zoomOut = () => applyZoom(zoomBy(effectivePxPerSec, 'out', undefined, minPx))
  const zoomFit = () => {
    pendingScrollRef.current = 0
    setPxPerSec(fitPxPerSec(span, trackViewportPx, minPx))
  }
  const zoomDefault = () => applyZoom(TIMELINE_DEFAULT_PX_PER_SEC)

  // E1fix: +/-/0 work whenever focus is not in a text field (before: only after clicking the
  // timeline). When the timeline itself is focused its onKeyDown handles the key first and calls
  // preventDefault, so this window listener skips it (no double zoom).
  const zoomKeysRef = useRef({ zoomIn, zoomOut, zoomFit, split: () => {}, canSplit: false })
  zoomKeysRef.current = { zoomIn, zoomOut, zoomFit, split: () => split(), canSplit: Boolean(onCommitEdits) }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      // E2fix: S splits at the playhead from anywhere in the editor (e.g. right after a ruler click),
      // not only when the timeline has focus. Text fields keep their S.
      if (
        (e.key === 's' || e.key === 'S') &&
        zoomKeysRef.current.canSplit &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isTextEntryTarget(e.target)
      ) {
        e.preventDefault()
        zoomKeysRef.current.split()
        return
      }
      const action = timelineZoomKeyAction(e)
      if (!action || isTextEntryTarget(e.target)) return
      e.preventDefault()
      if (action === 'in') zoomKeysRef.current.zoomIn()
      else if (action === 'out') zoomKeysRef.current.zoomOut()
      else zoomKeysRef.current.zoomFit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Ctrl/Cmd + wheel zooms around the cursor (non-passive so the page does not zoom).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      applyZoom(zoomBy(pxPerSecRef.current, e.deltaY < 0 ? 'in' : 'out', 1.12, minPxRef.current), e.clientX - rect.left)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [applyZoom])

  // FV2: visible track window (track px) — long media renders only what is near the viewport.
  const [scrollX, setScrollX] = useState(0)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        setScrollX(el.scrollLeft)
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
  const virtualize = longMedia && viewportPx > 0
  const visFromPx = virtualize ? Math.max(0, scrollX - TRACK_OFFSET_PX - viewportPx) : 0
  const visToPx = virtualize ? scrollX - TRACK_OFFSET_PX + 2 * viewportPx : Number.POSITIVE_INFINITY
  const inView = (startMs: number, endMs: number) => !virtualize || (endMs * pxPerMs >= visFromPx && startMs * pxPerMs <= visToPx)

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

  // ---- lane model ----------------------------------------------------------
  const lanes = useMemo(
    () => buildTimelineItems({ edits, previewEdits, sfxDurationsMs }),
    [edits, previewEdits, sfxDurationsMs],
  )
  const captionWords = useMemo(() => buildCaptionWords(words, previewEdits), [words, previewEdits])
  const wordChips: TimelineWordChip[] = useMemo(
    () =>
      captionWords.map((c) => ({
        wordId: String(c.i),
        text: c.text,
        outStartMs: c.s_ms,
        outEndMs: Math.max(c.s_ms + 1, c.e_ms),
        deleted: false,
      })),
    [captionWords],
  )
  const wordItems = useMemo(() => groupWordbarItems(wordChips, pxPerMs), [wordChips, pxPerMs])
  const wordEdges = useMemo(() => wordChips.flatMap((w) => [w.outStartMs, w.outEndMs]), [wordChips])
  const wordByI = useMemo(() => new Map(words.map((w) => [String(w.i), w])), [words])
  // FV2: full videos read the worker's compact peaks file and never download the media for it.
  const voicePeaks = useAudioPeaks(videoUrl, 40, 12_000, {
    peaksUrl: editorAssets?.peaksUrl ?? null,
    skipDecode: Boolean(editorAssets?.fullVideo) || longMedia,
  })
  // FV2: filmstrip frames. Clips: extracted client-side from the editor video (no stored files).
  // Full videos: worker sprite first; client frames only refine visible tiles when zoomed in.
  const videoFrames = useFilmstripFrames(videoUrl)
  const filmstripSprite = editorAssets?.filmstrip ?? null
  const musicPeaks = useAudioPeaks(edits.audio?.music ? musicUrl : null, 20)
  const editable = Boolean(onCommitEdits)

  const [selected, setSelected] = useState<ItemRef[]>([])
  const [snapOn, setSnapOn] = useState(true)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  // E3: selected keyframe (diamond), live diamond drag, open transition pop-over.
  const [selKf, setSelKf] = useState<{ target: KeyframeTarget; tMs: number } | null>(null)
  const [kfDrag, setKfDrag] = useState<{ target: KeyframeTarget; fromMs: number; toMs: number } | null>(null)
  const [trPop, setTrPop] = useState<TransitionTarget | null>(null)

  // Drop selections whose items no longer exist (ids change after cuts / undo).
  const liveSelected = useMemo(
    () => selected.filter((r) => lanes[r.lane].some((i) => i.id === r.id)),
    [lanes, selected],
  )
  const selectedKeys = useMemo(() => new Set(liveSelected.map(refKey)), [liveSelected])
  // E4: report the single selection (by key + source range so re-renders don't spam the shell).
  const singleSel = liveSelected.length === 1 ? lanes[liveSelected[0]!.lane].find((i) => i.id === liveSelected[0]!.id) ?? null : null
  const singleSelKey = singleSel ? `${refKey(singleSel)}:${singleSel.srcInMs ?? ''}:${singleSel.srcOutMs ?? ''}` : ''
  const onSelRef = useRef(onSelectionChange)
  onSelRef.current = onSelectionChange
  const singleSelRef = useRef(singleSel)
  singleSelRef.current = singleSel
  useEffect(() => {
    onSelRef.current?.(singleSelRef.current)
  }, [singleSelKey])

  const opCtx = (): OpCtx => ({ edits, previewEdits, clampTrim })
  const commit = (next: ClipEditsV2 | null) => {
    if (next && onCommitEdits) onCommitEdits(next)
  }
  const split = () => {
    if (!editable) return
    const next = splitAt(opCtx(), liveSelected, playheadMs)
    if (next) commit(next)
    else toast.message(splitNoopMessage(edits, liveSelected))
  }
  // E3fix: Join — remove a Video split (prev / next of one selected half, or between selected halves).
  const joinOpts = videoJoinOptions({ edits, previewEdits }, liveSelected)
  const join = (points: number[]) => {
    if (!editable) return
    const next = joinVideoSplits({ edits }, points)
    if (!next) return
    commit(next)
    // Select the joined clip: it keeps the id of the half that ended at the first joined point.
    const keep = lanes.video.find((v) => v.srcOutMs === Math.min(...points))
    setSelected(keep ? [{ lane: 'video', id: keep.id }] : [])
  }
  /** E2fix: the last item click landed on a locked lane — arrows then do nothing (not playhead). */
  const lockedClickRef = useRef<LaneId | null>(null)
  const del = () => {
    if (!liveSelected.length) return false
    commit(deleteItems(opCtx(), liveSelected))
    setSelected([])
    return true
  }
  const nudge = (dir: -1 | 1, big: boolean) => {
    // A selected keyframe diamond nudges by the same frame step (1 frame / Shift 10).
    if (selKf) {
      const to = Math.max(0, selKf.tMs + dir * arrowStepMs(big))
      commit(moveKeyframesAt(edits, selKf.target, selKf.tMs, to))
      setSelKf({ target: selKf.target, tMs: to })
      return true
    }
    const movable = liveSelected.filter((r) => lanes[r.lane].find((i) => i.id === r.id)?.caps.move)
    if (!movable.length) return false
    commit(moveItems(opCtx(), movable, dir * arrowStepMs(big)))
    return true
  }
  const toggleLane = (lane: LaneId, patch: { muted?: boolean; hidden?: boolean; locked?: boolean }) => {
    commit(setLaneState(edits, lane, patch))
    if (patch.locked) setSelected((s) => s.filter((r) => r.lane !== lane))
  }

  // ---- E3 keyframes / transitions -------------------------------------------
  const startKfDrag = (e: React.PointerEvent, target: KeyframeTarget, tMs: number, origin: number) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    rootRef.current?.focus({ preventScroll: true })
    setSelKf({ target, tMs })
    onSeekOutput(origin + tMs)
    if (!editable) return
    const originX = e.clientX
    const state = { toMs: tMs, moved: false }
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - originX
      if (!state.moved && Math.abs(dx) < DRAG_SLOP_PX) return
      state.moved = true
      const raw = tMs + dx / Math.max(1e-6, pxPerMs)
      // Snap to the playhead / whole frames.
      const ph = playheadMs - origin
      let t = Math.abs(raw - ph) * pxPerMs < SNAP_PX && snapOn ? ph : Math.round(raw / (1000 / 30)) * (1000 / 30)
      t = Math.max(0, Math.round(t))
      state.toMs = t
      setKfDrag({ target, fromMs: tMs, toMs: t })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setKfDrag(null)
      if (!state.moved || state.toMs === tMs) return
      commit(moveKeyframesAt(edits, target, tMs, state.toMs))
      setSelKf({ target, tMs: state.toMs })
      onSeekOutput(origin + state.toMs)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const cutWindows = useMemo(() => cutTransitionWindows(tb.segs, tb.starts, edits.transitions), [edits.transitions, tb])
  // E5: Video-lane segments from another source (uploads / angles / multicam), drawn over the clip.
  const sourceChips = useMemo(
    () =>
      sourceSegmentWindows(tb, edits.sourceSegments).map((w) => ({
        ...w,
        label: sourceById(edits.sources, w.sourceId)?.label ?? 'Source',
      })),
    [edits.sourceSegments, edits.sources, tb],
  )
  const brollWindows = useMemo(() => brollTransitionWindows(edits.broll), [edits.broll])
  const openCutTransition = (e: React.MouseEvent, k: number) => {
    e.stopPropagation()
    const [a0, a1] = tb.segs[k - 1]!
    const [b0, b1] = tb.segs[k]!
    setTrPop({ kind: 'cut', srcMs: b0, maxMs: Math.min(a1 - a0, b1 - b0), x: e.clientX, y: e.clientY })
  }
  const openBrollTransition = (e: React.MouseEvent, item: TimelineItem, edge: 'in' | 'out') => {
    e.stopPropagation()
    setTrPop({ kind: 'broll', id: item.id, edge, maxMs: (item.endMs - item.startMs) / 2, x: e.clientX, y: e.clientY })
  }
  const trValue: TransitionSpec | null = (() => {
    if (!trPop) return null
    if (trPop.kind === 'cut') {
      const t = transitionAtCut(tb.segs, edits.transitions, trPop.srcMs)
      return t ? { type: t.type, durMs: t.durMs } : null
    }
    const b = edits.broll?.find((x) => x.id === trPop.id)
    return (trPop.edge === 'in' ? b?.transitionIn : b?.transitionOut) ?? null
  })()

  // Inspector: exactly one selected item with an animatable target.
  const inspected = (() => {
    if (liveSelected.length !== 1) return null
    const r = liveSelected[0]!
    const item = lanes[r.lane].find((i) => i.id === r.id)
    const target = item ? targetForItem(item.lane, item.id) : null
    if (!item || !target) return null
    const origin = targetOriginMs(edits, target)
    return { item, target, origin }
  })()

  const msAtClientX = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    return Math.max(0, Math.min(span, ((clientX - r.left) / Math.max(1, r.width)) * span))
  }

  const startDrag = (e: React.PointerEvent, item: TimelineItem, mode: DragState['mode']) => {
    if (e.button !== 0) return
    e.stopPropagation()
    rootRef.current?.focus({ preventScroll: true })
    const key = refKey(item)
    const multi = e.shiftKey || e.metaKey || e.ctrlKey
    if (laneState(edits, item.lane).locked) {
      lockedClickRef.current = item.lane
      return
    }
    lockedClickRef.current = null
    if (multi) {
      setSelected((s) =>
        s.some((r) => refKey(r) === key) ? s.filter((r) => refKey(r) !== key) : [...s, { lane: item.lane, id: item.id }],
      )
      return
    }
    const already = selectedKeys.has(key)
    if (!already) setSelected([{ lane: item.lane, id: item.id }])
    if (!editable) return
    if (mode === 'move' && !item.caps.move) return
    if (mode === 'start' && !item.caps.trimStart) return
    if (mode === 'end' && !item.caps.trimEnd) return
    const refs =
      mode === 'move' && already
        ? liveSelected.filter((r) => lanes[r.lane].find((i) => i.id === r.id)?.caps.move)
        : [{ lane: item.lane, id: item.id }]
    const moving = refs.map((r) => lanes[r.lane].find((i) => i.id === r.id)!).filter(Boolean)
    const exclude = new Set(refs.map(refKey))
    const targets = snapTargets({ lanes, durationMs: span, playheadMs, wordEdgesMs: wordEdges, exclude })
    const thr = SNAP_PX / Math.max(1e-6, pxPerMs)
    const ctx = opCtx()
    const state: DragState = { mode, item, refs, originX: e.clientX, deltaMs: 0, snappedTo: null, moved: false }
    setDrag(state)
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - state.originX
      if (!state.moved && Math.abs(dx) < DRAG_SLOP_PX) return
      state.moved = true
      const raw = dx / Math.max(1e-6, pxPerMs)
      const snapping = snapOn && !ev.altKey
      if (mode === 'move') {
        const edges = moving.flatMap((m) => [m.startMs, m.endMs])
        const s = snapping ? snapMoveDelta(edges, raw, targets, thr) : { deltaMs: raw, snappedTo: null }
        state.deltaMs = s.deltaMs
        state.snappedTo = s.snappedTo
      } else {
        const edge = mode === 'start' ? item.startMs : item.endMs
        const s = snapping ? snapValue(edge + raw, targets, thr) : { ms: edge + raw, snappedTo: null }
        state.deltaMs = s.ms - edge
        state.snappedTo = s.snappedTo
      }
      setDrag({ ...state })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setDrag(null)
      if (!state.moved || !state.deltaMs) return
      if (mode === 'move') commit(moveItems(ctx, state.refs, state.deltaMs))
      else {
        const edge = mode === 'start' ? item.startMs : item.endMs
        commit(trimItem(ctx, { lane: item.lane, id: item.id }, mode, edge + state.deltaMs))
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  /** Live (uncommitted) geometry while dragging. */
  const shown = (item: TimelineItem): { startMs: number; endMs: number } => {
    if (!drag?.moved) return item
    const key = refKey(item)
    if (drag.mode === 'move' && drag.refs.some((r) => refKey(r) === key)) {
      return { startMs: item.startMs + drag.deltaMs, endMs: item.endMs + drag.deltaMs }
    }
    if (refKey(drag.item) === key) {
      return drag.mode === 'start'
        ? { startMs: Math.min(item.endMs - 1, item.startMs + drag.deltaMs), endMs: item.endMs }
        : { startMs: item.startMs, endMs: Math.max(item.startMs + 1, item.endMs + drag.deltaMs) }
    }
    return item
  }

  // ---- keyboard (focus inside the timeline) ---------------------------------
  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
    const mod = e.metaKey || e.ctrlKey
    const k = e.key
    if (!mod && (k === '+' || k === '=')) {
      e.preventDefault()
      zoomIn()
    } else if (!mod && (k === '-' || k === '_')) {
      e.preventDefault()
      zoomOut()
    } else if (!mod && k === '0') {
      e.preventDefault()
      zoomFit()
    } else if (!mod && (k === 's' || k === 'S') && editable) {
      e.preventDefault()
      e.stopPropagation()
      split()
    } else if (!mod && (k === 'n' || k === 'N')) {
      e.preventDefault()
      setSnapOn((v) => !v)
    } else if ((k === 'Delete' || k === 'Backspace') && editable && selKf) {
      e.preventDefault()
      e.stopPropagation()
      commit(deleteKeyframesAt(edits, selKf.target, selKf.tMs))
      setSelKf(null)
    } else if ((k === 'Delete' || k === 'Backspace') && editable && liveSelected.length) {
      e.preventDefault()
      e.stopPropagation()
      del()
    } else if ((k === 'ArrowLeft' || k === 'ArrowRight') && !mod) {
      // E2fix: movable selection → nudge it. Clicked a locked item → nothing (it must not fall
      // through to the editor's playhead step). Otherwise the editor steps the playhead.
      if (editable && (liveSelected.length || selKf) && nudge(k === 'ArrowLeft' ? -1 : 1, e.shiftKey)) {
        e.preventDefault()
        e.stopPropagation()
      } else if (lockedClickRef.current && !liveSelected.length) {
        e.preventDefault()
        e.stopPropagation()
        toast.message(`${LANE_LABELS[lockedClickRef.current]} lane is locked`, { id: 'timeline-locked' })
      }
    } else if (k === 'Escape') {
      lockedClickRef.current = null
      setSelected([])
      setSelKf(null)
      setCtxMenu(null)
      setTrPop(null)
    } else if (mod && (k === 'a' || k === 'A')) {
      e.preventDefault()
      e.stopPropagation()
      const all: ItemRef[] = []
      for (const lane of LANE_ORDER) {
        if (lane === 'voice' || laneState(edits, lane).locked) continue
        for (const it of lanes[lane]) if (it.caps.move || it.caps.del) all.push({ lane, id: it.id })
      }
      setSelected(all)
    } else if (mod && (k === 'z' || k === 'Z') && (onUndo || onRedo)) {
      e.preventDefault()
      e.stopPropagation()
      if (e.shiftKey) onRedo?.()
      else onUndo?.()
    } else if (mod && (k === 'y' || k === 'Y') && onRedo) {
      e.preventDefault()
      e.stopPropagation()
      onRedo()
    }
  }

  useEffect(() => {
    if (!ctxMenu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtxMenu(null)
    }
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setCtxMenu(null)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
    }
  }, [ctxMenu])

  const segmentModeAtPlayhead = layoutModeAtSourceMs(edits, outputToSource(tb, playheadMs))
  const layoutModes: ClipEditsV2['layout']['mode'][] = [
    'speaker_follow',
    'split',
    'fit_blur',
    'center_crop',
    'screen_pip',
    'dynamic',
  ]

  // Layout segments (source ms) mapped onto the output time base, piece by piece.
  const layoutPieces = useMemo(() => {
    const out: { key: string; startMs: number; endMs: number; mode: string }[] = []
    for (const seg of edits.layout.layoutSegments || []) {
      tb.segs.forEach(([a, b], i) => {
        const s = Math.max(a, seg.startMs)
        const e = Math.min(b, seg.endMs)
        if (e - s < 1) return
        out.push({ key: `${seg.startMs}-${i}`, startMs: tb.starts[i]! + (s - a), endMs: tb.starts[i]! + (e - a), mode: seg.mode })
      })
    }
    return out
  }, [edits.layout.layoutSegments, tb])
  const aiInOut = [sourceToOutput(tb, clipStartMs), sourceToOutput(tb, clipEndMs)]

  const laneTop = (lane: LaneId) => {
    let y = RULER_H
    for (const l of LANE_ORDER) {
      if (l === lane) return y
      y += LANE_H[l]
    }
    return y
  }
  const totalH = RULER_H + LANE_ORDER.reduce((s, l) => s + LANE_H[l], 0)

  const tbtn =
    'inline-flex h-7 items-center gap-1 rounded px-1.5 text-[11px] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40'

  const renderItem = (item: TimelineItem) => {
    const geo = shown(item)
    const left = geo.startMs * pxPerMs
    const w = Math.max(2, (geo.endMs - geo.startMs) * pxPerMs)
    const st = laneState(edits, item.lane)
    const isSel = selectedKeys.has(refKey(item))
    const faded = st.hidden || st.muted
    const h = LANE_H[item.lane]
    // E3: Voice is selectable (volume keyframes) but cannot move / trim.
    const interactive = true
    const kfTarget = targetForItem(item.lane, item.id)
    const kfOrigin = kfTarget ? targetOriginMs(edits, kfTarget) : 0
    const kfs = kfTarget
      ? keyframeTimes(edits, kfTarget).filter((t) => kfOrigin + t >= item.startMs - 0.5 && kfOrigin + t <= item.endMs + 0.5)
      : []
    const bItem = item.lane === 'broll' ? edits.broll?.find((b) => b.id === item.id) : undefined
    const bMedia = item.lane === 'broll' ? brollMedia?.find((m) => m.id === item.id) : undefined
    return (
      <div
        key={refKey(item)}
        className={`absolute top-0.5 overflow-hidden rounded-[3px] text-[10px] leading-4 text-white ${LANE_COLORS[item.lane]} ${
          isSel ? 'ring-2 ring-white ring-offset-1 ring-offset-primary' : ''
        } ${faded ? 'opacity-40' : ''} ${st.locked ? 'cursor-not-allowed' : item.caps.move ? 'cursor-grab' : interactive ? 'cursor-pointer' : ''}`}
        style={{ left, width: w, height: h - 4, pointerEvents: interactive ? 'auto' : 'none' }}
        data-testid={`timeline-item-${item.lane}`}
        data-item-id={item.id}
        data-start-ms={Math.round(item.startMs)}
        data-end-ms={Math.round(item.endMs)}
        data-selected={isSel ? 'true' : undefined}
        title={`${item.label} · ${(item.startMs / 1000).toFixed(2)}–${(item.endMs / 1000).toFixed(2)} s`}
        onPointerDown={interactive ? (e) => startDrag(e, item, 'move') : undefined}
        onContextMenu={(e) => {
          if (!interactive) return
          e.preventDefault()
          e.stopPropagation()
          if (!selectedKeys.has(refKey(item))) setSelected([{ lane: item.lane, id: item.id }])
          setCtxMenu({ x: e.clientX, y: e.clientY })
        }}
      >
        {item.lane === 'video' && item.srcInMs != null && item.srcOutMs != null ? (
          <TimelineFilmstrip
            fromMs={item.srcInMs - mediaOffsetMs}
            toMs={item.srcOutMs - mediaOffsetMs}
            widthPx={w}
            heightPx={h - 4 - VIDEO_WORDBAR_H}
            pxPerMs={pxPerMs}
            visLeftPx={virtualize ? visFromPx - left : undefined}
            visRightPx={virtualize ? visToPx - left : undefined}
            sprite={filmstripSprite}
            frames={videoFrames}
          />
        ) : null}
        {item.lane === 'broll' && bMedia ? (
          <BrollFilmstrip
            media={bMedia}
            fromMs={item.inMs ?? 0}
            toMs={(item.inMs ?? 0) + (item.endMs - item.startMs)}
            widthPx={w}
            heightPx={h - 4}
            pxPerMs={pxPerMs}
          />
        ) : null}
        {item.lane === 'voice' ? (
          <TimelineWaveform
            peaks={voicePeaks}
            mediaFromMs={(item.srcInMs ?? 0) - mediaOffsetMs}
            mediaToMs={(item.srcOutMs ?? 0) - mediaOffsetMs}
            widthPx={w}
            className="absolute inset-0 size-full text-emerald-400/90"
          />
        ) : null}
        {item.lane === 'music' ? (
          <TimelineWaveform
            peaks={musicPeaks}
            mediaFromMs={item.inMs ?? 0}
            mediaToMs={(item.inMs ?? 0) + (item.endMs - item.startMs)}
            widthPx={w}
            className="absolute inset-0 size-full text-teal-200/80"
          />
        ) : null}
        {item.lane !== 'voice' && item.lane !== 'video' && w > 28 ? (
          <span className="pointer-events-none relative truncate px-1">{item.label}</span>
        ) : null}
        {item.lane === 'video' && w > 40 ? (
          <span className="pointer-events-none absolute left-1 top-0 z-[1] rounded-sm bg-black/45 px-0.5 text-[9px] text-white/90">{item.label}</span>
        ) : null}
        {item.lane === 'video' && item.srcInMs != null && item.srcOutMs != null && edits.segmentSpeeds?.length
          ? (() => {
              const s = itemSpeed(edits, item.srcInMs, item.srcOutMs)
              return s !== 1 ? (
                <span
                  className="pointer-events-none absolute right-1 top-0 rounded bg-black/60 px-1 text-[9px] font-semibold tabular-nums text-amber-300"
                  data-testid={`timeline-speed-badge-${item.id}`}
                >
                  {speedLabel(s)}
                </span>
              ) : null
            })()
          : null}
        {kfs.map((t) => {
          const shownT = kfDrag && kfDrag.target === kfTarget && kfDrag.fromMs === t ? kfDrag.toMs : t
          const isSelKf = selKf?.target === kfTarget && selKf.tMs === t
          return (
            <span
              key={`kf${t}`}
              className={`absolute top-1/2 z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 cursor-ew-resize border ${
                isSelKf ? 'border-white bg-amber-300 ring-1 ring-amber-200' : 'border-black/60 bg-amber-400'
              }`}
              style={{ left: (kfOrigin + shownT - geo.startMs) * pxPerMs }}
              data-testid="timeline-keyframe"
              data-target={kfTarget ?? undefined}
              data-t-ms={Math.round(t)}
              data-selected={isSelKf ? 'true' : undefined}
              title={`Keyframe ${((kfOrigin + t) / 1000).toFixed(2)} s — drag to move, Del to delete`}
              onPointerDown={(e) => startKfDrag(e, kfTarget!, t, kfOrigin)}
            />
          )
        })}
        {item.lane === 'broll' && editable && !st.locked && w > 36
          ? (['in', 'out'] as const).map((edge) => {
              const spec = edge === 'in' ? bItem?.transitionIn : bItem?.transitionOut
              return (
                <button
                  key={edge}
                  type="button"
                  className={`absolute top-0.5 z-10 inline-flex size-3.5 items-center justify-center rounded-sm ${
                    spec ? 'bg-white text-indigo-700' : 'bg-black/30 text-white/80 hover:bg-black/50'
                  }`}
                  style={edge === 'in' ? { left: 7 } : { right: 7 }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => openBrollTransition(e, item, edge)}
                  aria-label={`${edge === 'in' ? 'In' : 'Out'} transition${spec ? `: ${TRANSITION_INFO[spec.type].label}` : ''}`}
                  title={spec ? `${TRANSITION_INFO[spec.type].label} · ${(spec.durMs / 1000).toFixed(2)} s` : `Add ${edge} transition`}
                  data-testid={`timeline-broll-transition-${edge}`}
                  data-type={spec?.type}
                >
                  <Blend className="size-2.5" />
                </button>
              )
            })
          : null}
        {editable && !st.locked && item.caps.trimStart ? (
          <span
            className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-white/40 hover:bg-white/80"
            data-testid="timeline-trim-start"
            onPointerDown={(e) => startDrag(e, item, 'start')}
          />
        ) : null}
        {editable && !st.locked && item.caps.trimEnd ? (
          <span
            className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-white/40 hover:bg-white/80"
            data-testid="timeline-trim-end"
            onPointerDown={(e) => startDrag(e, item, 'end')}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      className="min-w-0 space-y-1 focus-visible:outline-none"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      data-testid="timeline-root"
    >
      <div className="flex flex-wrap items-center justify-between gap-1" data-testid="timeline-toolbar">
        <div className="flex items-center gap-0.5">
          {onUndo ? (
            <button type="button" className={tbtn} onClick={onUndo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl/Cmd+Z)">
              <Undo2 className="size-3.5" />
            </button>
          ) : null}
          {onRedo ? (
            <button type="button" className={tbtn} onClick={onRedo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)">
              <Redo2 className="size-3.5" />
            </button>
          ) : null}
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          <button
            type="button"
            className={tbtn}
            onClick={split}
            disabled={!editable}
            aria-label="Split at playhead"
            title="Split at playhead (S) — selected items, or the main video"
            data-testid="timeline-split"
          >
            <Scissors className="size-3.5" />
            Split
          </button>
          <button
            type="button"
            className={tbtn}
            onClick={() => del()}
            disabled={!editable || !liveSelected.length}
            aria-label="Delete selected"
            title="Delete selected (Del)"
            data-testid="timeline-delete"
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          <button
            type="button"
            className={`${tbtn} ${snapOn ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={() => setSnapOn((v) => !v)}
            aria-pressed={snapOn}
            aria-label="Snapping"
            title="Snap to playhead, cuts, words and clip edges (N). Hold Alt while dragging to bypass."
            data-testid="timeline-snap"
          >
            <Magnet className="size-3.5" />
            Snap
          </button>
          {editable && joinOpts.between.length ? (
            <button
              type="button"
              className={tbtn}
              onClick={() => join(joinOpts.between)}
              aria-label="Join selected clips"
              title="Join the selected split clips back into one"
              data-testid="timeline-join"
            >
              Join
            </button>
          ) : null}
          {liveSelected.length > 1 ? (
            <span className="ml-1 text-[10px] text-muted-foreground" data-testid="timeline-selection-count">
              {liveSelected.length} selected
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1" data-testid="timeline-zoom-controls">
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
            value={pxPerSecToSlider(effectivePxPerSec, minPx)}
            onChange={(e) => applyZoom(sliderToPxPerSec(Number(e.target.value), minPx))}
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
            {zoomPercent(effectivePxPerSec, minPx)}%
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
      </div>
      {inspected ? (
        <KeyframeInspector
          edits={edits}
          target={inspected.target}
          label={inspected.item.label}
          localMs={Math.max(0, playheadMs - inspected.origin)}
          onCommit={(next) => commit(next)}
          onSeekLocal={(t) => onSeekOutput(inspected.origin + t)}
          readOnly={!editable || laneState(edits, inspected.item.lane).locked}
        />
      ) : null}
      {singleSel && singleSel.lane === 'video' && singleSel.srcInMs != null && singleSel.srcOutMs != null && editable ? (
        <ItemSpeedControl
          edits={edits}
          srcInMs={singleSel.srcInMs}
          srcOutMs={singleSel.srcOutMs}
          onCommit={(next) => commit(next)}
          readOnly={laneState(edits, 'video').locked}
        />
      ) : null}
      <div className="flex min-w-0 rounded-lg border border-border bg-card/30">
        <div className="w-[92px] shrink-0 border-r border-border/60" aria-label="Tracks">
          <div style={{ height: RULER_H }} className="border-b border-border/60" />
          {LANE_ORDER.map((lane) => (
            <TimelineLaneHeader
              key={lane}
              lane={lane}
              height={LANE_H[lane]}
              state={laneState(edits, lane)}
              onToggle={editable ? (patch) => toggleLane(lane, patch) : undefined}
              onOpenCover={onOpenCover}
            />
          ))}
        </div>
        <div
          ref={scrollRef}
          className="min-w-0 flex-1 overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          tabIndex={0}
          aria-label="Timeline (S split, Del delete, arrows nudge, +/- zoom, 0 fit, N snapping)"
          data-testid="timeline-scroll"
          data-px-per-sec={Math.round(effectivePxPerSec)}
        >
          <div style={{ width: widthPx + TRACK_EXTRA_PX, paddingLeft: TRACK_OFFSET_PX, paddingRight: TRACK_EXTRA_PX - TRACK_OFFSET_PX }}>
            <div
              className="relative shrink-0"
              style={{ width: widthPx, height: totalH }}
              role="presentation"
              data-testid="timeline-track"
              data-duration-ms={Math.round(span)}
              onPointerDown={(e) => {
                if (e.button !== 0) return
                if ((e.target as HTMLElement).closest('[data-testid^="timeline-item-"],[data-testid="timeline-word"],button')) return
                rootRef.current?.focus({ preventScroll: true })
                if (!(e.shiftKey || e.metaKey || e.ctrlKey)) setSelected([])
                const y = e.clientY - e.currentTarget.getBoundingClientRect().top
                if (y > RULER_H) onSeekOutput(msAtClientX(e.clientX, e.currentTarget))
              }}
              onContextMenu={(e) => {
                if (!onSplitLayout && !editable) return
                e.preventDefault()
                setCtxMenu({ x: e.clientX, y: e.clientY })
              }}
            >
              <TimelineRuler
                durationMs={span}
                pxPerMs={pxPerMs}
                widthPx={widthPx}
                height={RULER_H}
                onScrub={onSeekOutput}
                visFromPx={virtualize ? visFromPx : undefined}
                visToPx={virtualize ? visToPx : undefined}
              />
              {LANE_ORDER.map((lane) => (
                <div
                  key={lane}
                  className={`absolute inset-x-0 border-b border-border/30 ${lane === 'video' ? 'bg-muted/60' : 'bg-muted/20'}`}
                  style={{ top: laneTop(lane), height: LANE_H[lane] }}
                  data-testid={`timeline-lane-${lane}`}
                  aria-label={`${lane} lane`}
                  onDragOver={
                    onDropMedia && MEDIA_DROP_LANES.has(lane)
                      ? (e) => {
                          if (!e.dataTransfer.types.includes(MEDIA_DND_TYPE)) return
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'copy'
                        }
                      : undefined
                  }
                  onDrop={
                    onDropMedia && MEDIA_DROP_LANES.has(lane)
                      ? (e) => {
                          const id = e.dataTransfer.getData(MEDIA_DND_TYPE)
                          if (!id) return
                          e.preventDefault()
                          onDropMedia(lane as MediaDropLane, msAtClientX(e.clientX, e.currentTarget), id)
                        }
                      : undefined
                  }
                >
                  {lane === 'video'
                    ? cutWindows.map((w) => (
                        <div
                          key={`tr${w.srcMs}`}
                          className="pointer-events-none absolute inset-y-0 z-[1] bg-gradient-to-r from-white/0 via-white/35 to-white/0"
                          style={{ left: w.w0Ms * pxPerMs, width: Math.max(2, (w.w1Ms - w.w0Ms) * pxPerMs) }}
                          data-testid="timeline-transition-region"
                          data-src-ms={w.srcMs}
                          data-type={w.type}
                          aria-hidden
                        />
                      ))
                    : null}
                  {lane === 'broll'
                    ? brollWindows.map((w) => (
                        <div
                          key={`btr${w.itemId}${w.kind}`}
                          className="pointer-events-none absolute inset-y-0 z-[1] bg-white/30"
                          style={{ left: w.w0Ms * pxPerMs, width: Math.max(2, (w.w1Ms - w.w0Ms) * pxPerMs) }}
                          data-testid="timeline-broll-transition-region"
                          data-kind={w.kind}
                          data-type={w.type}
                          aria-hidden
                        />
                      ))
                    : null}
                  {(virtualize ? lanes[lane].filter((i) => inView(shown(i).startMs, shown(i).endMs)) : lanes[lane]).map(renderItem)}
                  {lane === 'video'
                    ? sourceChips.map((c) => {
                        const seg = edits.sourceSegments?.find((x) => x.id === c.id)
                        const src = sourceById(edits.sources, c.sourceId)
                        if (!seg || !src || !inView(c.startMs, c.endMs)) return null
                        const left = c.startMs * pxPerMs
                        return (
                          <SourceSegmentFilmstrip
                            key={`srcfs${c.id}:${c.startMs}`}
                            url={sourceUrls?.[src.refId] ?? null}
                            mediaType={src.mediaType}
                            fromMs={segmentMediaMs(seg, src, c.srcStartMs)}
                            toMs={segmentMediaMs(seg, src, c.srcEndMs)}
                            leftPx={left}
                            topPx={2}
                            widthPx={Math.max(2, (c.endMs - c.startMs) * pxPerMs)}
                            heightPx={LANE_H.video - 4 - VIDEO_WORDBAR_H}
                            pxPerMs={pxPerMs}
                            visLeftPx={virtualize ? visFromPx - left : undefined}
                            visRightPx={virtualize ? visToPx - left : undefined}
                          />
                        )
                      })
                    : null}
                  {lane === 'video'
                    ? sourceChips.map((c) => (
                        <button
                          key={`src${c.id}:${c.startMs}`}
                          type="button"
                          className={`absolute top-[5px] z-[16] h-[14px] overflow-hidden text-ellipsis whitespace-nowrap rounded-sm border px-1 text-left text-[9px] leading-[12px] text-white shadow ${
                            c.id === selectedSourceSegmentId ? 'border-white bg-amber-500' : 'border-amber-200/70 bg-amber-600/85 hover:bg-amber-500'
                          }`}
                          style={{ left: c.startMs * pxPerMs, width: Math.max(4, (c.endMs - c.startMs) * pxPerMs) }}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectSourceSegment?.(c.id)
                          }}
                          title={`${c.label} (other source)`}
                          data-testid="timeline-source-segment"
                          data-source-id={c.sourceId}
                        >
                          {(c.endMs - c.startMs) * pxPerMs >= TIMELINE_MIN_LABEL_PX ? c.label : null}
                        </button>
                      ))
                    : null}
                  {lane === 'video' ? <TimelineInsertMarkers tb={tb} inserts={edits.inserts} sources={edits.sources} pxPerMs={pxPerMs} /> : null}
                  {lane === 'video' && editable && !laneState(edits, 'video').locked
                    ? (() => {
                        const cutKs = realCutIndices(tb)
                        // E3fix: min hit area + two rows when cuts are closer than the min gap.
                        const slots = layoutCutHandles(cutKs.map((k) => tb.starts[k]! * pxPerMs))
                        return cutKs.map((k, ci) => {
                        const slot = slots[ci]!
                        const srcMs = tb.segs[k]![0]
                        const tr = transitionAtCut(tb.segs, edits.transitions, srcMs)
                        return (
                          <button
                            key={`cut${srcMs}`}
                            type="button"
                            className="group absolute z-20 inline-flex h-5 -translate-x-1/2 items-center justify-center rounded-sm focus-visible:outline-none"
                            style={{ left: slot.x, top: CUT_HANDLE_ROW_TOP_PX[slot.row], width: slot.hitW }}
                            data-row={slot.row}
                            data-hit-w={slot.hitW}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => openCutTransition(e, k)}
                            aria-label={tr ? `Transition: ${TRANSITION_INFO[tr.type].label}` : 'Add transition at this cut'}
                            title={tr ? `${TRANSITION_INFO[tr.type].label} · ${(tr.durMs / 1000).toFixed(2)} s` : 'Add transition'}
                            data-testid="timeline-transition-handle"
                            data-src-ms={srcMs}
                            data-type={tr?.type}
                          >
                            <span
                              className={`inline-flex size-4 items-center justify-center rounded-sm border shadow transition-transform group-hover:scale-125 group-focus-visible:scale-125 group-focus-visible:ring-2 group-focus-visible:ring-ring ${
                                tr ? 'border-white bg-primary text-primary-foreground' : 'border-white/70 bg-background/90 text-foreground group-hover:bg-muted'
                              }`}
                              aria-hidden
                            >
                              <Blend className="size-3" />
                            </span>
                          </button>
                        )
                        })
                      })()
                    : null}
                  {lane === 'video' ? (
                    <>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0.5 h-[18px]" role="group" aria-label="Transcript timeline">
                        {(virtualize ? wordItems.filter((wi) => inView(wi.outStartMs, wi.outEndMs)) : wordItems).map((wi) => {
                          const left = wi.outStartMs * pxPerMs
                          const w = Math.max(1, (wi.outEndMs - wi.outStartMs) * pxPerMs)
                          const id = wi.kind === 'word' ? wi.wordId : `g${wi.outStartMs}`
                          const src = wi.kind === 'word' ? wordByI.get(wi.wordId) : undefined
                          const shotI = shotIndexAt(shots, outputToSource(tb, (wi.outStartMs + wi.outEndMs) / 2))
                          const bg = shotI % 2 === 0 ? 'bg-sky-500/70' : 'bg-violet-500/70'
                          const label = wi.kind === 'word' ? wi.text : '…'
                          return (
                            <button
                              key={id}
                              type="button"
                              data-testid="timeline-word"
                              className={`pointer-events-auto absolute top-0 h-[16px] overflow-hidden text-ellipsis whitespace-nowrap rounded-sm px-0.5 text-left text-[10px] leading-4 text-white shadow-[inset_-1px_0_0_rgba(0,0,0,0.45)] ${bg}`}
                              style={{ left, width: w }}
                              onPointerDown={(ev) => ev.stopPropagation()}
                              onClick={(ev) => {
                                ev.stopPropagation()
                                onSeekOutput(wi.outStartMs)
                              }}
                              title={src ? wordDisplayText(src, edits.wordFixes) : label}
                            >
                              {w >= TIMELINE_MIN_LABEL_PX ? label : null}
                            </button>
                          )
                        })}
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" aria-label="Layout segments">
                        {layoutPieces.map((p) => (
                          <div
                            key={p.key}
                            className={`absolute h-[3px] ${p.mode === 'split' ? 'bg-violet-400' : p.mode === 'fit_blur' ? 'bg-amber-400' : 'bg-sky-300'}`}
                            style={{ left: p.startMs * pxPerMs, width: Math.max(1, (p.endMs - p.startMs) * pxPerMs) }}
                            title={p.mode}
                          />
                        ))}
                      </div>
                      {aiInOut.map((ms, i) =>
                        ms == null ? null : (
                          <div
                            key={i}
                            className="pointer-events-none absolute inset-y-0 border-l border-dashed border-primary/60"
                            style={{ left: ms * pxPerMs }}
                            title={i === 0 ? 'Original AI clip start' : 'Original AI clip end'}
                            aria-hidden
                          />
                        ),
                      )}
                    </>
                  ) : null}
                </div>
              ))}
              {drag?.moved && drag.snappedTo != null ? (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 w-px bg-yellow-300"
                  style={{ left: drag.snappedTo * pxPerMs }}
                  data-testid="timeline-snap-guide"
                  aria-hidden
                />
              ) : null}
              {drag?.moved ? (
                <div
                  className="pointer-events-none absolute -top-0.5 rounded bg-popover px-1 text-[10px] tabular-nums shadow"
                  style={{ left: Math.max(0, (shown(drag.item).startMs) * pxPerMs) }}
                  aria-live="polite"
                >
                  {drag.deltaMs >= 0 ? '+' : ''}
                  {(drag.deltaMs / 1000).toFixed(2)}s
                </div>
              ) : null}
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-red-500"
                style={{ left: `${playheadPct}%` }}
                data-testid="timeline-playhead"
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Click to select (Shift-click for more), drag to move, drag edges to trim. S split · Del delete · ←/→ nudge
        (Shift ×10) · N snapping · Space play. ◇ in the strip above adds keyframes; click a cut to add a transition.
        Right-click for layout and section actions.
      </p>
      {trPop ? (
        <TransitionPopover
          title={trPop.kind === 'cut' ? 'Transition at cut' : trPop.edge === 'in' ? 'B-roll in transition' : 'B-roll out transition'}
          value={trValue}
          maxMs={trPop.maxMs}
          anchor={{ x: trPop.x, y: trPop.y }}
          onApply={(spec) =>
            commit(
              trPop.kind === 'cut'
                ? setCutTransition(edits, trPop.srcMs, spec)
                : setBrollTransition(edits, trPop.id, trPop.edge, spec),
            )
          }
          onApplyAll={(spec) =>
            commit(trPop.kind === 'cut' ? applyCutTransitionToAll(edits, [tb.segs[0]!, ...realCutIndices(tb).map((k) => tb.segs[k]!)], spec) : applyBrollTransitionToAll(edits, spec))
          }
          onClose={() => setTrPop(null)}
        />
      ) : null}
      {ctxMenu ? (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[200px] rounded-md border border-border bg-popover p-1 text-xs shadow-lg"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          role="menu"
          aria-label="Timeline segment actions"
        >
          {editable ? (
            <>
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                role="menuitem"
                onClick={() => {
                  split()
                  setCtxMenu(null)
                }}
              >
                Split at playhead (S)
              </button>
              {joinOpts.prev !== null ? (
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                  role="menuitem"
                  data-testid="timeline-join-prev"
                  onClick={() => {
                    join([joinOpts.prev!])
                    setCtxMenu(null)
                  }}
                >
                  Join with previous
                </button>
              ) : null}
              {joinOpts.next !== null ? (
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                  role="menuitem"
                  data-testid="timeline-join-next"
                  onClick={() => {
                    join([joinOpts.next!])
                    setCtxMenu(null)
                  }}
                >
                  Join with next
                </button>
              ) : null}
              {joinOpts.between.length ? (
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                  role="menuitem"
                  data-testid="timeline-join-selected"
                  onClick={() => {
                    join(joinOpts.between)
                    setCtxMenu(null)
                  }}
                >
                  Join selected clips
                </button>
              ) : null}
              {liveSelected.length ? (
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                  role="menuitem"
                  onClick={() => {
                    del()
                    setCtxMenu(null)
                  }}
                >
                  Delete selected (Del)
                </button>
              ) : null}
              <div className="my-1 border-t border-border" role="separator" />
            </>
          ) : null}
          <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground">At playhead</p>
          {onSplitLayout ? (
            <button
              type="button"
              className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
              role="menuitem"
              onClick={() => {
                onSplitLayout()
                setCtxMenu(null)
              }}
            >
              Split layout here
            </button>
          ) : null}
          {onCutSection ? (
            <button
              type="button"
              className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
              role="menuitem"
              onClick={() => {
                onCutSection()
                setCtxMenu(null)
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
                <span className="block font-normal text-foreground">Current: {segmentModeAtPlayhead.replace(/_/g, ' ')}</span>
              </p>
              {layoutModes.map((m) => {
                const active = m === segmentModeAtPlayhead
                return (
                  <button
                    key={m}
                    type="button"
                    className={`block w-full rounded px-2 py-1.5 text-left hover:bg-muted ${active ? 'bg-muted/80 font-medium' : ''}`}
                    role="menuitem"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => {
                      onSetLayoutMode(m)
                      setCtxMenu(null)
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
            className="block w-full rounded px-2 py-1.5 text-left text-muted-foreground hover:bg-muted"
            onClick={() => setCtxMenu(null)}
          >
            Close
          </button>
        </div>
      ) : null}
    </div>
  )
}

/** FV2: B-roll filmstrip — client frames from the B-roll video (falls back to its thumbnail). */
function BrollFilmstrip({
  media,
  fromMs,
  toMs,
  widthPx,
  heightPx,
  pxPerMs,
}: {
  media: TimelineBrollMedia
  fromMs: number
  toMs: number
  widthPx: number
  heightPx: number
  pxPerMs: number
}) {
  const isImage = media.mediaType === 'image'
  const frames = useFilmstripFrames(isImage ? null : media.url)
  return (
    <TimelineFilmstrip
      fromMs={fromMs}
      toMs={toMs}
      widthPx={widthPx}
      heightPx={heightPx}
      pxPerMs={pxPerMs}
      frames={frames}
      stillUrl={media.thumbUrl ?? (isImage ? media.url : null)}
      className="opacity-80"
    />
  )
}
