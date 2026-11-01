'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { exportTimeMap, seekBaseMs, toBaseMs, toExportMs } from '@/lib/clips/editor/export-time'
import { parseNudge } from '@/lib/clips/editor/timecode-nudge'
import { readTimelineHeight, TIMELINE_MIN_H, writeTimelineHeight } from '@/lib/clips/editor/timeline-opts'
import { TimelineInsertMarkers } from '@/components/clips/editor/timeline-insert-markers'
import { Activity, Blend, Bookmark, Command, Keyboard, Layers, Link2, Magnet, Maximize2, Pause, Plus, Redo2, Repeat, Scissors, Square, Trash2, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import { toast } from 'sonner'
import type { BrollItem } from '@/lib/clips/broll'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { wordDisplayText } from '@/lib/clips/edits'
import { clampTrimWithMediaBounds } from '@/lib/clips/trim-bounds'
import { HighlightsLane } from '@/components/clips/editor/timeline/highlights-lane'
import {
  picksToLaneRanges,
  type HighlightPick,
  type HighlightRange,
} from '@/lib/clips/editor/highlights'
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
  newGapId,
  replaceWithGaps,
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
  type LaneState,
  type OpCtx,
  type TimelineItem,
  videoJoinOptions,
  refLocked,
  rowItems,
  rowState,
  timelineRows,
  type TimelineRow,
} from '@/lib/clips/editor/clip-timeline'
import { rollEdit, slideEdit, splitEdgeTrim, TRIM_TOOL_KEYS, type TrimTool, slipEdit } from '@/lib/clips/editor/trim-tools'
import { autoCrossfade } from '@/lib/clips/editor/auto-crossfade'
import { addFreezeFrame, addGapAt } from '@/lib/clips/editor/inserts'
import { adjacentMarker, patchMarker, toggleMarkerAt, type Marker } from '@/lib/clips/editor/markers'
import { canToggleEnabled, expandToGroups, groupItems, groupOf, isDisabled, toggleItemsEnabled, ungroupItems } from '@/lib/clips/editor/item-flags'
import {
  compoundOfSelection,
  compoundView,
  createCompound,
  isCompound,
  trimCompound,
  uncompound,
} from '@/lib/clips/editor/compound'
import { readMagnetPref, rippleOverlaysOn, setTimelineOpt, writeMagnetPref } from '@/lib/clips/editor/timeline-opts'
import { getPreviewRate, PREVIEW_RATES, setPreviewRate, subscribePreviewRate } from '@/lib/clips/editor/preview-rate'
import { TimelineMarkers } from '@/components/clips/editor/timeline/timeline-markers'
import { MarkerList } from '@/components/clips/editor/timeline/marker-list'
import { CommandPalette, type PaletteCommand } from '@/components/clips/editor/timeline/command-palette'
import {
  addTrack,
  applyAudioSolo,
  canAddTrack,
  moveTrack,
  removeTrack,
  renameTrack,
  setTrackFlags,
  trackLabel,
  trackMoves,
  trackState,
  tracksOfKind,
  LANE_TRACK_KIND,
  type TrackKind,
} from '@/lib/clips/editor/tracks'
import {
  adjacentCutPoint,
  copyableRefs,
  copyItems,
  cutItems,
  cutPoints,
  deleteRange,
  canDetachAudio,
  canSplitStereo,
  detachBrollAudio,
  splitStereoToTracks,
  duplicateItems,
  itemsInRange,
  moveItemsToTrack,
  moveVideoSegment,
  reorderInsertBefore,
  isNoopReorder,
  pasteAttributes,
  pasteItems,
  rangeOf,
  timelineClipboard,
  type InOut,
} from '@/lib/clips/editor/timeline-edit-ops'
import { timelineCommandFor, type TimelineCommand } from '@/lib/clips/editor/timeline-shortcuts'
import { TimelineShortcutsSheet } from '@/components/clips/editor/timeline/shortcuts-sheet'
import { EnvelopeLine } from '@/components/clips/editor/timeline/envelope-line'
import { addEnvelopePoint, deleteEnvelopePoint, envelopeFor, envelopePoints, moveEnvelopePoint } from '@/lib/clips/editor/envelopes'
import { PROP_SPECS } from '@/lib/clips/editor/motion-schema'
import type { ClipMediaSource } from '@/lib/clips/editor/sources'
import { angleAt, angleKey, multicamAngles, setAngleForOutputRange, switchAngleAt } from '@/lib/clips/editor/multicam-manual'
import { CUT_HANDLE_ROW_TOP_PX, layoutCutHandles } from '@/lib/clips/editor/cut-handle-layout'
import { useAudioPeaks, type AudioPeaks } from '@/components/clips/editor/use-audio-peaks'
import { AudioClipInspector } from '@/components/clips/editor/timeline/audio-clip-inspector'
import { fadeDragMsPerPx, fadeFromDrag, patchAudioClip } from '@/lib/clips/editor/audio-clip'
import { coalescePush, type CoalesceBurst } from '@/lib/clips/editor/undo-coalesce'
import { audioClipKindOf } from '@/lib/clips/editor/audio-kind'
import { beatsToOutput } from '@/lib/clips/editor/beats'
import { DEFAULT_MUSIC_FADE_IN_MS, DEFAULT_MUSIC_FADE_OUT_MS } from '@/lib/clips/audio'
import { useDismiss } from '@/components/clips/editor/use-dismiss'
import { TimelineLaneHeader } from '@/components/clips/editor/timeline/timeline-lane-header'
import { TimelineRuler } from '@/components/clips/editor/timeline/timeline-ruler'
import { TimelineWaveform } from '@/components/clips/editor/timeline/timeline-waveform'
import { SourceSegmentFilmstrip, TimelineFilmstrip } from '@/components/clips/editor/timeline/timeline-filmstrip'
import { useFilmstripFrames } from '@/components/clips/editor/timeline/use-filmstrip-frames'
import type { EditorAssets } from '@/lib/clips/editor/editor-assets'
import { KeyframeInspector } from '@/components/clips/editor/timeline/keyframe-inspector'
import { ItemSpeedControl, itemSpeed, speedLabel } from '@/components/clips/editor/timeline/item-speed-control'
import { TrackFxPanel } from '@/components/clips/editor/timeline/track-fx-panel'
import { PacingPanel } from '@/components/clips/editor/timeline/pacing-panel'
import { TrackMotionPanel } from '@/components/clips/editor/timeline/track-motion-panel'
import { applyMainPreset, trackMotionFor, withTrackMotion } from '@/lib/clips/editor/track-motion'
import { cycleBrollTake, cycleMainTake, groupBrollTakes, groupMainTakes, takeGroupAtSource, takeGroupOfBroll, ungroupTakes } from '@/lib/clips/editor/takes'
import { hasFx, trackFxFor, withTrackFx } from '@/lib/clips/editor/track-fx'
import { TransitionPopover } from '@/components/clips/editor/timeline/transition-popover'
import { MEDIA_DND_TYPE, type MediaDropLane } from '@/lib/clips/editor/media-add'
import { segmentMediaMs, sourceById, sourceSegmentWindows } from '@/lib/clips/editor/sources'
import {
  deleteKeyframeTimes,
  keyframeTimes,
  shiftKeyframeTimes,
  toggleKfSelection,
  targetForItem,
  targetOriginMs,
  type KeyframeTarget,
} from '@/lib/clips/editor/keyframes'
import {
  keyframeDiamondLeftPx,
  keyframeLocalEditFromDiamondPx,
  keyframeLocalEditFromPlayhead,
} from '@/lib/clips/editor/keyframe-time'
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
  isFormControlTarget,
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
const LANE_H: Record<LaneId, number> = { captions: 20, text: 20, adjust: 20, video: 58, broll: 30, voice: 24, music: 22, sfx: 20 }
/** Word-chip bar height at the bottom of the Video lane (filmstrip fills the space above it). */
const VIDEO_WORDBAR_H = 18
/** FV2: above this span (full videos) the timeline windows its DOM and opens at Fit; clips are unchanged. */
const LONG_MEDIA_MS = 10 * 60 * 1000
/** Timeline-side view of a B-roll media row (filmstrip source). */
type TimelineBrollMedia = { id: string; url: string | null; thumbUrl?: string; mediaType?: string }
const SNAP_PX = 8
const DRAG_SLOP_PX = 3

const LANE_COLORS: Record<LaneId, string> = {
  captions: 'bg-yellow-400/80 text-black',
  text: 'bg-fuchsia-500/75',
  adjust: 'bg-gradient-to-r from-rose-500/70 via-amber-400/70 to-sky-500/70 text-black',
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
  /** G1b: row key under the pointer while moving text / B-roll / SFX (drag between tracks). */
  targetRow?: string | null
  /** G1b: main-track reorder — drop before this Video segment id (null = last). */
  insertBefore?: string | null
  reorder?: boolean
  /** G1b3: Alt held at any point of an edge drag (J / L). */
  alt?: boolean
}

/** G1b: commands that work from anywhere in the editor (not only with the timeline focused). */
const GLOBAL_COMMANDS = new Set<TimelineCommand>([
  'copy',
  'cut',
  'paste',
  'pasteAttributes',
  'duplicate',
  'markIn',
  'markOut',
  'clearInOut',
  'home',
  'end',
  'prevEdit',
  'nextEdit',
  'help',
  'rippleDeleteRange',
  'nextTake',
  'prevTake',
  'matchFrame',
  // TC1
  'marker',
  'nextMarker',
  'prevMarker',
  'toggleEnabled',
  'group',
  'ungroup',
  'compound',
  'uncompound',
  'loop',
  'trimStart',
  'trimEnd',
  'speed',
  'export',
  'palette',
])

function hasDomTextSelection(): boolean {
  if (typeof window === 'undefined' || !window.getSelection) return false
  const sel = window.getSelection()
  return Boolean(sel && !sel.isCollapsed && sel.toString().trim())
}

/** E5: lanes that accept a Media-panel drop. */
const MEDIA_DROP_LANES = new Set<string>(['video', 'broll', 'music', 'sfx'])

const NO_SOURCES: readonly ClipMediaSource[] = []

/** FV4b: motion panel key for the main picture's slot (not a track id; never stored in trackMotion). */
const MAIN_MOTION_KEY = '__main__'

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
  sfxPeaks,
  sfxBeatsMs,
  sfxBpm,
  onOpenCover,
  onSelectionChange,
  editorAssets = null,
  brollMedia,
  sourceUrls = null,
  posterUrl = null,
  onDropMedia,
  onSelectSourceSegment,
  selectedSourceSegmentId = null,
  selectRequest = null,
  angleSources = NO_SOURCES,
  onMatchFrame,
  onOpenExport,
  onReplaceBrollMedia,
  inOut: controlledInOut,
  onInOutChange,
  onArmVoiceover,
  highlights,
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
  onCommitEdits?: (next: ClipEditsV2, pushHistory?: boolean) => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  /** Source ms at media time 0 of `videoUrl` (waveform slicing). */
  mediaOffsetMs?: number
  musicUrl?: string | null
  sfxDurationsMs?: Record<string, number>
  /** G2: waveform of each placed audio clip (SFX lane / audio tracks), by lane id. */
  sfxPeaks?: Record<string, AudioPeaks>
  /** G2: media-ms beats of music-length audio clips, by lane id. */
  sfxBeatsMs?: Record<string, number[]>
  /** G2fix: detected tempo of music-length audio clips, by lane id. */
  sfxBpm?: Record<string, number>
  onOpenCover?: () => void
  /** E4: the single selected item (Color / Text panels follow it); null when 0 or 2+ selected. */
  onSelectionChange?: (item: TimelineItem | null) => void
  /** FV2: full-video peaks + filmstrip sprite (null for clips). */
  editorAssets?: EditorAssets | null
  /** FV2: B-roll media rows (filmstrip on B-roll items). */
  brollMedia?: TimelineBrollMedia[]
  /** E5×FV2: media URL by refId, so other-source Video-lane spans show their own frames. */
  sourceUrls?: Record<string, string> | null
  /** FVfix: clip cover — Video-lane filmstrip fallback while frames load or when they can't be read. */
  posterUrl?: string | null
  /** E5: a Media-panel card dropped on a lane at OUTPUT ms. */
  /** G1b3: `trackId` = the row it was dropped on (extra tracks keep the item there). */
  onDropMedia?: (lane: MediaDropLane, outMs: number, mediaId: string, trackId?: string) => void
  /** E5: click on a source segment chip (Video lane) → Media panel segment editor. */
  onSelectSourceSegment?: (id: string) => void
  /** G1b2: synced camera angles in the project media library (keys 1–9 / Camera angle menu). */
  angleSources?: readonly ClipMediaSource[]
  /** G1c: F — open the source media at the playhead's moment (output ms). */
  onMatchFrame?: (outMs: number) => boolean
  /** TC1: Ctrl/Cmd+E and the command palette open the export dialog. */
  onOpenExport?: () => void
  /** FV-19: open replace-media dialog for a B-roll item id. */
  onReplaceBrollMedia?: (brollId: string) => void
  /** Optional controlled in/out marks (output ms) for export range. */
  inOut?: InOut
  onInOutChange?: (io: InOut) => void
  onArmVoiceover?: () => void
  selectedSourceSegmentId?: string | null
  /** G1a: select an item from outside (canvas click); a new `seq` re-applies. `atMs` = output ms. */
  selectRequest?: { lane: LaneId; id?: string; atMs?: number; seq: number } | null
  highlights?: {
    picks: HighlightPick[]
    ranges: HighlightRange[]
    selectedClipId: string | null
    durationMs: number
    onSelect: (clipId: string) => void
    onRangeChange: (clipId: string, range: { startMs: number; endMs: number }) => void
    onMakeClip: (pick: HighlightPick, range: HighlightRange) => void
    onOpenCard: (pick: HighlightPick) => void
  }
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
  // TC2: lanes are drawn in EXPORT time — inserts (gaps, freeze frames, inserted clips) take their
  // length on the lane and push later items right. Edits stay in base time; identity without inserts.
  const tmap = useMemo(() => exportTimeMap(tb.segs, edits.inserts), [tb.segs, edits.inserts])
  const dspan = span + tmap.totalMs
  const minPx = timelineMinPxPerSec(dspan, trackViewportPx)
  const minPxRef = useRef(minPx)
  minPxRef.current = minPx
  const longMedia = dspan > LONG_MEDIA_MS
  const effectivePxPerSec = pxPerSec ?? (longMedia ? minPx : TIMELINE_DEFAULT_PX_PER_SEC)
  const widthPx = trackWidthPx(dspan, effectivePxPerSec, trackViewportPx, minPx)
  const pxPerMs = widthPx / dspan
  const highlightLaneRanges = useMemo(
    () => (highlights ? picksToLaneRanges(highlights.picks, highlights.ranges, tb) : []),
    [highlights, tb],
  )
  /** Base ms → lane px: `xs` for starts / seek points (after an insert there), `xe` for ends. */
  const xs = (ms: number) => toExportMs(tmap, ms, 'start') * pxPerMs
  const xe = (ms: number) => toExportMs(tmap, ms, 'end') * pxPerMs
  /** Lane px → base ms (a point inside an insert → its base point). */
  const msAtPx = (px: number) => seekBaseMs(tmap, px / Math.max(1e-6, pxPerMs), span)

  const widthRef = useRef(widthPx)
  widthRef.current = widthPx

  const playheadMs = Math.max(0, Math.min(span, outputMs))
  const playheadPx = xe(playheadMs)
  const playheadPct = (playheadPx / Math.max(1, widthPx)) * 100
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
          ? fitPxPerSec(dspan, trackViewportPx, minPx)
          : initialPxPerSec(dspan, trackViewportPx, readableScale, minPx),
      )
  }, [pxPerSec, dspan, trackViewportPx, readableScale, longMedia, minPx])

  const applyZoom = useCallback(
    (nextPxPerSec: number, anchorX?: number) => {
      const el = scrollRef.current
      const prevW = widthRef.current
      const nextW = trackWidthPx(dspan, nextPxPerSec, trackViewportPx, minPxRef.current)
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
    [dspan, trackViewportPx],
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
    setPxPerSec(fitPxPerSec(dspan, trackViewportPx, minPx))
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
        !isFormControlTarget(e.target)
      ) {
        e.preventDefault()
        zoomKeysRef.current.split()
        return
      }
      // G1b: Ctrl/Cmd+B, clipboard, in/out, jumps, help from anywhere (text fields keep their keys;
      // Ctrl+C / X with a text selection on the page stays a normal text copy).
      const g1b = isFormControlTarget(e.target) ? null : timelineCommandFor(e)
      if (
        g1b &&
        (GLOBAL_COMMANDS.has(g1b) || (g1b === 'split' && (e.metaKey || e.ctrlKey) && zoomKeysRef.current.canSplit)) &&
        !((g1b === 'copy' || g1b === 'cut') && hasDomTextSelection())
      ) {
        if (cmdRef.current(g1b)) {
          e.preventDefault()
          return
        }
      }
      // G1b2: live multicam switching — keys 1–9 pick an angle at the playhead (also while playing).
      const ak = isFormControlTarget(e.target) ? null : angleKey(e)
      if (ak && angleRef.current(ak)) {
        e.preventDefault()
        return
      }
      const action = timelineZoomKeyAction(e)
      if (!action || isFormControlTarget(e.target)) return
      e.preventDefault()
      if (action === 'in') zoomKeysRef.current.zoomIn()
      else if (action === 'out') zoomKeysRef.current.zoomOut()
      else zoomKeysRef.current.zoomFit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Ctrl/Cmd + wheel zooms around the cursor; plain wheel scrolls horizontally (FVfix2).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const rect = el.getBoundingClientRect()
        applyZoom(zoomBy(pxPerSecRef.current, e.deltaY < 0 ? 'in' : 'out', 1.12, minPxRef.current), e.clientX - rect.left)
        return
      }
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault()
        el.scrollLeft += e.deltaY
      }
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
  // FVfix: waveforms always draw just the area around the viewport (clips zoomed in get wide too).
  const wavWin: [number, number] | null =
    viewportPx > 0 ? [scrollX - TRACK_OFFSET_PX - viewportPx, scrollX - TRACK_OFFSET_PX + 2 * viewportPx] : null
  const inView = (startMs: number, endMs: number) => !virtualize || (xe(endMs) >= visFromPx && xs(startMs) <= visToPx)

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
  // G2: the music decode also runs the local beat detector (markers + snapping).
  const musicPeaks = useAudioPeaks(edits.audio?.music ? musicUrl : null, 20, 12_000, { beats: true })
  // G2: beat markers on music / long audio clips (and snapping to them).
  const [beatsOn, setBeatsOn] = useState(true)
  const [fadeDrag, setFadeDrag] = useState<{ key: string; edge: 'in' | 'out'; ms: number } | null>(null)
  const fadeBurstRef = useRef<CoalesceBurst | null>(null)
  // G2: OUTPUT-ms beat marks per audio item (music bed: looped grid when "Fit to length" loops it).
  const beatMarks = useMemo(() => {
    const out: Record<string, number[]> = {}
    const m = edits.audio?.music
    const mi = lanes.music[0]
    if (m && mi && musicPeaks.beatsMs?.length) {
      out[refKey(mi)] = beatsToOutput(musicPeaks.beatsMs, { startMs: mi.startMs, endMs: mi.endMs, inMs: mi.inMs ?? 0 }, musicPeaks.durationMs || null, Boolean(m.loop))
    }
    for (const it of lanes.sfx) {
      const b = sfxBeatsMs?.[it.id]
      if (!b?.length) continue
      const cue = edits.audio?.sfx.find((x) => x.generationId === it.id)
      // G2fix: a looping music clip repeats its beat grid.
      out[refKey(it)] = beatsToOutput(b, { startMs: it.startMs, endMs: it.endMs, inMs: cue?.inMs ?? 0 }, sfxDurationsMs?.[it.id] ?? null, Boolean(cue?.loop))
    }
    return out
  }, [edits.audio, lanes, musicPeaks.beatsMs, musicPeaks.durationMs, sfxBeatsMs, sfxDurationsMs])
  const hasBeats = Object.keys(beatMarks).length > 0
  // G2: solo — items of audio tracks silenced by another track's solo draw faded.
  const soloEdits = useMemo(() => applyAudioSolo(edits), [edits])
  const editable = Boolean(onCommitEdits)

  const [selected, setSelected] = useState<ItemRef[]>([])
  const [openCompound, setOpenCompound] = useState<string | null>(null)
  const cview = useMemo(() => compoundView(edits, lanes, openCompound), [edits, lanes, openCompound])
  const hostOf = (it: TimelineItem) => cview.hosts.get(refKey(it))
  const [snapOn, setSnapOn] = useState(true)
  // G1b3: trim tools (V select · R roll · U slide) and Vegas-style auto-crossfade on overlap.
  const [tool, setTool] = useState<TrimTool>('select')
  // TC2b (TL-55): resizable / collapsible timeline (per-user, localStorage; null = fit all tracks).
  const [tlHeight, setTlHeight] = useState<number | null>(null)
  const [tlCollapsed, setTlCollapsed] = useState(false)
  useEffect(() => setTlHeight(readTimelineHeight()), [])
  const setTimelineHeight = (h: number | null) => {
    const v = h == null ? null : Math.round(Math.min(1600, Math.max(TIMELINE_MIN_H, h)))
    setTlHeight(v)
    writeTimelineHeight(v)
  }
  const [autoXfade, setAutoXfade] = useState(true)
  // TC2c (TL-49): cross-track crossfades (opt-in; overlap across tracks is often picture-in-picture).
  const [xfadeTracks, setXfadeTracksRaw] = useState(false)
  // TC4b: the ⇅ Tracks choice is a per-user preference (kept across reloads).
  useEffect(() => {
    try {
      setXfadeTracksRaw(localStorage.getItem('transovo.timeline.xfadeTracks') === '1')
    } catch {
      /* private mode */
    }
  }, [])
  const setXfadeTracks = (f: (v: boolean) => boolean) =>
    setXfadeTracksRaw((v) => {
      const n = f(v)
      try {
        if (n) localStorage.setItem('transovo.timeline.xfadeTracks', '1')
        else localStorage.removeItem('transovo.timeline.xfadeTracks')
      } catch {
        /* private mode */
      }
      return n
    })
  const [drag, setDrag] = useState<DragState | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  // E3: selected keyframe (diamond), live diamond drag, open transition pop-over.
  const [selKf, setSelKf] = useState<{ target: KeyframeTarget; times: number[] } | null>(null)
  const [kfDrag, setKfDrag] = useState<{ target: KeyframeTarget; times: number[]; delta: number } | null>(null)
  const [trPop, setTrPop] = useState<TransitionTarget | null>(null)
  // G1b: in / out marks (output ms), shortcuts sheet, add-track menu.
  const [ioInternal, setIoInternal] = useState<InOut>({ inMs: null, outMs: null })
  const io = controlledInOut ?? ioInternal
  const setIo = useCallback(
    (update: InOut | ((prev: InOut) => InOut)) => {
      const prev = controlledInOut ?? ioInternal
      const next = typeof update === 'function' ? update(prev) : update
      onInOutChange?.(next)
      if (!onInOutChange) setIoInternal(next)
    },
    [controlledInOut, ioInternal, onInOutChange],
  )
  const [helpOpen, setHelpOpen] = useState(false)
  // G1c: open track-FX inspector (key: voice | music | au<N> | ov<N>).
  const [fxPanel, setFxPanel] = useState<{ key: string; label: string } | null>(null)
  // G1c: pacing checker panel.
  const [pacingOpen, setPacingOpen] = useState(false)
  // G1c: track motion inspector (overlay tracks).
  const [motionPanel, setMotionPanel] = useState<{ key: string; label: string } | null>(null)
  // FV4b: the takes commands are findable from the toolbar too (T alone only showed a hint).
  const [takesMenu, setTakesMenu] = useState(false)
  const [takesSub, setTakesSub] = useState(false)
  const [addMenu, setAddMenu] = useState(false)
  // FV4e: the + Track menu closes on an outside click or Escape.
  const addMenuRef = useRef<HTMLDivElement>(null)
  const closeAddMenu = useCallback(() => setAddMenu(false), [])
  useDismiss(addMenuRef, addMenu, closeAddMenu)
  // G1b: Vegas-style envelopes (opacity on visual items, volume on Voice / Music) drawn on items.
  const [envOn, setEnvOn] = useState(false)
  // TC1: marker list (focus = marker being edited), command palette, loop in–out, preview speed,
  // box-select rectangle (track-area px), speed-control focus request.
  const [markerPanel, setMarkerPanel] = useState<{ focusId: string | null } | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [loopOn, setLoopOn] = useState(false)
  const previewRate = useSyncExternalStore(subscribePreviewRate, getPreviewRate, () => 1)
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const speedSlotRef = useRef<HTMLDivElement | null>(null)
  const [speedFocusSeq, setSpeedFocusSeq] = useState(0)
  const trackAreaRef = useRef<HTMLDivElement | null>(null)
  const rows = useMemo(() => timelineRows(edits), [edits])
  const rowIndexOf = (r: ItemRef) =>
    rows.findIndex((row) => row.lane === r.lane && rowItems(lanes, row).some((i) => i.id === r.id))

  useEffect(() => {
    if (openCompound && !edits.groups?.some((g) => g.id === openCompound && g.compound)) setOpenCompound(null)
  }, [edits.groups, openCompound])

  const escCloseRef = useRef<() => boolean>(() => false)
  escCloseRef.current = () => {
    if (!openCompound) return false
    if (paletteOpen || ctxMenu || addMenu || markerPanel || trPop) return false
    setOpenCompound(null)
    setSelected([])
    setSelKf(null)
    onSelRef.current?.(null)
    return true
  }
  useEffect(() => {
    if (!openCompound) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (isTextEntryTarget(e.target)) return
      if (document.querySelector('[role="dialog"][data-state="open"],[role="menu"][data-state="open"]')) return
      if (!escCloseRef.current()) return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [openCompound])

  // Drop selections whose items no longer exist (ids change after cuts / undo).
  const liveSelected = useMemo(
    () => selected.filter((r) => lanes[r.lane].some((i) => i.id === r.id)),
    [lanes, selected],
  )
  const selCompound = useMemo(() => compoundOfSelection(edits, liveSelected), [edits, liveSelected])
  const selectedKeys = useMemo(() => new Set(liveSelected.map(refKey)), [liveSelected])
  // E4: report the single selection (by key + source range so re-renders don't spam the shell).
  const singleSel = liveSelected.length === 1 ? lanes[liveSelected[0]!.lane].find((i) => i.id === liveSelected[0]!.id) ?? null : null
  const singleSelKey = singleSel ? `${refKey(singleSel)}:${singleSel.srcInMs ?? ''}:${singleSel.srcOutMs ?? ''}` : ''
  const onSelRef = useRef(onSelectionChange)
  onSelRef.current = onSelectionChange
  useEffect(() => {
    const r = selectRequest
    if (!r) return
    const it = r.id != null ? lanes[r.lane].find((i) => i.id === r.id) : lanes[r.lane].find((i) => r.atMs! >= i.startMs && r.atMs! < i.endMs)
    setSelected(it ? [{ lane: r.lane, id: it.id }] : [])
  }, [selectRequest?.seq]) // eslint-disable-line react-hooks/exhaustive-deps
  const singleSelRef = useRef(singleSel)
  singleSelRef.current = singleSel
  useEffect(() => {
    onSelRef.current?.(singleSelRef.current)
  }, [singleSelKey])

  // TC1fix: main magnet = per-user preference (default ON), read after mount (SSR-safe).
  const [magnet, setMagnet] = useState(true)
  useEffect(() => setMagnet(readMagnetPref()), [])
  const opCtx = (): OpCtx => ({ edits, previewEdits, clampTrim, sfxDurationsMs, magnet })
  // G1b2 manual multicam (angles = main + video sources; switches are E5 source segments).
  const angles = multicamAngles(edits, angleSources)
  const angleRef = useRef<(n: number) => boolean>(() => false)
  angleRef.current = (n: number) => {
    const a = angles[n - 1]
    if (!editable || angles.length < 2 || !a) return false
    const srcMs = outputToSource(tb, playheadMs)
    if (angleAt(edits, srcMs) === a.sourceId) return true
    const next = switchAngleAt(edits, srcMs, a.sourceId, angleSources)
    if (next === edits) return false
    commit(next)
    return true
  }
  const commit = (next: ClipEditsV2 | null, pushHistory = true) => {
    if (next && onCommitEdits) onCommitEdits(next, pushHistory)
  }
  // G1b3: freeze frame at the playhead (an E5b insert with no media: holds the composed frame).
  const freezeFrame = () => {
    if (!editable || refLocked(edits, { lane: 'video', id: '' })) return
    const ins = addFreezeFrame(edits.inserts, timebaseFor(previewEdits).segs, playheadMs, `frz-${crypto.randomUUID().slice(0, 8)}`)
    if (!ins) {
      toast.message('Too many inserted clips')
      return
    }
    commit({ ...edits, inserts: ins })
  }
  const split = () => {
    if (!editable) return
    if (selCompound && selCompound.id !== openCompound) {
      toast.message('Open the compound (double-click) to split inside it', { id: 'timeline-compound' })
      return
    }
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
    const next = deleteItems(opCtx(), liveSelected)
    commit(next)
    setSelected([])
    // TC1fix: magnet off — say where the gap went (the lanes show edit time; inserts are the ▼ marks).
    if (next && !magnet && (next.inserts?.length ?? 0) > (edits.inserts?.length ?? 0))
      toast.message('Gap kept (black + silence) — later clips keep their export time; the gap is the violet mark on the Video lane', { id: 'timeline-gap' })
    return true
  }
  const nudge = (dir: -1 | 1, big: boolean) => {
    // A selected keyframe diamond nudges by the same frame step (1 frame / Shift 10).
    if (selKf) {
      const r = shiftKeyframeTimes(edits, selKf.target, selKf.times, dir * arrowStepMs(big))
      commit(r.edits)
      setSelKf({ target: selKf.target, times: r.times })
      return true
    }
    const movable = liveSelected.filter((r) => lanes[r.lane].find((i) => i.id === r.id)?.caps.move)
    if (!movable.length) return false
    commit(moveItems(opCtx(), movable, dir * arrowStepMs(big)))
    return true
  }
  /** TC2b (TL-56): typed nudge ("+10" frames, "-0.5s", "+1:02"). */
  const applyNudgeText = (text: string): boolean => {
    const d = parseNudge(text)
    if (d == null) {
      toast.message('Type a signed amount: +10 (frames), -0.5s, +1:02', { id: 'timeline-nudge' })
      return false
    }
    if (!editable) return false
    if (selKf) {
      const r = shiftKeyframeTimes(edits, selKf.target, selKf.times, d)
      commit(r.edits)
      setSelKf({ target: selKf.target, times: r.times })
      return true
    }
    const movable = liveSelected.filter((r) => lanes[r.lane].find((i) => i.id === r.id)?.caps.move)
    const next = movable.length ? moveItems(opCtx(), movable, d) : null
    if (!next) {
      toast.message('Select movable items (B-roll, text, audio) to nudge', { id: 'timeline-nudge' })
      return false
    }
    commit(next)
    return true
  }
  const toggleLane = (lane: LaneId, patch: LaneState) => {
    const next = setLaneState(edits, lane, patch)
    commit(next)
    if (patch.locked) setSelected((s) => s.filter((r) => !refLocked(next, r)))
  }
  // G1b: track rows (extra tracks) toggle their own flags; default rows keep the E2 lane toggles.
  const toggleRow = (r: TimelineRow, patch: LaneState) => {
    if (r.isDefault || !r.trackId) return toggleLane(r.lane, patch)
    const next = setTrackFlags(edits, r.trackId, patch)
    commit(next)
    if (patch.locked && next) setSelected((s) => s.filter((x) => !refLocked(next, x)))
  }
  const itemState = (item: TimelineItem) => (item.track ? trackState(soloEdits, item.track) : laneState(soloEdits, item.lane))

  // ---- G1b commands (clipboard, ranges, jumps, tracks) -------------------------------------
  const copySel = (cut: boolean) => {
    const refs = copyableRefs(liveSelected)
    if (!refs.length) return false
    if (cut) {
      if (!editable) return false
      const r = cutItems(opCtx(), refs)
      if (!r) return false
      timelineClipboard.set(selCompound ? { ...r.clip, compound: { ...selCompound.compound } } : r.clip)
      commit(r.edits)
      setSelected([])
      toast.message(`Cut ${r.clip.entries.length} item${r.clip.entries.length > 1 ? 's' : ''}`, { id: 'timeline-clipboard' })
    } else {
      const c = copyItems(edits, refs)
      if (!c) return false
      timelineClipboard.set(selCompound ? { ...c, compound: { ...selCompound.compound } } : c)
      toast.message(`Copied ${c.entries.length} item${c.entries.length > 1 ? 's' : ''}`, { id: 'timeline-clipboard' })
    }
    return true
  }
  const paste = () => {
    const c = timelineClipboard.get()
    if (!c || !editable) return false
    const r = pasteItems(opCtx(), c, playheadMs)
    if (!r) {
      toast.message('Nothing to paste here', { id: 'timeline-clipboard' })
      return true
    }
    const e2 =
      c.compound && r.refs.length >= 2
        ? createCompound(r.edits, r.refs, `c_${Date.now().toString(36)}`, undefined, c.compound.name)
        : null
    commit(e2 ?? r.edits)
    setSelected(r.refs)
    if (r.skipped) toast.message(`${r.skipped} item${r.skipped > 1 ? 's' : ''} can't be placed twice (AI / library sounds)`, { id: 'timeline-clipboard' })
    return true
  }
  const duplicate = () => {
    if (!editable) return false
    const src = selCompound
    const r = duplicateItems(opCtx(), liveSelected)
    if (!r) return false
    const wrapped =
      src && r.refs.length >= 2
        ? createCompound(r.edits, r.refs, `c_${Date.now().toString(36)}`, undefined, `${src.compound.name} copy`)
        : null
    commit(wrapped ?? r.edits)
    setSelected(r.refs)
    return true
  }
  const pasteAttrs = () => {
    const c = timelineClipboard.get()
    if (!c || !editable || !liveSelected.length) return false
    const next = pasteAttributes(opCtx(), c, liveSelected)
    if (!next) toast.message('Copy a text or B-roll item first, then select items of the same kind', { id: 'timeline-clipboard' })
    commit(next)
    return true
  }
  const range = rangeOf(io, span)
  const rippleDeleteRange = () => {
    if (!range || !editable) return false
    const next = deleteRange(opCtx(), range)
    if (!next) {
      toast.message('Can’t delete that range', { id: 'timeline-range' })
      return true
    }
    commit(next)
    setIo({ inMs: null, outMs: null })
    onSeekOutput(range[0])
    return true
  }
  const jump = (dir: -1 | 1) => {
    const to = adjacentCutPoint(cutPoints(lanes, span), playheadMs, dir)
    if (to == null) return false
    onSeekOutput(to)
    return true
  }
  // ---- TC1: markers, deactivate, groups, gaps, magnet / link, loop, trim to playhead -------
  const markerNote = (m: Marker | null | undefined) => (m ? `${m.chapter ? 'Chapter' : 'Marker'}${m.label ? ` “${m.label}”` : ''}` : '')
  const toggleMarker = (): boolean => {
    if (!editable) return false
    const id = `mk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
    const next = toggleMarkerAt(edits.markers, playheadMs, id)
    commit({ ...edits, markers: next })
    return true
  }
  const jumpMarker = (dir: 1 | -1): boolean => {
    const m = adjacentMarker(edits.markers, playheadMs, dir)
    if (!m) {
      toast.message(edits.markers?.length ? `No ${dir > 0 ? 'next' : 'previous'} marker` : 'No markers — press M to add one', { id: 'timeline-markers' })
      return true
    }
    onSeekOutput(m.ms)
    const note = markerNote(m)
    if (m.label) toast.message(note, { id: 'timeline-markers' })
    return true
  }
  const patchMarkerById = (id: string, patch: Partial<Omit<Marker, 'id'>> | null) => {
    if (!editable) return
    commit({ ...edits, markers: patchMarker(edits.markers, id, patch) })
  }
  const toggleEnabled = (): boolean => {
    if (!editable) return false
    const refs = liveSelected.filter((r) => !refLocked(edits, r))
    const next = toggleItemsEnabled(edits, refs)
    if (!next) {
      toast.message('Select B-roll, text, adjustment or sound items to deactivate', { id: 'timeline-enable' })
      return true
    }
    commit(next)
    return true
  }
  const groupSel = (): boolean => {
    if (!editable) return false
    const next = groupItems(edits, liveSelected, `g_${Date.now().toString(36)}`)
    if (!next) {
      toast.message(
        liveSelected.some((r) => r.lane === 'video' || r.lane === 'voice' || r.lane === 'music')
          ? 'Main video, voice and music are tracks, not groupable — select 2 or more B-roll / text / caption / SFX / adjustment items'
          : 'Select 2 or more B-roll / text / caption / SFX / adjustment items to group',
        { id: 'timeline-group' },
      )
      return true
    }
    commit(next)
    const g = next.groups?.[next.groups.length - 1]
    toast.message(`Grouped ${g?.items.length ?? 2} items (G${next.groups?.length ?? 1})`, { id: 'timeline-group' })
    return true
  }
  const ungroupSel = (): boolean => {
    if (!editable) return false
    const next = ungroupItems(edits, liveSelected)
    if (!next) return false
    commit(next)
    toast.message('Ungrouped', { id: 'timeline-group' })
    return true
  }
  const compoundSel = (): boolean => {
    if (!editable) return false
    const next = createCompound(edits, liveSelected, `c_${Date.now().toString(36)}`, rowIndexOf)
    if (!next) {
      toast.message('Select 2 or more B-roll / text / SFX / adjustment items to make a compound clip', { id: 'timeline-compound' })
      return true
    }
    commit(next)
    const g = next.groups?.find((x) => isCompound(x) && !edits.groups?.some((o) => o.id === x.id))
    toast.message(`Created ${g?.compound?.name ?? 'compound'} (${g?.items.length ?? 2} clips)`, { id: 'timeline-compound' })
    return true
  }
  const uncompoundSel = (): boolean => {
    if (!editable || !selCompound) return false
    commit(uncompound(edits, selCompound.id))
    toast.message('Uncompounded', { id: 'timeline-compound' })
    return true
  }
  const insertGap = (): boolean => {
    if (!editable || refLocked(edits, { lane: 'video', id: '' })) return false
    const ins = addGapAt(edits.inserts, tb.segs, playheadMs, newGapId())
    if (!ins) {
      toast.message('Too many inserted clips')
      return true
    }
    // TC2: a gap inside a main clip splits it there (the gap block then sits between two pieces).
    const base = splitAt(opCtx(), [{ lane: 'video', id: '' }], playheadMs) ?? edits
    commit({ ...base, inserts: ins })
    toast.message('Gap inserted (1 s) — the black block on the Video lane; set its length under Media → Inserted clips', { id: 'timeline-gap' })
    return true
  }
  const replaceSelWithGap = (): boolean => {
    if (!editable) return false
    const next = replaceWithGaps(opCtx(), liveSelected)
    if (!next) return false
    commit(next)
    setSelected([])
    return true
  }
  const toggleOpt = (key: 'magnet' | 'rippleOverlays') => {
    if (!editable) return
    if (key === 'magnet') {
      writeMagnetPref(!magnet)
      setMagnet(!magnet)
      return
    }
    const on = rippleOverlaysOn(edits.timelineOpts)
    commit({ ...edits, timelineOpts: setTimelineOpt(edits.timelineOpts, key, !on) })
  }
  const toggleLoop = (): boolean => {
    if (!loopOn && !range) {
      toast.message('Mark in and out first (I / O), then loop', { id: 'timeline-loop' })
      return true
    }
    setLoopOn((v) => !v)
    return true
  }
  const trimToPlayhead = (edge: 'start' | 'end'): boolean => {
    if (!editable) return false
    if (selCompound && selCompound.id !== openCompound) {
      commit(trimCompound(opCtx(), selCompound, edge, playheadMs))
      return true
    }
    const inside = (i: TimelineItem | undefined) => Boolean(i && playheadMs > i.startMs + 1 && playheadMs < i.endMs - 1)
    let refs: ItemRef[] = liveSelected.filter((r) => inside(lanes[r.lane].find((i) => i.id === r.id)))
    if (!refs.length) {
      const v = lanes.video.find((i) => inside(i))
      refs = v ? [{ lane: 'video', id: v.id }] : []
    }
    if (!refs.length) {
      toast.message('Put the playhead inside the clip to trim', { id: 'timeline-trim' })
      return true
    }
    // Main video edits change the timebase: one at a time (the first); overlays all together.
    const video = refs.find((r) => r.lane === 'video')
    if (video) {
      commit(trimItem(opCtx(), video, edge, playheadMs))
      return true
    }
    let cur = edits
    for (const r of refs) {
      if (refLocked(cur, r)) continue
      const it = lanes[r.lane].find((i) => i.id === r.id)
      if (!it || !(edge === 'start' ? it.caps.trimStart : it.caps.trimEnd)) continue
      cur = trimItem({ ...opCtx(), edits: cur }, r, edge, playheadMs) ?? cur
    }
    commit(cur !== edits ? cur : null)
    return true
  }
  const openSpeed = (): boolean => {
    const sel = liveSelected.length === 1 && liveSelected[0]!.lane === 'video' ? liveSelected[0]! : null
    const v = sel ?? (() => {
      const it = lanes.video.find((i) => playheadMs >= i.startMs && playheadMs < i.endMs)
      return it ? { lane: 'video' as const, id: it.id } : null
    })()
    if (!v || !editable) return false
    setSelected([v])
    setSpeedFocusSeq((n) => n + 1)
    return true
  }
  useEffect(() => {
    if (!speedFocusSeq) return
    const id = requestAnimationFrame(() => {
      const el = speedSlotRef.current?.querySelector<HTMLElement>('input,button,[tabindex]')
      speedSlotRef.current?.scrollIntoView({ block: 'nearest' })
      el?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [speedFocusSeq])
  // TC1 (TL-37): loop in–out — playback that runs past Out jumps back to In.
  const loopPrevRef = useRef(outputMs)
  useEffect(() => {
    const prev = loopPrevRef.current
    loopPrevRef.current = outputMs
    if (!loopOn || !range) return
    const [a, b] = range
    if (prev >= a && prev < b && outputMs >= b && outputMs - prev < 1500) onSeekOutput(a)
  }, [outputMs, loopOn, range?.[0], range?.[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (loopOn && !range) setLoopOn(false)
  }, [loopOn, range])

  const runCommand = (cmd: TimelineCommand): boolean => {
    switch (cmd) {
      case 'marker':
        return toggleMarker()
      case 'nextMarker':
        return jumpMarker(1)
      case 'prevMarker':
        return jumpMarker(-1)
      case 'toggleEnabled':
        return toggleEnabled()
      case 'group':
        return groupSel()
      case 'ungroup':
        return ungroupSel()
      case 'compound':
        return compoundSel()
      case 'uncompound':
        return uncompoundSel()
      case 'openCompound':
        if (selCompound) {
          setOpenCompound(selCompound.id)
          setSelected([])
          rootRef.current?.focus({ preventScroll: true })
        }
        return Boolean(selCompound)
      case 'loop':
        return toggleLoop()
      case 'trimStart':
        return trimToPlayhead('start')
      case 'trimEnd':
        return trimToPlayhead('end')
      case 'speed':
        return openSpeed()
      case 'export':
        if (!onOpenExport) return false
        onOpenExport()
        return true
      case 'palette':
        setPaletteOpen(true)
        return true
      case 'copy':
        return copySel(false)
      case 'cut':
        return copySel(true)
      case 'paste':
        return paste()
      case 'pasteAttributes':
        return pasteAttrs()
      case 'duplicate':
        return duplicate()
      case 'split':
        split()
        return true
      case 'markIn':
        setIo((v) => ({ inMs: Math.round(playheadMs), outMs: v.outMs != null && v.outMs > playheadMs ? v.outMs : null }))
        return true
      case 'markOut':
        setIo((v) => ({ inMs: v.inMs != null && v.inMs < playheadMs ? v.inMs : null, outMs: Math.round(playheadMs) }))
        return true
      case 'clearInOut':
        setIo({ inMs: null, outMs: null })
        return true
      case 'rippleDeleteRange':
        return rippleDeleteRange()
      case 'home':
        onSeekOutput(0)
        return true
      case 'end':
        onSeekOutput(Math.max(0, span - 1))
        return true
      case 'prevEdit':
        return jump(-1)
      case 'nextEdit':
        return jump(1)
      case 'help':
        setHelpOpen(true)
        return true
      case 'nextTake':
        return cycleTake(1)
      case 'prevTake':
        return cycleTake(-1)
      case 'matchFrame':
        return onMatchFrame ? onMatchFrame(playheadMs) : false
      default:
        return false
    }
  }
  // G1c takes: the selected B-roll item's group, else the main take under the playhead.
  const cycleTake = (dir: 1 | -1): boolean => {
    if (!editable) return false
    const sel = liveSelected.length === 1 ? liveSelected[0]! : null
    if (sel?.lane === 'broll' && takeGroupOfBroll(edits, sel.id)) {
      const r = cycleBrollTake(edits, sel.id, dir)
      if (!r) return false
      commit(r.edits)
      setSelected([{ lane: 'broll', id: r.active }])
      return true
    }
    const g = takeGroupAtSource(edits, outputToSource(tb, playheadMs))
    if (g) {
      commit(cycleMainTake(edits, g.id, dir))
      return true
    }
    toast.message('No takes here — select clips and use “Group as takes”', { id: 'timeline-takes' })
    return true
  }
  const groupTakes = () => {
    const br = liveSelected.filter((r) => r.lane === 'broll').map((r) => r.id)
    if (br.length >= 2) return groupBrollTakes(edits, br)
    const vids = liveSelected
      .filter((r) => r.lane === 'video')
      .map((r) => lanes.video.find((i) => i.id === r.id))
      .filter((i): i is NonNullable<typeof i> => Boolean(i && i.srcInMs != null && i.srcOutMs != null))
      .map((i) => [i.srcInMs!, i.srcOutMs!] as [number, number])
      .sort((a, b) => a[0] - b[0])
    return vids.length >= 2 ? groupMainTakes(edits, vids, 0) : null
  }
  const selTakeGroupId = (() => {
    const sel = liveSelected.length === 1 ? liveSelected[0]! : null
    if (!sel) return null
    if (sel.lane === 'broll') return takeGroupOfBroll(edits, sel.id)?.id ?? null
    if (sel.lane === 'video') {
      const it = lanes.video.find((i) => i.id === sel.id)
      return it?.srcInMs != null ? (takeGroupAtSource(edits, it.srcInMs)?.id ?? null) : null
    }
    return null
  })()
  /** FV4b: Group as takes is eligible with 2+ B-roll or 2+ Video clips selected. */
  const canGroupTakes =
    editable &&
    (liveSelected.filter((r) => r.lane === 'broll').length >= 2 || liveSelected.filter((r) => r.lane === 'video').length >= 2)
  const menuItemCls = 'block w-full rounded px-2 py-1.5 text-left hover:bg-muted disabled:pointer-events-none disabled:opacity-50'
  /** FV4b: one takes menu for the item context menu and the toolbar (G1c actions, unchanged). */
  const renderTakesItems = (close: () => void, where: 'ctx' | 'toolbar') => (
    <>
      <button
        type="button"
        className={menuItemCls}
        role="menuitem"
        disabled={!canGroupTakes}
        title={canGroupTakes ? 'Keep these clips as alternates in one slot; T cycles' : 'Shift-click 2+ B-roll clips, or 2+ Video clips, then group them'}
        data-testid={where === 'ctx' ? 'timeline-group-takes' : 'timeline-toolbar-group-takes'}
        onClick={() => {
          // G1c: alternates in one slot; only the active take renders, T cycles.
          const n = groupTakes()
          if (n) commit(n)
          else toast.message('Pick 2–8 B-roll clips, or 2–8 Video clips that don’t overlap', { id: 'timeline-takes' })
          close()
        }}
      >
        Group as takes
        {!canGroupTakes ? <span className="block text-[10px] text-muted-foreground">Select 2+ clips first (Shift-click)</span> : null}
      </button>
      {editable && selTakeGroupId ? (
        <div
          className="group/takes relative"
          onMouseEnter={() => setTakesSub(true)}
          onMouseLeave={() => setTakesSub(false)}
        >
          <button
            type="button"
            className={menuItemCls}
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={takesSub}
            data-testid={where === 'ctx' ? 'timeline-takes-submenu' : 'timeline-toolbar-takes-submenu'}
            onClick={() => setTakesSub((v) => !v)}
          >
            Takes ▸
          </button>
          <div
            className={`${takesSub ? 'block' : 'hidden'} absolute left-full top-0 z-50 ml-0.5 min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-lg group-focus-within/takes:block`}
            role="menu"
            aria-label="Takes"
          >
            <button
              type="button"
              className={menuItemCls}
              role="menuitem"
              data-testid={where === 'ctx' ? 'timeline-next-take' : 'timeline-toolbar-next-take'}
              onClick={() => {
                cycleTake(1)
                close()
              }}
            >
              Next take (T)
            </button>
            <button
              type="button"
              className={menuItemCls}
              role="menuitem"
              data-testid={where === 'ctx' ? 'timeline-prev-take' : 'timeline-toolbar-prev-take'}
              onClick={() => {
                cycleTake(-1)
                close()
              }}
            >
              Previous take (Shift+T)
            </button>
            <button
              type="button"
              className={menuItemCls}
              role="menuitem"
              data-testid={where === 'ctx' ? 'timeline-ungroup-takes' : 'timeline-toolbar-ungroup-takes'}
              onClick={() => {
                commit(ungroupTakes(edits, selTakeGroupId))
                close()
              }}
            >
              Ungroup takes
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
  const cmdRef = useRef(runCommand)
  cmdRef.current = runCommand
  // TC1 (TL-23): box select — drag on empty track space; items the box touches are selected.
  const startMarquee = (e: React.PointerEvent<HTMLDivElement>, additive: boolean) => {
    const area = e.currentTarget
    const r0 = area.getBoundingClientRect()
    const x0 = e.clientX - r0.left
    const y0 = e.clientY - r0.top
    const base = additive ? liveSelected : []
    let moved = false
    const onMove = (ev: PointerEvent) => {
      const r = area.getBoundingClientRect()
      const x1 = ev.clientX - r.left
      const y1 = ev.clientY - r.top
      if (!moved && Math.abs(x1 - x0) < DRAG_SLOP_PX && Math.abs(y1 - y0) < DRAG_SLOP_PX) return
      moved = true
      setMarquee({ x0, y0, x1, y1 })
    }
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setMarquee(null)
      if (!moved) return
      const r = area.getBoundingClientRect()
      const box = {
        l: Math.min(x0, ev.clientX - r.left) + r.left,
        r: Math.max(x0, ev.clientX - r.left) + r.left,
        t: Math.min(y0, ev.clientY - r.top) + r.top,
        b: Math.max(y0, ev.clientY - r.top) + r.top,
      }
      const hit: ItemRef[] = [...base]
      const seen = new Set(hit.map(refKey))
      area.querySelectorAll<HTMLElement>('[data-testid^="timeline-item-"][data-item-id], [data-testid="timeline-compound"][data-item-id]').forEach((el) => {
        const lane = (el.dataset.lane ?? el.dataset.testid!.slice('timeline-item-'.length)) as LaneId
        const id = el.dataset.itemId!
        if (lane === 'voice' || !lanes[lane]?.some((i) => i.id === id)) return
        const b = el.getBoundingClientRect()
        if (b.right < box.l || b.left > box.r || b.bottom < box.t || b.top > box.b) return
        const ref = { lane, id }
        if (refLocked(edits, ref) || seen.has(refKey(ref))) return
        seen.add(refKey(ref))
        hit.push(ref)
      })
      setSelected(expandToGroups(edits, hit, (lane, id) => ({ lane: lane as LaneId, id }), openCompound))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
  // TC1 (TL-54): every command by name (Ctrl/Cmd+K).
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')
  const mk = mac ? '⌘' : 'Ctrl+'
  const paletteCommands: PaletteCommand[] = [
    { id: 'split', group: 'Edit', label: 'Split at playhead', keys: 'S', run: split, disabled: !editable },
    { id: 'delete', group: 'Edit', label: 'Delete selected', keys: 'Del', run: () => void del(), disabled: !editable || !liveSelected.length },
    { id: 'copy', group: 'Edit', label: 'Copy', keys: `${mk}C`, run: () => void copySel(false) },
    { id: 'cut', group: 'Edit', label: 'Cut', keys: `${mk}X`, run: () => void copySel(true), disabled: !editable },
    { id: 'paste', group: 'Edit', label: 'Paste at playhead', keys: `${mk}V`, run: () => void paste(), disabled: !editable },
    { id: 'duplicate', group: 'Edit', label: 'Duplicate', keys: `${mk}D`, run: () => void duplicate(), disabled: !editable },
    { id: 'pasteAttrs', group: 'Edit', label: 'Paste attributes', keys: `${mk}Shift+V`, run: () => void pasteAttrs(), disabled: !editable },
    { id: 'trimStart', group: 'Edit', label: 'Trim start to playhead', keys: '[', run: () => void trimToPlayhead('start'), disabled: !editable },
    { id: 'trimEnd', group: 'Edit', label: 'Trim end to playhead', keys: ']', run: () => void trimToPlayhead('end'), disabled: !editable },
    { id: 'toggleEnabled', group: 'Edit', label: 'Deactivate / activate selected', keys: 'Shift+E', run: () => void toggleEnabled(), disabled: !editable },
    { id: 'group', group: 'Edit', label: 'Group selected', keys: `${mk}G`, run: () => void groupSel(), disabled: !editable },
    { id: 'ungroup', group: 'Edit', label: 'Ungroup selected', keys: `${mk}Shift+G`, run: () => void ungroupSel(), disabled: !editable },
    { id: 'compound', group: 'Edit', label: 'Create compound clip', keys: 'Alt+G', run: () => void compoundSel(), disabled: !editable },
    { id: 'uncompound', group: 'Edit', label: 'Uncompound', keys: 'Alt+Shift+G', run: () => void uncompoundSel(), disabled: !editable || !selCompound },
    { id: 'openCompound', group: 'Edit', label: 'Open compound', run: () => void runCommand('openCompound'), disabled: !selCompound },
    { id: 'freeze', group: 'Edit', label: 'Freeze frame at playhead', run: freezeFrame, disabled: !editable },
    { id: 'gap', group: 'Edit', label: 'Insert gap at playhead', run: () => void insertGap(), disabled: !editable },
    { id: 'replaceGap', group: 'Edit', label: 'Replace selected main clip with gap', run: () => void replaceSelWithGap(), disabled: !editable || !liveSelected.some((r) => r.lane === 'video') },
    { id: 'speed', group: 'Edit', label: 'Speed of the clip under the playhead', keys: `${mk}R`, run: () => void openSpeed(), disabled: !editable },
    { id: 'matchFrame', group: 'Edit', label: 'Match frame', keys: 'F', run: () => void (onMatchFrame && onMatchFrame(playheadMs)), disabled: !onMatchFrame },
    { id: 'nextTake', group: 'Edit', label: 'Next take', keys: 'T', run: () => void cycleTake(1), disabled: !editable },
    { id: 'undo', group: 'Edit', label: 'Undo', keys: `${mk}Z`, run: () => onUndo?.(), disabled: !onUndo || !canUndo },
    { id: 'redo', group: 'Edit', label: 'Redo', keys: `${mk}Shift+Z`, run: () => onRedo?.(), disabled: !onRedo || !canRedo },
    { id: 'marker', group: 'Markers', label: 'Add / remove marker at playhead', keys: 'M', run: () => void toggleMarker(), disabled: !editable },
    { id: 'nextMarker', group: 'Markers', label: 'Next marker', keys: 'Shift+M', run: () => void jumpMarker(1) },
    { id: 'prevMarker', group: 'Markers', label: 'Previous marker', keys: 'Alt+M', run: () => void jumpMarker(-1) },
    { id: 'markerList', group: 'Markers', label: 'Marker list / copy chapters', run: () => setMarkerPanel({ focusId: null }) },
    { id: 'markIn', group: 'Range', label: 'Mark in', keys: 'I', run: () => void runCommand('markIn') },
    { id: 'markOut', group: 'Range', label: 'Mark out', keys: 'O', run: () => void runCommand('markOut') },
    { id: 'clearIO', group: 'Range', label: 'Clear in / out', keys: 'Alt+X', run: () => void runCommand('clearInOut') },
    { id: 'rangeDel', group: 'Range', label: 'Delete in–out range (ripple)', keys: 'Shift+Del', run: () => void rippleDeleteRange(), disabled: !range || !editable },
    { id: 'loop', group: 'Range', label: loopOn ? 'Stop looping in–out' : 'Loop in–out', keys: 'Alt+L', run: () => void toggleLoop() },
    { id: 'home', group: 'Playback', label: 'Go to start', keys: 'Home', run: () => onSeekOutput(0) },
    { id: 'end', group: 'Playback', label: 'Go to end', keys: 'End', run: () => onSeekOutput(Math.max(0, span - 1)) },
    { id: 'prevEdit', group: 'Playback', label: 'Previous edit point', keys: '↑', run: () => void jump(-1) },
    { id: 'nextEdit', group: 'Playback', label: 'Next edit point', keys: '↓', run: () => void jump(1) },
    ...PREVIEW_RATES.map((r) => ({ id: `rate${r}`, group: 'Playback', label: `Preview speed ${r}×`, run: () => setPreviewRate(r) })),
    { id: 'snap', group: 'Timeline', label: snapOn ? 'Snapping off' : 'Snapping on', keys: 'N', run: () => setSnapOn((v) => !v) },
    { id: 'magnet', group: 'Timeline', label: magnet ? 'Main magnet off (deletes leave gaps)' : 'Main magnet on (deletes close gaps)', run: () => toggleOpt('magnet'), disabled: !editable },
    { id: 'link', group: 'Timeline', label: rippleOverlaysOn(edits.timelineOpts) ? 'Unlink overlays from the main track' : 'Link overlays to the main track', run: () => toggleOpt('rippleOverlays'), disabled: !editable },
    { id: 'envelopes', group: 'Timeline', label: envOn ? 'Hide envelopes' : 'Show envelopes', run: () => setEnvOn((v) => !v) },
    { id: 'pacing', group: 'Timeline', label: 'Pacing check', run: () => setPacingOpen(true) },
    { id: 'zoomFit', group: 'Timeline', label: 'Zoom to fit', keys: '0', run: zoomFit },
    { id: 'zoomIn', group: 'Timeline', label: 'Zoom in', keys: '+', run: zoomIn },
    { id: 'zoomOut', group: 'Timeline', label: 'Zoom out', keys: '-', run: zoomOut },
    { id: 'addOverlay', group: 'Timeline', label: 'Add video overlay track', run: () => addTrackOf('overlay'), disabled: !editable || !canAddTrack(edits, 'overlay') },
    { id: 'addText', group: 'Timeline', label: 'Add text track', run: () => addTrackOf('text'), disabled: !editable || !canAddTrack(edits, 'text') },
    { id: 'addAudio', group: 'Timeline', label: 'Add audio track', run: () => addTrackOf('audio'), disabled: !editable || !canAddTrack(edits, 'audio') },
    { id: 'help', group: 'Timeline', label: 'Keyboard shortcuts', keys: '?', run: () => setHelpOpen(true) },
    ...(onOpenExport ? [{ id: 'export', group: 'File', label: 'Export', keys: `${mk}E`, run: onOpenExport }] : []),
  ]
  const addTrackOf = (kind: TrackKind, above?: string) => {
    const r = addTrack(edits, kind, { above })
    if (!r) {
      toast.message('Track limit reached', { id: 'timeline-track' })
      return
    }
    commit(r.edits)
    setAddMenu(false)
  }
  /** G1c: which track-FX key a row has (text tracks and the main picture have none). */
  const fxKeyOf = (r: TimelineRow): string | null =>
    r.lane === 'voice' || r.lane === 'music' ? r.lane : r.trackId && (r.lane === 'sfx' || r.lane === 'broll') ? r.trackId : null
  const fxActions = (r: TimelineRow): { onFx?: () => void; fxOn?: boolean; onMotion?: () => void; motionOn?: boolean } => {
    const key = fxKeyOf(r)
    if (!key) return {}
    const fx = { onFx: () => setFxPanel({ key, label: r.label }), fxOn: hasFx(trackFxFor(edits, key)) }
    if (r.lane !== 'broll' || !r.trackId) return fx
    const tid = r.trackId
    return { ...fx, onMotion: () => setMotionPanel({ key: tid, label: r.label }), motionOn: Boolean(trackMotionFor(edits, tid)) }
  }
  const trackActions = (r: TimelineRow) => {
    if (!editable) return undefined
    if (!r.trackId && r.lane === 'video') {
      // FV4b: the main picture's slot (2-up / 3-up) from the Video header menu, same panel as overlays.
      return {
        onMotion: () => setMotionPanel({ key: MAIN_MOTION_KEY, label: 'Main video' }),
        motionLabel: 'Main video slot…',
      }
    }
    if (!r.trackId) {
      const fx = fxActions(r)
      return fx.onFx ? fx : undefined
    }
    const mv = trackMoves(edits, r.trackId)
    const kind = LANE_TRACK_KIND[r.lane]!
    return {
      ...fxActions(r),
      visual: kind !== 'audio',
      onRename: (name: string) => commit(renameTrack(edits, r.trackId!, name)),
      onMoveUp: mv.up ? () => commit(moveTrack(edits, r.trackId!, 'up')) : undefined,
      onMoveDown: mv.down ? () => commit(moveTrack(edits, r.trackId!, 'down')) : undefined,
      onAddAbove: canAddTrack(edits, kind) ? () => addTrackOf(kind, r.trackId) : undefined,
      onRemove: r.isDefault
        ? undefined
        : () => {
            const n = rowItems(lanes, r).length
            if (n && typeof window !== 'undefined' && !window.confirm(`Remove “${r.label}” and its ${n} item${n > 1 ? 's' : ''}?`)) return
            commit(removeTrack(edits, r.trackId!))
          },
    }
  }


  // ---- E3 keyframes / transitions -------------------------------------------
  const startKfDrag = (
    e: React.PointerEvent,
    target: KeyframeTarget,
    tMs: number,
    origin: number,
    itemStartMs: number,
    itemEndMs: number,
    itemWidthPx: number,
  ) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    rootRef.current?.focus({ preventScroll: true })
    const additive = e.shiftKey
    const sel =
      additive || !(selKf?.target === target && selKf.times.includes(tMs)) ? toggleKfSelection(selKf, target, tMs, additive) : selKf!
    setSelKf(sel)
    onSeekOutput(origin + tMs)
    if (additive) return
    if (!editable) return
    const originX = e.clientX
    const x0 = keyframeDiamondLeftPx(edits, origin, itemStartMs, itemEndMs, itemWidthPx, tMs)
    const state = { toMs: tMs, moved: false }
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - originX
      if (!state.moved && Math.abs(dx) < DRAG_SLOP_PX) return
      state.moved = true
      let t = keyframeLocalEditFromDiamondPx(edits, origin, itemStartMs, itemEndMs, itemWidthPx, x0 + dx)
      const ph = keyframeLocalEditFromPlayhead(edits, playheadMs, origin)
      if (Math.abs(t - ph) * pxPerMs < SNAP_PX && snapOn) t = ph
      else t = Math.round(t / (1000 / 30)) * (1000 / 30)
      t = Math.max(0, Math.round(t))
      state.toMs = t
      setKfDrag({ target, times: sel.times, delta: t - tMs })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setKfDrag(null)
      if (!state.moved || state.toMs === tMs) return
      const r = shiftKeyframeTimes(edits, target, sel.times, state.toMs - tMs)
      commit(r.edits)
      setSelKf({ target, times: r.times })
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
        label: w.sourceId === 'main' ? 'Main' : sourceById(edits.sources, w.sourceId)?.label ?? 'Source',
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
    return msAtPx(((clientX - r.left) / Math.max(1, r.width)) * widthPx)
  }

  const rowOfItem = (item: TimelineItem) => rows.find((r) => r.lane === item.lane && (!r.trackId || r.trackId === item.track))
  /** Row (same lane kind, unlocked track) under a client Y, for drag between tracks. */
  const trackRowAt = (clientY: number, lane: LaneId): string | null => {
    const el = trackAreaRef.current
    if (!el || !LANE_TRACK_KIND[lane]) return null
    const y = clientY - el.getBoundingClientRect().top
    let top = RULER_H
    for (const r of rows) {
      const h = LANE_H[r.lane]
      if (y >= top && y < top + h) return r.lane === lane && r.trackId && !trackState(edits, r.trackId).locked ? r.key : null
      top += h
    }
    return null
  }
  /** G1b: drag a main-track clip earlier / later (CapCut main track; ripple, no gaps). */
  const startVideoReorder = (e: React.PointerEvent, item: TimelineItem) => {
    // TC4b (3): no native drag of the filmstrip images (it swallowed pointerup, so the drop only
    // completed on an extra click); a cancelled pointer ends the drag like a release.
    // TC4fix2: pointer capture so pointerup/pointermove always fire after a slow drag (R2).
    e.preventDefault()
    const captureEl = e.currentTarget as HTMLElement
    try {
      captureEl.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    const grabMs =
      item.startMs + (e.clientX - captureEl.getBoundingClientRect().left) / Math.max(1e-6, pxPerMs)
    const state: DragState = { mode: 'move', item, refs: [{ lane: 'video', id: item.id }], originX: e.clientX, deltaMs: 0, snappedTo: null, moved: false, reorder: true, insertBefore: undefined }
    setDrag(state)
    const slotFromPointer = (dx: number) => {
      const pointerMs = grabMs + dx / Math.max(1e-6, pxPerMs)
      const before = reorderInsertBefore(lanes.video, item.id, pointerMs)
      return isNoopReorder(lanes.video, item.id, before) ? undefined : before
    }
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - state.originX
      if (!state.moved && Math.abs(dx) < DRAG_SLOP_PX * 2) return
      state.moved = true
      state.deltaMs = dx / Math.max(1e-6, pxPerMs)
      state.insertBefore = slotFromPointer(dx)
      setDrag({ ...state })
    }
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      try {
        captureEl.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      setDrag(null)
      if (!state.moved) return
      let before = state.insertBefore
      if (before === undefined) {
        const resolved = slotFromPointer(ev.clientX - state.originX)
        if (resolved === undefined) return
        before = resolved
      }
      const next = moveVideoSegment(opCtx(), item.id, before)
      if (next) commit(next)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const startDrag = (e: React.PointerEvent, item: TimelineItem, mode: DragState['mode']) => {
    if (e.button !== 0) return
    // TC2b: the Hand tool scrolls from anywhere (the track area handles it).
    if (tool === 'hand') return
    e.stopPropagation()
    if (tool === 'blade' && editable && !refLocked(edits, item)) {
      // TC2b (TL-18): Blade — split the clicked clip at the click point.
      rootRef.current?.focus({ preventScroll: true })
      const area = trackAreaRef.current
      const at = area ? msAtClientX(e.clientX, area) : playheadMs
      const next = splitAt(opCtx(), [{ lane: item.lane, id: item.id }], at)
      if (next) commit(next)
      else toast.message('Can’t split here (too close to an edge)', { id: 'timeline-blade' })
      return
    }
    rootRef.current?.focus({ preventScroll: true })
    const key = refKey(item)
    const multi = e.shiftKey || e.metaKey || e.ctrlKey
    if (refLocked(edits, item)) {
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
    // TC1 (TL-30): clicking one member of a group selects (and drags) the whole group.
    const groupSel0 = expandToGroups(edits, [{ lane: item.lane, id: item.id }], (lane, id) => ({ lane: lane as LaneId, id }), openCompound).filter(
      (r) => lanes[r.lane].some((i) => i.id === r.id) && !refLocked(edits, r),
    )
    if (!already) setSelected(groupSel0)
    if (!editable) return
    const slideTool = tool === 'slide' && mode === 'move' && (item.lane === 'video' || item.lane === 'broll' || item.lane === 'text')
    const rollTool = tool === 'roll' && mode !== 'move'
    const slipTool = tool === 'slip' && mode === 'move' && item.lane === 'broll'
    if (slipTool) {
      const x0 = e.clientX
      const st: DragState = { mode, item, refs: [{ lane: item.lane, id: item.id }], originX: x0, deltaMs: 0, snappedTo: null, moved: false, alt: false }
      setDrag(st)
      const mv = (ev: PointerEvent) => {
        const dx = ev.clientX - x0
        if (!st.moved && Math.abs(dx) < DRAG_SLOP_PX) return
        st.moved = true
        st.deltaMs = dx / Math.max(1e-6, pxPerMs)
        setDrag({ ...st })
      }
      const up = () => {
        window.removeEventListener('pointermove', mv)
        window.removeEventListener('pointerup', up)
        setDrag(null)
        if (st.moved && st.deltaMs) {
          const next = slipEdit(edits, item.id, st.deltaMs)
          if (next) commit(next)
        }
      }
      window.addEventListener('pointermove', mv)
      window.addEventListener('pointerup', up)
      return
    }
    if (!slideTool && mode === 'move' && item.lane === 'video' && lanes.video.length > 1) {
      startVideoReorder(e, item)
      return
    }
    if (mode === 'move' && !item.caps.move && !slideTool) return
    if (mode === 'start' && !item.caps.trimStart) return
    if (mode === 'end' && !item.caps.trimEnd) return
    const refs =
      mode === 'move' && (already || groupSel0.length > 1)
        ? (already ? liveSelected : groupSel0).filter((r) => lanes[r.lane].find((i) => i.id === r.id)?.caps.move)
        : [{ lane: item.lane, id: item.id }]
    const moving = refs.map((r) => lanes[r.lane].find((i) => i.id === r.id)!).filter(Boolean)
    const exclude = new Set(refs.map(refKey))
    // G2: beats of the items being dragged move with them — never snap to those.
    const beatSnap = beatsOn ? Object.entries(beatMarks).flatMap(([k, v]) => (exclude.has(k) ? [] : v)) : []
    const targets = snapTargets({ lanes, durationMs: span, playheadMs, wordEdgesMs: wordEdges, exclude, beatsMs: beatSnap })
    const thr = SNAP_PX / Math.max(1e-6, pxPerMs)
    const ctx = opCtx()
    const state: DragState = { mode, item, refs, originX: e.clientX, deltaMs: 0, snappedTo: null, moved: false, alt: e.altKey }
    setDrag(state)
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - state.originX
      if (!state.moved && Math.abs(dx) < DRAG_SLOP_PX) return
      state.moved = true
      // TC2b: lanes are in export time — a drag across an insert lands where the pointer is
      // (display delta → base delta at the dragged edge), not off by the insert's length.
      const anchor = mode === 'end' ? item.endMs : item.startMs
      const rule = mode === 'end' ? 'end' : 'start'
      const raw = tmap.totalMs
        ? toBaseMs(tmap, Math.max(0, toExportMs(tmap, anchor, rule) + dx / Math.max(1e-6, pxPerMs))) - anchor
        : dx / Math.max(1e-6, pxPerMs)
      const snapping = snapOn && !ev.altKey
      if (ev.altKey) state.alt = true
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
      if (mode === 'move') state.targetRow = trackRowAt(ev.clientY, item.lane)
      setDrag({ ...state })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setDrag(null)
      const fromRow = rowOfItem(item)?.key ?? null
      const toRow = mode === 'move' && state.targetRow && state.targetRow !== fromRow ? rows.find((r) => r.key === state.targetRow) : undefined
      if (toRow?.trackId && state.moved && !slideTool) {
        // G1b: dropped on another track (and maybe moved in time) — one undo step.
        const moved = state.deltaMs ? moveItems(ctx, state.refs, state.deltaMs) ?? ctx.edits : ctx.edits
        const onTrack = moveItemsToTrack(moved, state.refs, toRow.trackId) ?? (moved !== ctx.edits ? moved : null)
        // TC2c (TL-49): a drop onto another track can crossfade with what it overlaps there.
        commit(onTrack && autoXfade ? autoCrossfade(ctx.edits, onTrack, ctx.previewEdits, ctx.previewEdits, state.refs, sfxDurationsMs, xfadeTracks) : onTrack)
        return
      }
      if (!state.moved || !state.deltaMs) return
      const ref = { lane: item.lane, id: item.id }
      if (slideTool) return commit(slideEdit(ctx, ref, state.deltaMs))
      if (rollTool) return commit(rollEdit(ctx, ref, mode as 'start' | 'end', state.deltaMs))
      if (state.alt && mode !== 'move' && (item.lane === 'video' || item.lane === 'voice')) {
        // G1b3: Alt-drag = J / L — only the sound (Voice edge) or only the picture (Video edge) moves.
        // Not at a real cut (clip in / out point): Alt keeps its old meaning (no snapping trim).
        const edge = mode === 'start' ? item.startMs : item.endMs
        const jl = splitEdgeTrim(ctx, ref, mode, edge + state.deltaMs)
        if (jl) return commit(jl)
      }
      if (mode === 'move') {
        const moved = moveItems(ctx, state.refs, state.deltaMs)
        commit(moved && autoXfade ? autoCrossfade(ctx.edits, moved, ctx.previewEdits, ctx.previewEdits, state.refs, sfxDurationsMs, xfadeTracks) : moved)
      } else {
        const edge = mode === 'start' ? item.startMs : item.endMs
        const host = hostOf(item)
        if (host) return commit(trimCompound(ctx, host.group, mode, edge + state.deltaMs))
        commit(trimItem(ctx, { lane: item.lane, id: item.id }, mode, edge + state.deltaMs))
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  /** Live (uncommitted) geometry while dragging. */
  const shown = (item: TimelineItem): { startMs: number; endMs: number } => {
    if (!drag?.moved) return item
    if (drag.reorder) return refKey(drag.item) === refKey(item) ? { startMs: item.startMs + drag.deltaMs, endMs: item.endMs + drag.deltaMs } : item
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
    if (isFormControlTarget(e.target)) return
    const mod = e.metaKey || e.ctrlKey
    const k = e.key
    // G1b: clipboard, Ctrl+B, in/out, Home/End, ↑/↓ edit points, shortcuts sheet.
    const g1b = timelineCommandFor(e)
    if (g1b && (GLOBAL_COMMANDS.has(g1b) || (g1b === 'split' && mod)) && !(g1b === 'copy' && hasDomTextSelection())) {
      if (runCommand(g1b)) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
    }
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
    } else if (!mod && !e.altKey && TRIM_TOOL_KEYS[k.toLowerCase()]) {
      e.preventDefault()
      e.stopPropagation()
      setTool(TRIM_TOOL_KEYS[k.toLowerCase()]!)
    } else if ((k === 'Delete' || k === 'Backspace') && editable && selKf) {
      e.preventDefault()
      e.stopPropagation()
      commit(deleteKeyframeTimes(edits, selKf.target, selKf.times))
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
      if (openCompound) {
        e.preventDefault()
        e.stopPropagation()
        setOpenCompound(null)
        setSelected([])
        setSelKf(null)
        onSelRef.current?.(null)
        return
      }
      setTool('select')
      lockedClickRef.current = null
      setSelected([])
      setSelKf(null)
      setCtxMenu(null)
      setTrPop(null)
      onSelRef.current?.(null)
    } else if (mod && (k === 'a' || k === 'A')) {
      e.preventDefault()
      e.stopPropagation()
      const all: ItemRef[] = []
      for (const lane of LANE_ORDER) {
        if (lane === 'voice') continue
        for (const it of lanes[lane]) if ((it.caps.move || it.caps.del) && !refLocked(edits, it)) all.push({ lane, id: it.id })
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
  const showAiCutTicks =
    previewEdits.trim.in !== clipStartMs || previewEdits.trim.out !== clipEndMs

  const rowTop = (key: string) => {
    let y = RULER_H
    for (const r of rows) {
      if (r.key === key) return y
      y += LANE_H[r.lane]
    }
    return y
  }
  const totalH = RULER_H + rows.reduce((s, r) => s + LANE_H[r.lane], 0)

  const tbtn =
    'inline-flex h-7 items-center gap-1 rounded px-1.5 text-[11px] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40'

  /** G2: fade lengths of an audio item (music defaults 0.5 s / 1 s; clips 0). */
  const fadesOf = (item: TimelineItem): { fi: number; fo: number } => {
    if (item.lane === 'music') {
      const m = edits.audio?.music
      return { fi: m?.fadeInMs ?? DEFAULT_MUSIC_FADE_IN_MS, fo: m?.fadeOutMs ?? DEFAULT_MUSIC_FADE_OUT_MS }
    }
    const c = edits.audio?.sfx.find((x) => x.generationId === item.id)
    return { fi: c?.fadeInMs ?? 0, fo: c?.fadeOutMs ?? 0 }
  }
  const startFadeDrag = (e: React.PointerEvent, item: TimelineItem, edge: 'in' | 'out') => {
    e.stopPropagation()
    e.preventDefault()
    const { fi, fo } = fadesOf(item)
    const lenMs = item.endMs - item.startMs
    const key = refKey(item)
    const x0 = e.clientX
    const calc = (ev: PointerEvent) =>
      // G2fix: time per px follows the zoom, capped when zoomed far out (Shift / Alt = fine).
      fadeFromDrag(edge, lenMs, edge === 'in' ? fi : fo, edge === 'in' ? fo : fi, (ev.clientX - x0) * fadeDragMsPerPx(pxPerMs, ev.shiftKey || ev.altKey))
    let last = edge === 'in' ? fi : fo
    setFadeDrag({ key, edge, ms: last })
    const burstKey = `${key}:${edge}`
    const commitFade = (ms: number) => {
      const next = patchAudioClip(edits, item.lane as 'music' | 'sfx', item.id, edge === 'in' ? { fadeInMs: ms } : { fadeOutMs: ms })
      if (!next) return
      const now = Date.now()
      const push = coalescePush(fadeBurstRef.current, burstKey, now, String(ms))
      fadeBurstRef.current = { key: burstKey, at: now, sig: String(ms) }
      commit(next, push)
    }
    const onMove = (ev: PointerEvent) => {
      last = calc(ev)
      setFadeDrag({ key, edge, ms: last })
      commitFade(last)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setFadeDrag(null)
      fadeBurstRef.current = null
      if (last === (edge === 'in' ? fi : fo)) return
      commitFade(last)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
  /** G2: fade ramps (shaded) + draggable fade handles on music / audio clips. */
  const renderFades = (item: TimelineItem, geo: { startMs: number; endMs: number }, w: number, h: number, st: LaneState) => {
    const key = refKey(item)
    const lenMs = Math.max(1, geo.endMs - geo.startMs)
    let { fi, fo } = fadesOf(item)
    if (fadeDrag?.key === key) {
      if (fadeDrag.edge === 'in') fi = fadeDrag.ms
      else fo = fadeDrag.ms
    }
    // G2fix: draw what plays — each fade at most half the clip (export clamps the same way).
    fi = Math.min(fi, lenMs / 2)
    fo = Math.min(fo, lenMs / 2)
    const fiPx = fi * pxPerMs
    const foPx = fo * pxPerMs
    const hh = h - 4
    const handles = editable && !st.locked && w > 24
    return (
      <>
        {fiPx > 0.5 || foPx > 0.5 ? (
          <svg className="pointer-events-none absolute inset-0" width={w} height={hh} aria-hidden data-testid="timeline-fade-shade">
            {fiPx > 0.5 ? <polygon points={`0,0 ${fiPx},0 0,${hh}`} fill="rgba(0,0,0,0.35)" /> : null}
            {foPx > 0.5 ? <polygon points={`${w - foPx},0 ${w},0 ${w},${hh}`} fill="rgba(0,0,0,0.35)" /> : null}
          </svg>
        ) : null}
        {handles
          ? (['in', 'out'] as const).map((edge) => (
              <span
                key={`fade-${edge}`}
                role="slider"
                aria-label={`Fade ${edge}`}
                aria-valuenow={Math.round(edge === 'in' ? fi : fo)}
                className="absolute top-0 z-10 size-2 -translate-x-1/2 cursor-ew-resize rounded-full border border-black/50 bg-white/90"
                style={{ left: edge === 'in' ? Math.max(4, fiPx) : Math.min(w - 4, w - foPx) }}
                title={`Fade ${edge}: ${((edge === 'in' ? fi : fo) / 1000).toFixed(2)} s — drag`}
                data-testid={`timeline-fade-${edge}`}
                onPointerDown={(e) => startFadeDrag(e, item, edge)}
              />
            ))
          : null}
      </>
    )
  }

  const renderItem = (item: TimelineItem) => {
    const geo = shown(item)
    const left = xs(geo.startMs)
    const w = Math.max(2, xe(geo.endMs) - left)
    const st = itemState(item)
    const isSel = selectedKeys.has(refKey(item))
    // TC1: deactivated items stay on the timeline, dimmed + striped.
    const off = isDisabled(edits, item)
    const grp = groupOf(edits, item)
    const host = hostOf(item)
    const dimmed = Boolean(openCompound && grp?.id !== openCompound)
    const inOpen = Boolean(openCompound && grp?.id === openCompound)
    const inGroup = Boolean(grp) && !host
    // TC1fix: a group is visible — numbered badge on every member, amber outline while selected.
    const grpNo = grp ? (edits.groups ?? []).indexOf(grp) + 1 : 0
    const grpSel = Boolean(grp && !host && grp.items.some((k) => selectedKeys.has(k)))
    const faded = st.hidden || st.muted || off
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
        className={`absolute top-0.5 overflow-hidden rounded-[3px] text-[10px] leading-4 text-white ${
          host ? 'bg-violet-600' : LANE_COLORS[item.lane]
        } ${isSel ? 'ring-2 ring-white ring-offset-1 ring-offset-primary' : ''} ${faded ? 'opacity-40' : ''} ${
          dimmed ? 'pointer-events-none opacity-30' : ''
        } ${inOpen ? 'outline outline-dashed outline-1 outline-violet-300' : ''} ${
          grpSel ? 'outline outline-2 outline-amber-400' : inGroup ? 'outline-dashed outline-1 outline-white/70' : ''
        } ${st.locked ? 'cursor-not-allowed' : item.caps.move ? 'cursor-grab' : interactive ? 'cursor-pointer' : ''}`}
        style={{
          left,
          width: w,
          height: h - 4,
          pointerEvents: interactive && !dimmed ? 'auto' : 'none',
          ...(off ? { backgroundImage: 'repeating-linear-gradient(135deg, rgba(0,0,0,0.45) 0 4px, transparent 4px 8px)' } : {}),
        }}
        data-testid={host ? 'timeline-compound' : `timeline-item-${item.lane}`}
        data-lane={item.lane}
        data-item-id={item.id}
        data-start-ms={Math.round(item.startMs)}
        data-end-ms={Math.round(item.endMs)}
        data-selected={isSel ? 'true' : undefined}
        data-disabled={off ? 'true' : undefined}
        data-grouped={inGroup || host ? 'true' : undefined}
        data-group-selected={grpSel ? 'true' : undefined}
        data-compound={host ? host.group.id : undefined}
        title={`${off ? '[Deactivated] ' : ''}${host ? '[Compound] ' : inGroup ? '[Grouped] ' : ''}${item.label} · ${(item.startMs / 1000).toFixed(2)}–${(item.endMs / 1000).toFixed(2)} s`}
        onPointerDown={interactive && !dimmed ? (e) => startDrag(e, item, 'move') : undefined}
        onDoubleClick={
          host
            ? (e) => {
                e.stopPropagation()
                setOpenCompound(host.group.id)
                setSelected([])
              }
            : undefined
        }
        onContextMenu={(e) => {
          if (!interactive || dimmed) return
          e.preventDefault()
          e.stopPropagation()
          if (!selectedKeys.has(refKey(item)))
            setSelected(expandToGroups(edits, [{ lane: item.lane, id: item.id }], (lane, id) => ({ lane: lane as LaneId, id }), openCompound))
          setCtxMenu({ x: e.clientX, y: e.clientY })
        }}
      >
        {host ? (
          <span
            className="pointer-events-none absolute right-0.5 top-0.5 z-[3] rounded-sm bg-violet-200 px-0.5 text-[8px] font-semibold leading-[10px] text-violet-950"
            title="Compound — double-click to open"
            data-testid="timeline-group-badge"
          >
            ⧉
          </span>
        ) : inGroup ? (
          <span
            className="pointer-events-none absolute right-0.5 top-0.5 z-[3] rounded-sm bg-amber-400 px-0.5 text-[8px] font-semibold leading-[10px] text-black"
            title={`Group ${grpNo} (click one = select all · Ctrl+Shift+G ungroups)`}
            data-testid="timeline-group-badge"
          >
            G{grpNo}
          </span>
        ) : null}
        {!host && item.lane === 'video' && item.srcInMs != null && item.srcOutMs != null ? (
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
            stillUrl={posterUrl}
          />
        ) : null}
        {!host && item.lane === 'broll' && bMedia ? (
          <BrollFilmstrip
            media={bMedia}
            fromMs={item.inMs ?? 0}
            toMs={(item.inMs ?? 0) + (item.endMs - item.startMs)}
            widthPx={w}
            heightPx={h - 4}
            pxPerMs={pxPerMs}
          />
        ) : null}
        {!host && item.lane === 'voice' ? (
          <TimelineWaveform
            peaks={voicePeaks}
            mediaFromMs={(item.srcInMs ?? 0) - mediaOffsetMs}
            mediaToMs={(item.srcOutMs ?? 0) - mediaOffsetMs}
            widthPx={w}
            visLeftPx={wavWin ? wavWin[0] - left : undefined}
            visRightPx={wavWin ? wavWin[1] - left : undefined}
            className="absolute inset-0 size-full text-emerald-400/90"
          />
        ) : null}
        {!host && item.lane === 'music' ? (
          <TimelineWaveform
            peaks={musicPeaks}
            mediaFromMs={item.inMs ?? 0}
            mediaToMs={(item.inMs ?? 0) + (item.endMs - item.startMs)}
            widthPx={w}
            visLeftPx={wavWin ? wavWin[0] - left : undefined}
            visRightPx={wavWin ? wavWin[1] - left : undefined}
            className="absolute inset-0 size-full text-teal-200/80"
          />
        ) : null}
        {!host && item.lane === 'sfx' && sfxPeaks?.[item.id] ? (
          <TimelineWaveform
            peaks={sfxPeaks[item.id]!}
            mediaFromMs={edits.audio?.sfx.find((x) => x.generationId === item.id)?.inMs ?? 0}
            mediaToMs={(edits.audio?.sfx.find((x) => x.generationId === item.id)?.inMs ?? 0) + (item.endMs - item.startMs)}
            widthPx={w}
            visLeftPx={wavWin ? wavWin[0] - left : undefined}
            visRightPx={wavWin ? wavWin[1] - left : undefined}
            className="absolute inset-0 size-full text-orange-100/80"
          />
        ) : null}
        {beatsOn && beatMarks[refKey(item)]?.length
          ? beatMarks[refKey(item)]!.map((b) => (
              <span
                key={`bt${b}`}
                className="pointer-events-none absolute bottom-0 w-px bg-yellow-200/70"
                style={{ left: (b - geo.startMs) * pxPerMs, height: Math.max(4, (h - 4) / 3) }}
                data-testid="timeline-beat"
                data-ms={b}
              />
            ))
          : null}
        {(item.lane === 'music' && edits.audio?.music?.loop) || (item.lane === 'sfx' && edits.audio?.sfx.find((x) => x.generationId === item.id)?.loop) ? (
          <span className="pointer-events-none absolute right-1 top-0 z-[1] rounded bg-black/50 px-0.5 text-[9px]" data-testid="timeline-music-loop" title="Loops to fill its window">
            ↻
          </span>
        ) : null}
        {item.lane === 'music' || item.lane === 'sfx' ? renderFades(item, geo, w, h, st) : null}
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
        {envOn
          ? (() => {
              const env = envelopeFor(item.lane, item.id)
              if (!env) return null
              const { points, flat } = envelopePoints(edits, env.target, env.prop)
              const spec = PROP_SPECS[env.prop]
              const origin = targetOriginMs(edits, env.target)
              return (
                <EnvelopeLine
                  points={points}
                  flat={flat}
                  min={spec.min}
                  max={spec.max}
                  widthPx={w}
                  heightPx={h - 4}
                  pxPerMs={pxPerMs}
                  fromLocalMs={geo.startMs - origin}
                  kind={env.prop}
                  readOnly={!editable || st.locked}
                  onAdd={(t) => commit(addEnvelopePoint(edits, env.target, env.prop, t))}
                  onMove={(from, to, v) => commit(moveEnvelopePoint(edits, env.target, env.prop, from, to, v))}
                  onDelete={(t) => commit(deleteEnvelopePoint(edits, env.target, env.prop, t))}
                />
              )
            })()
          : null}
        {!host
          ? kfs.map((t) => {
              const inSel = selKf?.target === kfTarget && selKf.times.includes(t)
              const shownT = kfDrag && kfDrag.target === kfTarget && kfDrag.times.includes(t) ? Math.max(0, t + kfDrag.delta) : t
              const isSelKf = inSel
              return (
                <span
                  key={`kf${t}`}
                  className={`absolute top-1/2 z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 cursor-ew-resize border ${
                    isSelKf ? 'border-white bg-amber-300 ring-1 ring-amber-200' : 'border-black/60 bg-amber-400'
                  }`}
                  style={{
                    left: keyframeDiamondLeftPx(edits, kfOrigin, geo.startMs, geo.endMs, w, shownT),
                  }}
                  data-testid="timeline-keyframe"
                  data-target={kfTarget ?? undefined}
                  data-t-ms={Math.round(t)}
                  data-selected={isSelKf ? 'true' : undefined}
                  title={`Keyframe ${((kfOrigin + t) / 1000).toFixed(2)} s — drag to move, Shift-click to add to the selection, Del to delete`}
                  onPointerDown={(e) => startKfDrag(e, kfTarget!, t, kfOrigin, geo.startMs, geo.endMs, w)}
                />
              )
            })
          : null}
        {!host && item.lane === 'broll' && editable && !st.locked && w > 36
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
            onClick={freezeFrame}
            disabled={!editable || refLocked(edits, { lane: 'video', id: '' })}
            aria-label="Freeze frame at playhead"
            title="Freeze frame: hold the frame at the playhead for 3 s (lengthens the video; adjust under Media → Inserted clips)"
            data-testid="timeline-freeze"
          >
            <Pause className="size-3.5" />
            Freeze
          </button>
          <button
            type="button"
            className={tbtn}
            onClick={() => insertGap()}
            disabled={!editable || refLocked(edits, { lane: 'video', id: '' })}
            aria-label="Insert gap at playhead"
            title="Insert gap: 1 s of black + silence at the playhead (lengthens the video; set the length under Media → Inserted clips)"
            data-testid="timeline-gap"
          >
            <Square className="size-3.5" />
            Gap
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
          {editable ? (
            <div className="relative">
              <button
                type="button"
                className={tbtn}
                onClick={() => setTakesMenu((v) => !v)}
                aria-expanded={takesMenu}
                aria-haspopup="menu"
                title="Takes: group alternates into one slot, then T / Shift+T to switch"
                data-testid="timeline-takes-menu"
              >
                <Layers className="size-3.5" />
                Takes
              </button>
              {takesMenu ? (
                <div className="absolute left-0 top-7 z-50 min-w-[190px] rounded-md border border-border bg-popover p-1 text-xs shadow-lg" role="menu">
                  {renderTakesItems(() => { setTakesSub(false); setTakesMenu(false) }, 'toolbar')}
                </div>
              ) : null}
            </div>
          ) : null}
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
          {editable ? (
            <>
              <button
                type="button"
                className={`${tbtn} ${magnet ? 'text-primary' : 'text-muted-foreground'}`}
                onClick={() => toggleOpt('magnet')}
                aria-pressed={magnet}
                aria-label="Main track magnet"
                title={
                  magnet
                    ? 'Main track magnet ON: deleting a main clip closes the gap'
                    : 'Main track magnet OFF: deleting a main clip leaves a black gap, so later clips keep their time'
                }
                data-testid="timeline-magnet"
              >
                Main magnet
              </button>
              <button
                type="button"
                className={`${tbtn} ${rippleOverlaysOn(edits.timelineOpts) ? 'text-primary' : 'text-muted-foreground'}`}
                onClick={() => toggleOpt('rippleOverlays')}
                aria-pressed={rippleOverlaysOn(edits.timelineOpts)}
                aria-label="Link overlays to the main track"
                title={
                  rippleOverlaysOn(edits.timelineOpts)
                    ? 'Linked: B-roll, text, adjustment layers and sounds move with cuts to the main video'
                    : 'Unlinked: overlays stay at their time when the main video is cut (captions still follow the words)'
                }
                data-testid="timeline-link-overlays"
              >
                <Link2 className="size-3.5" />
                Link
              </button>
            </>
          ) : null}
          {hasBeats ? (
            <button
              type="button"
              className={`${tbtn} ${beatsOn ? 'text-primary' : 'text-muted-foreground'}`}
              onClick={() => setBeatsOn((v) => !v)}
              aria-pressed={beatsOn}
              aria-label="Beat markers"
              title="Beat markers on music (detected on this device). With Snap on, clips snap to the beats."
              data-testid="timeline-beats"
            >
              ♪ Beats
            </button>
          ) : null}
          {editable ? (
            <span className="inline-flex items-center" role="group" aria-label="Trim tool" data-testid="timeline-tools">
              {(
                [
                  ['select', 'Select', 'V', 'Select / trim (V)'],
                  ['roll', 'Roll', 'R', 'Roll edit (R): drag the cut between two touching clips — one gets longer, the other shorter'],
                  ['slide', 'Slide', 'U', 'Slide (U): move a clip between its neighbours — they give / take the time'],
                  ['slip', 'Slip', 'Y', 'Slip (Y): drag a B-roll clip to change which part of its media plays; it stays in place'],
                  ['blade', 'Blade', 'B', 'Blade (B): click a clip to split it there'],
                  ['hand', 'Hand', 'H', 'Hand (H): drag to scroll the timeline'],
                ] as const
              ).map(([id, label, , title]) => (
                <button
                  key={id}
                  type="button"
                  className={`${tbtn} ${tool === id ? 'text-primary' : 'text-muted-foreground'}`}
                  onClick={() => setTool(id)}
                  aria-pressed={tool === id}
                  title={title}
                  data-testid={`timeline-tool-${id}`}
                >
                  {label}
                </button>
              ))}
              <input
                type="text"
                inputMode="decimal"
                placeholder="±nudge"
                className="ml-1 h-6 w-16 rounded border border-border bg-background px-1 text-[11px] tabular-nums"
                title="Nudge the selection: +10 / -3 = frames, +1.5s / -0.25s = seconds, +1:02 = m:ss — Enter applies"
                aria-label="Nudge selection by timecode"
                data-testid="timeline-nudge"
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  e.stopPropagation()
                  const el = e.currentTarget
                  if (applyNudgeText(el.value)) el.value = ''
                }}
              />
              <button
                type="button"
                className={`${tbtn} ${autoXfade ? 'text-primary' : 'text-muted-foreground'}`}
                onClick={() => setAutoXfade((v) => !v)}
                aria-pressed={autoXfade}
                title="Auto-crossfade: dragging a clip over another on the same overlay / text / audio track fades across the overlap (envelope points)"
                data-testid="timeline-auto-xfade"
              >
                <Blend className="size-3.5" />
                Xfade
              </button>
              <button
                type="button"
                className={`${tbtn} ${xfadeTracks ? 'text-primary' : 'text-muted-foreground'}`}
                onClick={() => setXfadeTracks((v) => !v)}
                aria-pressed={xfadeTracks}
                disabled={!autoXfade}
                title="Cross-track crossfade: with Xfade on, an overlap with a clip of the same kind on ANOTHER track (B-roll, text, SFX) also fades across it — off keeps picture-in-picture overlaps as they are"
                data-testid="timeline-xfade-tracks"
              >
                ⇅ Tracks
              </button>
            </span>
          ) : null}
          {editable ? (
            <div className="relative" ref={addMenuRef}>
              <button
                type="button"
                className={tbtn}
                onClick={() => setAddMenu((v) => !v)}
                aria-expanded={addMenu}
                aria-label="Add track"
                title="Add a video overlay, text or audio track"
                data-testid="timeline-add-track"
              >
                <Plus className="size-3.5" />
                Track
              </button>
              {addMenu ? (
                <div className="absolute left-0 top-7 z-50 min-w-[150px] rounded-md border border-border bg-popover p-1 text-xs shadow-lg" role="menu">
                  {(
                    [
                      ['overlay', 'Video overlay track'],
                      ['text', 'Text track'],
                      ['audio', 'Audio track'],
                    ] as const
                  ).map(([kind, label]) => (
                    <button
                      key={kind}
                      type="button"
                      role="menuitem"
                      className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted disabled:opacity-40"
                      disabled={!canAddTrack(edits, kind)}
                      onClick={() => addTrackOf(kind)}
                      data-testid={`timeline-add-track-${kind}`}
                    >
                      {label}
                    </button>
                  ))}
                  {onArmVoiceover ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                      onClick={() => {
                        setAddMenu(false)
                        onArmVoiceover()
                      }}
                      data-testid="timeline-add-track-voiceover"
                    >
                      Voiceover
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            className={`${tbtn} w-auto px-1 text-[10px] ${pacingOpen ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={() => setPacingOpen((v) => !v)}
            aria-pressed={pacingOpen}
            title="Pacing check: long static shots, slivers, tiny gaps"
            data-testid="timeline-pacing"
          >
            Pacing
          </button>
          <button
            type="button"
            className={tbtn}
            onClick={() => setHelpOpen(true)}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            data-testid="timeline-shortcuts"
          >
            <Keyboard className="size-3.5" />
          </button>
          <button
            type="button"
            className={`${tbtn} ${envOn ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={() => setEnvOn((v) => !v)}
            aria-pressed={envOn}
            aria-label="Envelopes"
            title="Envelopes: opacity / volume lines on the items — click to add a point, drag it, double-click to delete"
            data-testid="timeline-envelopes"
          >
            <Activity className="size-3.5" />
            Envelopes
          </button>
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          <button
            type="button"
            className={tbtn}
            onClick={() => toggleMarker()}
            disabled={!editable}
            aria-label="Add or remove marker at playhead"
            title="Marker at playhead (M) · next / previous: Shift+M / Alt+M"
            data-testid="timeline-add-marker"
          >
            <Bookmark className="size-3.5" />
            Marker
          </button>
          <button
            type="button"
            className={`${tbtn} w-auto px-1 text-[10px] ${markerPanel ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={() => setMarkerPanel((v) => (v ? null : { focusId: null }))}
            aria-pressed={Boolean(markerPanel)}
            title="Marker list: labels, colors, chapters, Copy chapters"
            data-testid="timeline-markers-list"
          >
            {edits.markers?.length ?? 0}
          </button>
          <button
            type="button"
            className={`${tbtn} ${loopOn ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={() => toggleLoop()}
            aria-pressed={loopOn}
            aria-label="Loop in–out"
            title="Loop playback between in and out (Alt+L)"
            data-testid="timeline-loop"
          >
            <Repeat className="size-3.5" />
            Loop
          </button>
          {/* Segmented preview speed (the editor bans native select elements, §13 audit). */}
          <div
            className="inline-flex overflow-hidden rounded border border-border"
            role="radiogroup"
            aria-label="Preview speed"
            title="Preview speed (playback only — the export is unchanged)"
            data-testid="timeline-preview-rate"
            data-value={previewRate}
          >
            {PREVIEW_RATES.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={previewRate === r}
                onClick={() => setPreviewRate(r)}
                className={`h-6 px-1 text-[10px] tabular-nums ${previewRate === r ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                data-testid={`timeline-preview-rate-${r}`}
              >
                {r}×
              </button>
            ))}
          </div>
          <button
            type="button"
            className={tbtn}
            onClick={() => setPaletteOpen(true)}
            aria-label="Command palette"
            title="Command palette (Ctrl/Cmd+K)"
            data-testid="timeline-palette"
          >
            <Command className="size-3.5" />
          </button>
          {range ? (
            <span className="ml-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] tabular-nums text-primary" data-testid="timeline-inout-chip">
              In {(range[0] / 1000).toFixed(2)} – Out {(range[1] / 1000).toFixed(2)} s
            </span>
          ) : null}
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
          {openCompound ? (
            <span className="flex items-center gap-1 rounded bg-violet-600/20 px-2 text-[11px]" data-testid="timeline-compound-banner">
              Editing {edits.groups?.find((g) => g.id === openCompound)?.compound?.name}
              <button
                type="button"
                className={tbtn}
                onClick={() => {
                  setOpenCompound(null)
                  setSelected([])
                }}
              >
                Done (Esc)
              </button>
            </span>
          ) : null}
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
          localMs={keyframeLocalEditFromPlayhead(edits, playheadMs, inspected.origin)}
          onCommit={(next) => commit(next)}
          onSeekLocal={(t) => onSeekOutput(inspected.origin + t)}
          readOnly={!editable || refLocked(edits, inspected.item)}
          span={{
            fromMs: inspected.item.startMs - inspected.origin,
            toMs: inspected.item.endMs - inspected.origin,
          }}
        />
      ) : null}
      {pacingOpen ? (
        <PacingPanel edits={edits} tb={tb} onSeekOutput={onSeekOutput} onCommit={commit} onClose={() => setPacingOpen(false)} readOnly={!editable} />
      ) : null}
      {motionPanel ? (
        <TrackMotionPanel
          trackId={motionPanel.key}
          label={motionPanel.label}
          mainOnly={motionPanel.key === MAIN_MOTION_KEY}
          keys={trackMotionFor(edits, motionPanel.key)?.keys ?? []}
          playheadMs={playheadMs}
          readOnly={!editable}
          onChange={(keys) => {
            if (motionPanel.key === MAIN_MOTION_KEY) return
            commit({ ...edits, trackMotion: withTrackMotion(edits.trackMotion, motionPanel.key, keys) })
          }}
          onMainPreset={(p) => commit(applyMainPreset(edits, p))}
          onClose={() => setMotionPanel(null)}
        />
      ) : null}
      {fxPanel ? (
        <TrackFxPanel
          fxKey={fxPanel.key}
          label={fxPanel.label}
          fx={trackFxFor(edits, fxPanel.key)}
          readOnly={!editable}
          onChange={(body) => commit({ ...edits, trackFx: withTrackFx(edits.trackFx, fxPanel.key, body) })}
          onClose={() => setFxPanel(null)}
        />
      ) : null}
      {singleSel && (singleSel.lane === 'music' || singleSel.lane === 'sfx') && editable ? (
        <AudioClipInspector
          edits={edits}
          lane={singleSel.lane}
          id={singleSel.id}
          durationMs={tb.durationMs}
          kind={singleSel.lane === 'music' ? 'music' : audioClipKindOf(edits, singleSel.id) ?? 'sfx'}
          lenMs={singleSel.endMs - singleSel.startMs}
          mediaMs={singleSel.lane === 'music' ? musicPeaks.durationMs || null : sfxDurationsMs?.[singleSel.id] ?? null}
          bpm={singleSel.lane === 'music' ? musicPeaks.bpm ?? null : sfxBpm?.[singleSel.id] ?? null}
          readOnly={Boolean(itemState(singleSel).locked)}
          onCommit={(next) => commit(next)}
        />
      ) : null}
      {singleSel && singleSel.lane === 'video' && singleSel.srcInMs != null && singleSel.srcOutMs != null && editable ? (
        <div ref={speedSlotRef} data-testid="timeline-speed-slot">
          <ItemSpeedControl
            edits={edits}
            srcInMs={singleSel.srcInMs}
            srcOutMs={singleSel.srcOutMs}
            onCommit={(next) => commit(next)}
            readOnly={laneState(edits, 'video').locked}
          />
        </div>
      ) : null}
      {markerPanel ? (
        <div className="relative">
          <MarkerList
            markers={edits.markers}
            focusId={markerPanel.focusId}
            durationMs={span}
            editable={editable}
            onPatch={patchMarkerById}
            onSeek={onSeekOutput}
            onClose={() => setMarkerPanel(null)}
          />
        </div>
      ) : null}
      <CommandPalette open={paletteOpen} commands={paletteCommands} onClose={() => setPaletteOpen(false)} />
      {tlCollapsed ? null : (
      <div
        className="flex min-w-0 rounded-lg border border-border bg-card/30"
        // TC3 (d): a set height is the height — taller than all tracks leaves empty space below.
        style={tlHeight ? { height: tlHeight, overflowY: 'auto' } : undefined}
        data-testid="timeline-body"
      >
        <div className="w-[104px] shrink-0 border-r border-border/60" aria-label="Tracks">
          <div style={{ height: RULER_H }} className="border-b border-border/60" />
          {rows.map((r) => (
            <TimelineLaneHeader
              key={r.key}
              lane={r.lane}
              height={LANE_H[r.lane]}
              state={rowState(edits, r)}
              onToggle={editable ? (patch) => toggleRow(r, patch) : undefined}
              onOpenCover={onOpenCover}
              label={r.trackId ? r.label : undefined}
              testKey={r.isDefault ? r.lane : `${r.lane}-${r.trackId}`}
              track={trackActions(r)}
              dropTarget={Boolean(drag?.moved && drag.targetRow === r.key && rowOfItem(drag.item)?.key !== r.key)}
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
            {highlights && highlightLaneRanges.length ? (
              <HighlightsLane
                durationMs={highlights.durationMs}
                pxPerMs={pxPerMs}
                offsetPx={TRACK_OFFSET_PX}
                ranges={highlightLaneRanges.map((lr) => ({
                  pick: lr.pick,
                  startMs: lr.startMs,
                  endMs: lr.endMs,
                }))}
                selectedClipId={highlights.selectedClipId}
                onSelect={highlights.onSelect}
                onRangeChange={highlights.onRangeChange}
                onMakeClip={highlights.onMakeClip}
                onOpenCard={highlights.onOpenCard}
              />
            ) : null}
            <div
              ref={trackAreaRef}
              className="relative shrink-0"
              role="presentation"
              data-testid="timeline-track"
              data-duration-ms={Math.round(span)}
              data-tool={tool}
              style={{ width: widthPx, height: totalH, cursor: tool === 'hand' ? 'grab' : tool === 'blade' ? 'crosshair' : undefined }}
              onPointerDown={(e) => {
                if (e.button !== 0) return
                if (tool === 'hand') {
                  // TC2b (TL-18): Hand — drag scrolls the timeline (no seek, no selection).
                  const sc = scrollRef.current
                  if (!sc) return
                  e.preventDefault()
                  const x0 = e.clientX
                  const l0 = sc.scrollLeft
                  const mv = (ev: PointerEvent) => void (sc.scrollLeft = l0 - (ev.clientX - x0))
                  const up = () => {
                    window.removeEventListener('pointermove', mv)
                    window.removeEventListener('pointerup', up)
                  }
                  window.addEventListener('pointermove', mv)
                  window.addEventListener('pointerup', up)
                  return
                }
                if ((e.target as HTMLElement).closest('[data-testid^="timeline-item-"],[data-testid="timeline-word"],button')) return
                rootRef.current?.focus({ preventScroll: true })
                const additive = e.shiftKey || e.metaKey || e.ctrlKey
                if (!additive) {
                  setSelected([])
                  onSelRef.current?.(null)
                }
                const y = e.clientY - e.currentTarget.getBoundingClientRect().top
                if (y > RULER_H) {
                  onSeekOutput(msAtClientX(e.clientX, e.currentTarget))
                  startMarquee(e, additive)
                }
              }}
              onContextMenu={(e) => {
                if (!onSplitLayout && !editable) return
                e.preventDefault()
                setCtxMenu({ x: e.clientX, y: e.clientY })
              }}
            >
              <TimelineRuler
                durationMs={dspan}
                pxPerMs={pxPerMs}
                widthPx={widthPx}
                height={RULER_H}
                onScrub={(d) => onSeekOutput(msAtPx(d * pxPerMs))}
                visFromPx={virtualize ? visFromPx : undefined}
                visToPx={virtualize ? visToPx : undefined}
              />
              {tmap.wins.map((w) => (
                <div
                  key={`insshade${w.id}`}
                  className="pointer-events-none absolute bottom-0 z-[18] bg-[repeating-linear-gradient(135deg,rgba(0,0,0,0.55)_0_4px,rgba(0,0,0,0.25)_4px_8px)]"
                  style={{ left: w.startMs * pxPerMs, width: Math.max(2, w.durMs * pxPerMs), top: RULER_H }}
                  title="Inserted time: overlays pause here in the export"
                  data-testid="timeline-insert-shade"
                  aria-hidden
                />
              ))}
              <TimelineMarkers
                markers={edits.markers}
                pxPerMs={pxPerMs}
                xOf={xs}
                height={totalH}
                onSeek={onSeekOutput}
                onEdit={(id) => setMarkerPanel({ focusId: id })}
              />
              {marquee ? (
                <div
                  className="pointer-events-none absolute z-[30] border border-primary bg-primary/15"
                  style={{
                    left: Math.min(marquee.x0, marquee.x1),
                    top: Math.min(marquee.y0, marquee.y1),
                    width: Math.abs(marquee.x1 - marquee.x0),
                    height: Math.abs(marquee.y1 - marquee.y0),
                  }}
                  data-testid="timeline-marquee"
                />
              ) : null}
              {range ? (
                <div
                  className="pointer-events-none absolute inset-y-0 z-[5] border-x-2 border-primary/80 bg-primary/10"
                  style={{ left: xs(range[0]), width: Math.max(2, xe(range[1]) - xs(range[0])) }}
                  data-testid="timeline-inout-range"
                  data-in-ms={range[0]}
                  data-out-ms={range[1]}
                  aria-hidden
                />
              ) : null}
              {rows.map(({ lane, ...row }) => (
                <div
                  key={row.key}
                  className={`absolute inset-x-0 border-b border-border/30 ${lane === 'video' ? 'bg-muted/60' : drag?.moved && drag.targetRow === row.key ? 'bg-primary/15' : 'bg-muted/20'}`}
                  style={{ top: rowTop(row.key), height: LANE_H[lane] }}
                  data-testid={row.isDefault ? `timeline-lane-${lane}` : `timeline-lane-${lane}-${row.trackId}`}
                  data-track-id={row.trackId}
                  aria-label={row.trackId ? `${row.label} track` : `${lane} lane`}
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
                          onDropMedia(lane as MediaDropLane, msAtClientX(e.clientX, e.currentTarget), id, row.trackId ?? undefined)
                        }
                      : undefined
                  }
                >
                  {lane === 'video'
                    ? cutWindows.map((w) => (
                        <div
                          key={`tr${w.srcMs}`}
                          className="pointer-events-none absolute inset-y-0 z-[1] bg-gradient-to-r from-white/0 via-white/35 to-white/0"
                          style={{ left: xs(w.w0Ms), width: Math.max(2, xe(w.w1Ms) - xs(w.w0Ms)) }}
                          data-testid="timeline-transition-region"
                          data-src-ms={w.srcMs}
                          data-type={w.type}
                          aria-hidden
                        />
                      ))
                    : null}
                  {lane === 'broll'
                    ? brollWindows.filter((w) => rowItems(lanes, { lane, ...row }).some((i) => i.id === w.itemId)).map((w) => (
                        <div
                          key={`btr${w.itemId}${w.kind}`}
                          className="pointer-events-none absolute inset-y-0 z-[1] bg-white/30"
                          style={{ left: xs(w.w0Ms), width: Math.max(2, xe(w.w1Ms) - xs(w.w0Ms)) }}
                          data-testid="timeline-broll-transition-region"
                          data-kind={w.kind}
                          data-type={w.type}
                          aria-hidden
                        />
                      ))
                    : null}
                  {(virtualize
                    ? (() => {
                        const base = rowItems(lanes, { lane, ...row })
                          .filter((i) => !cview.hidden.has(refKey(i)))
                          .map((i) => {
                            const h = hostOf(i)
                            return h
                              ? { ...i, startMs: h.startMs, endMs: h.endMs, label: `⧉ ${h.group.compound.name} · ${h.count} clips` }
                              : i
                          })
                        return base.filter((i) => inView(shown(i).startMs, shown(i).endMs))
                      })()
                    : (() => {
                        const base = rowItems(lanes, { lane, ...row })
                          .filter((i) => !cview.hidden.has(refKey(i)))
                          .map((i) => {
                            const h = hostOf(i)
                            return h
                              ? { ...i, startMs: h.startMs, endMs: h.endMs, label: `⧉ ${h.group.compound.name} · ${h.count} clips` }
                              : i
                          })
                        return base
                      })()
                  ).map(renderItem)}
                  {lane === 'video' && drag?.reorder && drag.moved && drag.insertBefore !== undefined ? (
                    <div
                      className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-primary"
                      style={{ left: (() => { const st = drag.insertBefore == null ? undefined : lanes.video.find((v) => v.id === drag.insertBefore)?.startMs; return st == null ? xe(span) - 1 : xs(st) - 1 })() }}
                      data-testid="timeline-reorder-marker"
                      aria-hidden
                    />
                  ) : null}
                  {lane === 'video'
                    ? sourceChips.map((c) => {
                        const seg = edits.sourceSegments?.find((x) => x.id === c.id)
                        const src = sourceById(edits.sources, c.sourceId)
                        if (!seg || !src || !inView(c.startMs, c.endMs)) return null
                        const left = xs(c.startMs)
                        return (
                          <SourceSegmentFilmstrip
                            key={`srcfs${c.id}:${c.startMs}`}
                            url={sourceUrls?.[src.refId] ?? null}
                            mediaType={src.mediaType}
                            fromMs={segmentMediaMs(seg, src, c.srcStartMs)}
                            toMs={segmentMediaMs(seg, src, c.srcEndMs)}
                            leftPx={left}
                            topPx={2}
                            widthPx={Math.max(2, xe(c.endMs) - left)}
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
                          style={{ left: xs(c.startMs), width: Math.max(4, xe(c.endMs) - xs(c.startMs)) }}
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
                  {lane === 'video' ? <TimelineInsertMarkers tmap={tmap} sources={edits.sources} pxPerMs={pxPerMs} /> : null}
                  {lane === 'video' && editable && !laneState(edits, 'video').locked
                    ? (() => {
                        const cutKs = realCutIndices(tb)
                        // E3fix: min hit area + two rows when cuts are closer than the min gap.
                        const slots = layoutCutHandles(cutKs.map((k) => xs(tb.starts[k]!)))
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
                          const left = xs(wi.outStartMs)
                          const w = Math.max(1, xe(wi.outEndMs) - left)
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
                            style={{ left: xs(p.startMs), width: Math.max(1, xe(p.endMs) - xs(p.startMs)) }}
                            title={p.mode}
                          />
                        ))}
                      </div>
                      {showAiCutTicks
                        ? aiInOut.map((ms, i) =>
                            ms == null ? null : (
                              <div
                                key={i}
                                data-testid="ai-cut-tick"
                                className="pointer-events-none absolute inset-y-0 border-l border-dashed border-primary/60"
                                style={{ left: xs(ms) }}
                                title={i === 0 ? 'Original AI clip start' : 'Original AI clip end'}
                                aria-hidden
                              />
                            ),
                          )
                        : null}
                    </>
                  ) : null}
                </div>
              ))}
              {drag?.moved && drag.snappedTo != null ? (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 w-px bg-yellow-300"
                  style={{ left: xs(drag.snappedTo) }}
                  data-testid="timeline-snap-guide"
                  aria-hidden
                />
              ) : null}
              {drag?.moved ? (
                <div
                  className="pointer-events-none absolute -top-0.5 rounded bg-popover px-1 text-[10px] tabular-nums shadow"
                  style={{ left: Math.max(0, xs(shown(drag.item).startMs)) }}
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
      )}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize timeline (drag; double-click = fit all tracks)"
        title="Drag to resize the timeline · double-click: show all tracks"
        className="group flex h-3 cursor-row-resize items-center justify-center gap-2"
        data-testid="timeline-resize"
        onPointerDown={(e) => {
          if (e.button !== 0 || tlCollapsed) return
          e.preventDefault()
          const body = (e.currentTarget.previousElementSibling as HTMLElement | null)
          const y0 = e.clientY
          const h0 = tlHeight ?? body?.getBoundingClientRect().height ?? 240
          const mv = (ev: PointerEvent) => setTimelineHeight(h0 + (ev.clientY - y0))
          const up = () => {
            window.removeEventListener('pointermove', mv)
            window.removeEventListener('pointerup', up)
          }
          window.addEventListener('pointermove', mv)
          window.addEventListener('pointerup', up)
        }}
        onDoubleClick={() => setTimelineHeight(null)}
      >
        <span className="h-1 w-10 rounded bg-border group-hover:bg-primary/60" />
        <button
          type="button"
          className="rounded px-1 text-[10px] text-muted-foreground hover:text-foreground"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setTlCollapsed((c) => !c)}
          aria-pressed={tlCollapsed}
          data-testid="timeline-collapse"
        >
          {tlCollapsed ? 'Show timeline' : 'Collapse'}
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Click to select (Shift-click for more), drag to move (up / down: another track; main clips reorder), drag edges
        to trim. S / Ctrl+B split · Del delete · Ctrl+C/X/V/D · I/O in–out · ←/→ nudge (Shift ×10) · ↑/↓ edit points ·
        N snapping · Space / J K L play. ◇ adds keyframes; click a cut to add a transition. ? for all shortcuts.
      </p>
      <TimelineShortcutsSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
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
          brollEdge={trPop.kind !== 'cut'}
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
              {editable && onReplaceBrollMedia && liveSelected.length === 1 && liveSelected[0]!.lane === 'broll' ? (
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                  role="menuitem"
                  data-testid="timeline-replace-media"
                  onClick={() => {
                    onReplaceBrollMedia(liveSelected[0]!.id)
                    setCtxMenu(null)
                  }}
                >
                  Replace media…
                </button>
              ) : null}
              {liveSelected.length === 1 && liveSelected[0]!.lane === 'broll' && canDetachAudio(edits, liveSelected[0]!.id) ? (
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                  role="menuitem"
                  data-testid="timeline-detach-audio"
                  onClick={() => {
                    // G1b3: the clip's sound becomes an audio-track item (same time / in-point / length).
                    const r = detachBrollAudio(edits, liveSelected[0]!.id)
                    if (r) {
                      commit(r.edits)
                      setSelected([{ lane: 'sfx', id: r.id }])
                    }
                    setCtxMenu(null)
                  }}
                >
                  Detach audio
                </button>
              ) : null}
              {liveSelected.length === 1 && canSplitStereo(edits, liveSelected[0]!.lane, liveSelected[0]!.id) ? (
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                  role="menuitem"
                  data-testid="timeline-split-stereo"
                  onClick={() => {
                    // G1c: left / right channel each onto its own new audio track (own FX, mute, envelope).
                    const r = splitStereoToTracks(edits, liveSelected[0]!.lane, liveSelected[0]!.id)
                    if (r) {
                      commit(r.edits)
                      setSelected(r.ids.map((id) => ({ lane: 'sfx' as const, id })))
                    }
                    setCtxMenu(null)
                  }}
                >
                  Split stereo to L/R tracks
                </button>
              ) : null}
              {/* FV4b: always listed (disabled + hint under 2 clips); Takes ▸ next / previous / ungroup. */}
              {liveSelected.length ? renderTakesItems(() => { setTakesSub(false); setCtxMenu(null) }, 'ctx') : null}
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
              {copyableRefs(liveSelected).length ? (
                <>
                  {(
                    [
                      ['Copy (Ctrl+C)', () => copySel(false), 'copy'],
                      ['Cut (Ctrl+X)', () => copySel(true), 'cut'],
                      ['Duplicate (Ctrl+D)', () => duplicate(), 'duplicate'],
                    ] as const
                  ).map(([label, fn, id]) => (
                    <button
                      key={id}
                      type="button"
                      className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                      role="menuitem"
                      data-testid={`timeline-ctx-${id}`}
                      onClick={() => {
                        fn()
                        setCtxMenu(null)
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </>
              ) : null}
              {timelineClipboard.get() ? (
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                  role="menuitem"
                  data-testid="timeline-ctx-paste"
                  onClick={() => {
                    paste()
                    setCtxMenu(null)
                  }}
                >
                  Paste at playhead (Ctrl+V)
                </button>
              ) : null}
              {timelineClipboard.get() && liveSelected.some((r) => r.lane === 'text' || r.lane === 'broll') ? (
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                  role="menuitem"
                  data-testid="timeline-ctx-paste-attributes"
                  onClick={() => {
                    pasteAttrs()
                    setCtxMenu(null)
                  }}
                >
                  Paste attributes (Ctrl+Shift+V)
                </button>
              ) : null}
              {angles.length > 1 && editable && (range || liveSelected.some((r) => r.lane === 'video')) ? (
                <>
                  <p className="px-2 pt-1 text-[10px] font-medium text-muted-foreground">
                    Camera angle {range ? '(in–out range)' : '(selected clips)'}
                  </p>
                  {angles.map((a) => (
                    <button
                      key={a.sourceId}
                      type="button"
                      className="block w-full rounded px-2 py-1.5 pl-4 text-left hover:bg-muted"
                      role="menuitem"
                      data-testid={`timeline-ctx-angle-${a.sourceId}`}
                      onClick={() => {
                        let next = edits
                        const spans: [number, number][] = range
                          ? [range]
                          : liveSelected
                              .filter((r) => r.lane === 'video')
                              .map((r) => lanes.video.find((i) => i.id === r.id))
                              .filter(Boolean)
                              .map((i) => [i!.startMs, i!.endMs] as [number, number])
                        for (const [a0, b0] of spans) next = setAngleForOutputRange(next, tb, a0, b0, a.sourceId, angleSources)
                        commit(next)
                        setCtxMenu(null)
                      }}
                    >
                      {a.key}. {a.label}
                    </button>
                  ))}
                </>
              ) : null}
              {(() => {
                const kinds = [...new Set(liveSelected.map((r) => LANE_TRACK_KIND[r.lane]).filter(Boolean))] as TrackKind[]
                if (kinds.length !== 1) return null
                const here = new Set(liveSelected.map((r) => lanes[r.lane].find((i) => i.id === r.id)?.track))
                const dests = tracksOfKind(edits, kinds[0]!).filter((t) => !(here.size === 1 && here.has(t.id)) && !trackState(edits, t.id).locked)
                if (!dests.length) return null
                return (
                  <>
                    <p className="px-2 pt-1 text-[10px] font-medium text-muted-foreground">Move to track</p>
                    {dests.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="block w-full rounded px-2 py-1.5 pl-4 text-left hover:bg-muted"
                        role="menuitem"
                        data-testid={`timeline-ctx-move-to-${t.id}`}
                        onClick={() => {
                          commit(moveItemsToTrack(edits, liveSelected, t.id))
                          setCtxMenu(null)
                        }}
                      >
                        {trackLabel(edits, t.id)}
                      </button>
                    ))}
                  </>
                )
              })()}
              {range ? (
                <>
                  <p className="px-2 pt-1 text-[10px] font-medium text-muted-foreground">In–out range</p>
                  <button
                    type="button"
                    className="block w-full rounded px-2 py-1.5 pl-4 text-left hover:bg-muted"
                    role="menuitem"
                    data-testid="timeline-ctx-range-delete"
                    onClick={() => {
                      rippleDeleteRange()
                      setCtxMenu(null)
                    }}
                  >
                    Delete range, close gap (Shift+Del)
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded px-2 py-1.5 pl-4 text-left hover:bg-muted"
                    role="menuitem"
                    data-testid="timeline-ctx-range-select"
                    onClick={() => {
                      setSelected(itemsInRange(lanes, range).filter((r) => r.lane !== 'video' && !refLocked(edits, r)))
                      setCtxMenu(null)
                    }}
                  >
                    Select items in range
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded px-2 py-1.5 pl-4 text-left hover:bg-muted"
                    role="menuitem"
                    onClick={() => {
                      setIo({ inMs: null, outMs: null })
                      setCtxMenu(null)
                    }}
                  >
                    Clear in / out (Alt+X)
                  </button>
                </>
              ) : null}
              {liveSelected.some(canToggleEnabled) ? (
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                  role="menuitem"
                  data-testid="timeline-ctx-toggle-enabled"
                  onClick={() => {
                    toggleEnabled()
                    setCtxMenu(null)
                  }}
                >
                  {liveSelected.filter(canToggleEnabled).every((r) => isDisabled(edits, r)) ? 'Activate' : 'Deactivate'} (Shift+E)
                </button>
              ) : null}
              {liveSelected.length > 1 && !selCompound ? (
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                  role="menuitem"
                  data-testid="timeline-ctx-compound"
                  onClick={() => {
                    compoundSel()
                    setCtxMenu(null)
                  }}
                >
                  Create compound clip (Alt+G)
                </button>
              ) : null}
              {selCompound && selCompound.id !== openCompound ? (
                <>
                  <button
                    type="button"
                    className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                    role="menuitem"
                    data-testid="timeline-ctx-open-compound"
                    onClick={() => {
                      setOpenCompound(selCompound.id)
                      setSelected([])
                      setCtxMenu(null)
                      rootRef.current?.focus({ preventScroll: true })
                    }}
                  >
                    Open compound
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                    role="menuitem"
                    data-testid="timeline-ctx-uncompound"
                    onClick={() => {
                      uncompoundSel()
                      setCtxMenu(null)
                    }}
                  >
                    Uncompound (Alt+Shift+G)
                  </button>
                </>
              ) : null}
              {liveSelected.length > 1 ? (
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                  role="menuitem"
                  data-testid="timeline-ctx-group"
                  onClick={() => {
                    groupSel()
                    setCtxMenu(null)
                  }}
                >
                  Group (Ctrl+G)
                </button>
              ) : null}
              {liveSelected.some((r) => groupOf(edits, r)) ? (
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                  role="menuitem"
                  data-testid="timeline-ctx-ungroup"
                  onClick={() => {
                    ungroupSel()
                    setCtxMenu(null)
                  }}
                >
                  Ungroup (Ctrl+Shift+G)
                </button>
              ) : null}
              {liveSelected.some((r) => r.lane === 'video') && lanes.video.length > 1 ? (
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                  role="menuitem"
                  data-testid="timeline-ctx-replace-gap"
                  onClick={() => {
                    replaceSelWithGap()
                    setCtxMenu(null)
                  }}
                >
                  Replace with gap
                </button>
              ) : null}
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                role="menuitem"
                data-testid="timeline-ctx-insert-gap"
                onClick={() => {
                  insertGap()
                  setCtxMenu(null)
                }}
              >
                Insert gap at playhead
              </button>
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                role="menuitem"
                data-testid="timeline-ctx-marker"
                onClick={() => {
                  toggleMarker()
                  setCtxMenu(null)
                }}
              >
                Add / remove marker (M)
              </button>
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
