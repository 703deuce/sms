'use client'

import { Anton, Montserrat, Poppins } from 'next/font/google'
import { addFontVarsToBody, clipDisplayFontVars } from '@/components/clips/editor/clip-editor-fonts'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { getPreviewRate, subscribePreviewRate } from '@/lib/clips/editor/preview-rate'
import { EditorRail, EDITOR_RAIL_ITEMS, editorRailIcon, type EditorPanelId } from '@/components/clips/editor/editor-rail'
import { EditorMobileRail } from '@/components/clips/editor/editor-mobile-rail'
import { TAB_META } from '@/components/clips/editor/editor-tab-meta'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, PanelRightOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClipBounds } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import type { CropShot, EditorMedia } from '@/lib/server/clips/clip-detail'
import type { CropTrack } from '@/lib/clips/crop-track'
import { requestClipReframe } from '@/lib/clips-api'
import { patchClip } from '@/lib/clips-api'
import { editorPreviewDurationMs, editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import { seedEditorExportTemplate } from '@/lib/clips/editor-export-template-seed'
import { hostOnlyFromUrl, logEditorDecision } from '@/lib/clips/editor-decision-log'
import { exportTimeMap, toExportMs } from '@/lib/clips/editor/export-time'
import { timebaseFor } from '@/lib/clips/editor/clip-timeline'
import { playWithSound } from '@/lib/clips/video-playback'
import { EditorTopBar } from '@/components/clips/editor/editor-top-bar'
import { EditorHistoryPanel } from '@/components/clips/editor/history-panel'
import { CaptionsPanel } from '@/components/clips/editor/captions-panel'
import { CaptionLinesPanel } from '@/components/clips/editor/caption-lines-panel'
import { ExportDialog } from '@/components/clips/editor/export-dialog'
import { RepurposePanel } from '@/components/clips/editor/repurpose-panel'
import { OpenInFullVideoButton } from '@/components/clips/editor/open-in-full-video-button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FindClipsInVideoButton } from '@/components/clips/editor/find-clips-in-video-button'
import { ClipperSurfaceErrorBoundary } from '@/components/clips/clipper-surface-error-boundary'
import { LayoutPanel } from '@/components/clips/editor/layout-panel'
import { clipLayoutChip, clipTypeBadge, clipWhySummary, type ClipAiMeta } from '@/lib/clips/clip-results-chips'
import { PlayerControls } from '@/components/clips/editor/player-controls'
import { Timeline } from '@/components/clips/editor/timeline'
import { TextPanel } from '@/components/clips/editor/text-panel'
import { TemplatesPanel } from '@/components/clips/editor/templates-panel'
import { ColorPanel, type ColorTarget } from '@/components/clips/editor/color-panel'
import { ProducerPopover } from '@/components/clips/editor/producer-popover'
import { TemplateLayoutPanel } from '@/components/clips/editor/template-layout-panel'
import { t6TemplatesEnabled } from '@/lib/clips/t6-feature-flags'
import { speedAtSource } from '@/lib/clips/editor/speed'
import type { TimelineItem } from '@/lib/clips/editor/clip-timeline'
import type { KeyframeTarget } from '@/lib/clips/editor/keyframes'
import type { LaneId } from '@/lib/clips/editor/timeline-lane-state'
import { PropertiesPanel } from '@/components/clips/editor/properties-panel'
import { ItemSpeedControl } from '@/components/clips/editor/timeline/item-speed-control'
import { MainVideoTools, MediaSceneSplit } from '@/components/clips/editor/g4/video-tools'
import { watchEditorMediaCors } from '@/components/clips/editor/g4/media-cors'
import { PreviewStage, seekToOutputMs } from '@/components/clips/editor/preview-stage'
import { sourceMsAtOutput, videoTimeFromSourceMs } from '@/lib/clips/editor-playback'
import { AudioPanel } from '@/components/clips/editor/audio-panel'
import { BrollPanel } from '@/components/clips/editor/broll-panel'
import { BrandPanel } from '@/components/clips/editor/brand-panel'
import { ThumbnailPanel } from '@/components/clips/editor/thumbnail-panel'
import { DubPanel } from '@/components/clips/editor/dub-panel'
import { HookOverlayPanel } from '@/components/clips/editor/hook-overlay-panel'
import { useDubPreview } from '@/components/clips/editor/use-dub-preview'
import { useAudioMix } from '@/components/clips/editor/use-audio-mix'
import { useGeneration } from '@/components/clips/editor/use-generation'
import { AudioMeter, usePeakLevels } from '@/components/clips/editor/audio-meter'
import { useSfxCues } from '@/components/clips/editor/use-sfx-cues'
import type { EditorAssets } from '@/lib/clips/editor/editor-assets'
import { applyTimelineLaneState, arrowStepMs, brollMediaForItems, voiceMuted } from '@/lib/clips/editor/clip-timeline'
import { useStudioSoundPreview } from '@/components/clips/editor/use-studio-sound-preview'
import { TranscriptPanel, type TranscriptSelection } from '@/components/clips/editor/transcript-panel'
import { ClipFillerReview } from '@/components/clips/editor/clip-filler-review'
import { ClipGapReview } from '@/components/clips/editor/clip-gap-review'
import type { ClipGapToolSettings } from '@/components/clips/editor/clip-shorten-gaps-panel'
import { StudioSoundPreview } from '@/components/script-editor/studio-sound-preview'
import { DEFAULT_STUDIO_SOUND_MIX, normalizeAudioEdits } from '@/lib/clips/audio'
import type { BrollMediaRow } from '@/lib/server/clips/broll-media'
import { CleanupPanel } from '@/components/clips/editor/cleanup-panel'
import type { CleanupProposal } from '@/lib/clips/editor/cleanup-proposals'
import { deriveClipFromEditor } from '@/lib/clips-api'
import { LayersPanel } from '@/components/clips/editor/layers-panel'
import type { FacecamLayoutState } from '@/lib/server/clips/clip-detail'
import { applyBrandTemplateToEdits, describeTemplateChange, templateAppliedMessage } from '@/lib/clips/apply-brand'
import { applyAutoTemplateToEdits, applyTemplateV3ToEdits, templateFromEdits } from '@/lib/clips/layers-template'
import { clipStyleSettingsFromEdits, type BrandTemplateSettings } from '@/lib/clips/brand'
import { saveClipBrandTemplate } from '@/lib/clips-api'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { clipsFetch } from '@/lib/clips-api'
import { isFormControlTarget } from '@/lib/clips/editor/timeline-zoom'
import { useSetBreadcrumbTitle } from '@/components/shell/breadcrumb-context'
import { useSafeZoneVisible } from '@/lib/clips/use-safe-zone-visible'
import { EditorVersionsMenu, EditorLayoutMenu, type EditVersionRow } from '@/components/clips/editor/editor-versions-menu'
import {
  normalizeEdits,
  normalizeEditSpeed,
  outputDurationMs,
  displayDurationMs,
  displayPositionMs,
  editMsAtDisplayMs,
  keepSegments,
} from '@/lib/clips/edits'
import { LayoutQuickPicker } from '@/components/clips/editor/layout-quick-picker'
import type { StickerLayer } from '@/lib/clips/layers'
import type { VocabEntry } from '@/lib/clips/clip-export-user-types'
import {
  shouldApplyVocabulary,
  vocabularyBatchFixes,
  vocabularyFingerprint,
} from '@/lib/clips/editor/vocab-apply'
import { toast } from 'sonner'
import { EditorPanelErrorBoundary } from '@/components/clips/editor/editor-panel-error-boundary'
import { useFullVideoHighlights } from '@/components/clips/editor/use-full-video-highlights'
import { MediaLibraryGrid, MediaPanel } from '@/components/clips/editor/media-panel'
import type { ProjectMediaApi } from '@/components/clips/editor/use-project-media'
import type { MonitorRequest } from '@/components/clips/editor/source-monitor'
import { buildFromTranscriptItem, matchFrameAt } from '@/lib/clips/editor/source-monitor'
import { mediaUrlFor, useMediaTranscripts, useProjectMedia } from '@/components/clips/editor/use-project-media'
import { CanvasBackgroundChip, CanvasBackgroundSection } from '@/components/clips/editor/canvas-background'
import { PreviewChipRow, previewChipButtonClass } from '@/components/clips/editor/preview-chip-row'
import { canvasBgRelevant } from '@/lib/clips/canvas-bg'
import { aspectCss } from '@/lib/clips/export-aspect'
import {
  nextZoom,
  readPreviewQuality,
  writePreviewQuality,
  type PreviewQuality,
  type PreviewZoom,
} from '@/lib/clips/editor/preview-view'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { sourceFromItem } from '@/lib/clips/editor/media-add'
import { mergeMediaWords } from '@/lib/clips/editor/media-words'
import { useEditorWords } from '@/components/clips/editor/use-editor-words'
import { SHOW_SURROUNDING_CONTEXT_MS } from '@/lib/clips/trim-bounds'
import { addMediaToLane, placeAddedOnTrack, replaceBrollMedia, replaceVideoRange, type MediaDropLane, type ProjectMediaItem } from '@/lib/clips/editor/media-add'
import { ClipRecordMenu } from '@/components/clips/editor/recording/record-menu'
import { ClipRecorderBar } from '@/components/clips/editor/recording/recorder-bar'
import { useClipRecorder } from '@/components/clips/editor/recording/use-clip-recorder'
import { useClipRecordingPlacement } from '@/components/clips/editor/recording/use-clip-recording-placement'
import { useEditorState } from '@/components/clips/editor/use-editor-state'
import { nextShuttleRate, shuttleKey } from '@/lib/clips/editor/timeline-shortcuts'
import { clipEditorAiExtrasEnabled } from '@/lib/clips/clip-editor-feature-flags'
import {
  vodChatOverlayEnabled,
  vodChatToggleHint,
  type VodChatMeta,
} from '@/lib/streamer/vod-chat-status'

const clipEditorAnton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-clip-anton' })
const clipEditorMontserrat = Montserrat({ subsets: ['latin'], weight: ['900'], variable: '--font-clip-montserrat' })
const clipEditorPoppins = Poppins({ subsets: ['latin'], weight: ['800'], variable: '--font-poppins' })

/** TC3 (c): a slider thumb / range input (not a text field). */
function isSliderTarget(t: EventTarget | null): boolean {
  return t instanceof Element && Boolean(t.closest('[role="slider"], input[type="range"]'))
}

function isEditableTarget(t: EventTarget | null) {
  // G4c: sliders (role="slider" thumbs), selects and every input keep their keys.
  return isFormControlTarget(t)
}


/**
 * T6.3: a timeline seek must keep the prior play state (E2E round 9: playing, seek to ~5 s ->
 * paused). Capture `paused` before the seek; if the element was playing and is paused once
 * the seek settles (the template stage / follower videos re-buffer), resume it.
 */
function keepPlayStateAcrossSeek(v: HTMLVideoElement): () => void {
  const wasPlaying = !v.paused && !v.ended
  return () => {
    if (!wasPlaying) return
    const resume = () => {
      if (v.paused) void v.play().catch(() => {})
    }
    v.addEventListener('seeked', resume, { once: true })
  }
}

export function EditorShell({
  projectId,
  projectTitle,
  clipId,
  initialTitle,
  serverUpdatedAt,
  editsSaveVersion,
  bounds,
  initialEdits,
  words,
  cropShots,
  cropTrack,
  videoUrl,
  editorMedia = null,
  posterUrl = null,
  aiMeta,
  brollMedia: initialBrollMedia = [],
  reframeV2Enabled = false,
  vodChat = null,
  projectStatus = null,
  facecamLayout = null,
  streamChannelId = null,
  fullVideo = false,
  editorAssets = null,
}: {
  projectId: string
  projectTitle?: string
  clipId: string
  initialTitle: string
  serverUpdatedAt?: string
  editsSaveVersion?: number
  bounds: ClipBounds
  initialEdits: ClipEditsV2
  words: SourceWord[]
  cropShots: CropShot[]
  cropTrack: CropTrack | null
  videoUrl: string | null
  editorMedia?: EditorMedia | null
  posterUrl?: string | null
  aiMeta?: { brollIdeas?: string[] } | null
  brollMedia?: BrollMediaRow[]
  reframeV2Enabled?: boolean
  vodChat?: {
    chatSource?: string | null
    chatMessages?: number | null
    sourceType?: string | null
    chatError?: string | null
    chatMeta?: VodChatMeta | null
  } | null
  projectStatus?: string | null
  facecamLayout?: FacecamLayoutState | null
  streamChannelId?: string | null
  /** FV1: full-video project (whole source in one clip) — shows "Find clips in this video". */
  fullVideo?: boolean
  /** FV2: signed full-video editor assets (peaks + filmstrip sprite); null for clips. */
  editorAssets?: EditorAssets | null
}) {
  const [title, setTitle] = useState(initialTitle)
  const [brollMedia, setBrollMedia] = useState<BrollMediaRow[]>(initialBrollMedia)
  const mergeBrollMedia = useCallback((rows: BrollMediaRow[]) => {
    setBrollMedia((prev) => {
      const map = new Map(prev.map((r) => [r.id, r]))
      for (const row of rows) map.set(row.id, row)
      return [...map.values()]
    })
  }, [])
  useSetBreadcrumbTitle('project', projectTitle)
  useSetBreadcrumbTitle('clip', title)
  const [exportOpen, setExportOpen] = useState(false)
  const [beatCutApi, setBeatCutApi] = useState<{
    cut: (every: 1 | 2 | 4) => void
    hasBeats: boolean
  } | null>(null)
  const registerBeatCut = useCallback(
    (api: { cut: (every: 1 | 2 | 4) => void; hasBeats: boolean } | null) => {
      setBeatCutApi(api)
    },
    [],
  )
  const [exportTimelineInOut, setExportTimelineInOut] = useState<import('@/lib/clips/editor/timeline-edit-ops').InOut>({
    inMs: null,
    outMs: null,
  })
  const [replaceBrollId, setReplaceBrollId] = useState<string | null>(null)
  const [fillerReviewOpen, setFillerReviewOpen] = useState(false)
  const [gapReviewOpen, setGapReviewOpen] = useState(false)
  const [auditionEdits, setAuditionEdits] = useState<ClipEditsV2 | null>(null)
  // E4: Text / Color panels follow the timeline selection; ✨ Producer pop-over.
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
  const [selectedCaptionLineId, setSelectedCaptionLineId] = useState<string | null>(null)
  const [colorTarget, setColorTarget] = useState<ColorTarget>({ kind: 'video' })
  // G1a: one selection shared by the canvas, the timeline and the Properties inspector.
  const [canvasSel, setCanvasSel] = useState<{ target: KeyframeTarget; label: string } | null>(null)
  const [cropMode, setCropMode] = useState(false)
  const [timelineSelReq, setTimelineSelReq] = useState<{ lane: LaneId; id?: string; atMs?: number; seq: number } | null>(null)
  const [selVideoSeg, setSelVideoSeg] = useState<{ srcInMs: number; srcOutMs: number } | null>(null)
  // E4fix: font pickers / dialogs are portaled to <body>; give them the clip font variables too.
  useEffect(
    () =>
      addFontVarsToBody(
        cn(clipEditorAnton.variable, clipEditorMontserrat.variable, clipEditorPoppins.variable, clipDisplayFontVars),
      ),
    [],
  )
  const [producerOpen, setProducerOpen] = useState(false)
  const [producerPendingPaid, setProducerPendingPaid] = useState(0)
  const [pendingDerivedClipId, setPendingDerivedClipId] = useState<string | null>(null)
  const [gapToolSettings, setGapToolSettings] = useState<ClipGapToolSettings>({
    mode: 'more_than',
    minGapSec: 0.6,
    maxGapSec: 3,
    targetGapSec: 0.35,
  })
  const [safeZoneVisible, setSafeZoneVisible] = useSafeZoneVisible()
  const [panel, setPanel] = useState<EditorPanelId>('transcript')
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const selectPanel = useCallback((id: EditorPanelId) => {
    setPanel(id)
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      setMobilePanelOpen(true)
    }
  }, [])
  const openLayersTab = useCallback(() => selectPanel('layers'), [selectPanel])

  // G4cfix2: every B2 medium on the editor route in CORS mode (+ recovery of pre-hydration failures).
  useEffect(() => watchEditorMediaCors(typeof document === 'undefined' ? null : document.body), [])
  useEffect(() => {
    if (!EDITOR_RAIL_ITEMS.some((item) => item.id === panel)) {
      setPanel('transcript')
    }
  }, [panel])
  /** Re-hooked panels (B-roll, Brand, Cover, Dub) mount on first open so they don't fetch on editor load. */
  const [visitedPanels, setVisitedPanels] = useState<ReadonlySet<EditorPanelId>>(() => new Set(['transcript']))
  useEffect(() => {
    setVisitedPanels((prev) => (prev.has(panel) ? prev : new Set([...prev, panel])))
  }, [panel])
  const panelMounted = (id: EditorPanelId) => panel === id || visitedPanels.has(id)
  const [outputMs, setOutputMs] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [playerMuted, setPlayerMuted] = useState(false)
  const [playerVolume, setPlayerVolume] = useState(100)
  const [meterOn, setMeterOn] = useState(false)
  useEffect(() => {
    try {
      setMeterOn(localStorage.getItem('clips.editor.vu') === '1')
    } catch {
      /* private mode */
    }
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem('clips.editor.vu', meterOn ? '1' : '0')
    } catch {
      /* private mode */
    }
  }, [meterOn])
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const previewFrameRef = useRef<HTMLDivElement | null>(null)
  const [previewFrameW, setPreviewFrameW] = useState(999)
  const [previewQuality, setPreviewQuality] = useState<PreviewQuality>(() => readPreviewQuality())
  const [previewZoom, setPreviewZoom] = useState<PreviewZoom>('fit')
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 })
  const [fitPct, setFitPct] = useState(100)
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false)
  const selectionRef = useRef<TranscriptSelection | null>(null)
  const seededExportTemplateRef = useRef(false)
  const {
    edits,
    undo: undoEdits,
    redo: redoEdits,
    jumpHistory: jumpHistoryEdits,
    historyPast,
    historyPastLabels,
    historyFuture,
    canUndo,
    canRedo,
    saveState,
    applyCleanupCut,
    applyCleanupCuts,
    setCutRanges,
    setWordFix,
    applyWordFixesBatch,
    restoreWord,
    restoreCutRange,
    setLayoutMode,
    setShotOverride,
    setTrim: setTrimRaw,
    setCaptions,
    toggleEmphasis,
    mergeBroll,
    setBroll,
    removeBroll,
    attachMusicGeneration,
    patchMusic,
    setMusic,
    addSfx,
    placeVoiceoverClip,
    updateSfx,
    removeSfx,
    setEdits,
    hydrateEdits,
    layers,
    setLayers,
    patchStudioSound,
    flushSave,
    syncServerUpdatedAt,
    syncEditsSaveVersion,
    splitLayoutAtSource,
    cutSectionAtSource,
    setLayoutModeAtSource,
    updateBrollItem,
    applyRestoredEdits,
    applyProducerPatch,
    producerStrip,
  } = useEditorState(clipId, bounds, initialEdits, {
    serverUpdatedAt,
    editsSaveVersion,
    words,
    editorSaveSeq:
      typeof (aiMeta as { __editorSaveSeq?: number } | null)?.__editorSaveSeq === 'number'
        ? (aiMeta as { __editorSaveSeq: number }).__editorSaveSeq
        : 0,
  })
  // TC2: an audition (a slider's live preview, e.g. Color > HSL) can outlive its commit when the
  // slider reports one more value after release; it then masked Undo / Redo in the preview (Undo
  // reverted the edit, the preview kept the slider look until Color > Reset cleared it). Undo /
  // Redo always drop the audition so the preview shows exactly the restored edits.
  const undo = useCallback(() => {
    setAuditionEdits(null)
    undoEdits()
  }, [undoEdits])
  const redo = useCallback(() => {
    setAuditionEdits(null)
    redoEdits()
  }, [redoEdits])
  const jumpHistory = useCallback(
    (steps: number) => {
      setAuditionEdits(null)
      jumpHistoryEdits(steps)
    },
    [jumpHistoryEdits],
  )
  const historyPanel = (
    <EditorHistoryPanel
      edits={edits}
      historyPast={historyPast}
      historyPastLabels={historyPastLabels}
      historyFuture={historyFuture}
      jumpHistory={jumpHistory}
      disabled={!canUndo && !canRedo}
    />
  )

  const onApplyCleanupPass = useCallback(
    (proposals: CleanupProposal[], label: string) => {
      logEditorDecision('cleanup_pass', { clipId, label, count: proposals.length })
      applyCleanupCuts(
        proposals.map((p) => p.range),
        label,
      )
    },
    [applyCleanupCuts, clipId],
  )

  const onApplyCleanupProposal = useCallback(
    (proposal: CleanupProposal) => {
      logEditorDecision('cleanup_apply', {
        clipId,
        kind: proposal.kind,
        range: proposal.range,
      })
      applyCleanupCut(proposal.range)
    },
    [applyCleanupCut, clipId],
  )

  const onRestoreCleanupProposal = useCallback(
    (proposal: CleanupProposal) => {
      logEditorDecision('cleanup_restore', {
        clipId,
        kind: proposal.kind,
        range: proposal.range,
      })
      restoreCutRange(proposal.range)
    },
    [clipId, restoreCutRange],
  )

  const onStickerMove = useCallback(
    (x: number, y: number) => {
      setLayers((prev) =>
        prev.map((l) =>
          l.type === 'sticker' && (l as StickerLayer).kind === 'follow_cta'
            ? ({ ...l, x, y } as typeof l)
            : l,
        ),
      )
    },
    [setLayers],
  )

  const onPipCornerChange = useCallback(
    (corner: 'TL' | 'TR' | 'BL' | 'BR') => {
      setEdits({
        ...edits,
        layout: {
          ...edits.layout,
          facecam: { ...edits.layout.facecam, pipCorner: corner },
        },
      })
    },
    [edits, setEdits],
  )

  const applyCutRange = useCallback(
    (range: [number, number]) => {
      applyCleanupCut(range)
    },
    [applyCleanupCut],
  )

  const handleDeriveClip = useCallback(
    async (trimIn: number, trimOut: number, deriveTitle?: string) => {
      setPendingDerivedClipId('pending')
      try {
        const data = await deriveClipFromEditor(clipId, { trimIn, trimOut, title: deriveTitle })
        setPendingDerivedClipId(data.clipId)
        toast.success('New clip created from selection')
      } catch (e) {
        setPendingDerivedClipId(null)
        toast.error(e instanceof Error ? e.message : 'Could not create clip')
      }
    },
    [clipId],
  )

  const toggleLoopFriendly = useCallback(() => {
    setEdits({ ...edits, loopFriendlyEnd: !(edits.loopFriendlyEnd ?? false) })
  }, [edits, setEdits])

  const setTrim = useCallback(
    (trim: { in: number; out: number }) => {
      logEditorDecision('timeline_trim', {
        clipId,
        trimIn: trim.in,
        trimOut: trim.out,
        clipStartMs: bounds.clipStartMs,
        clipEndMs: bounds.clipEndMs,
      })
      setTrimRaw(trim)
    },
    [bounds.clipEndMs, bounds.clipStartMs, clipId, setTrimRaw],
  )

  useEffect(() => {
    logEditorDecision('clip_load', {
      clipId,
      startMs: bounds.clipStartMs,
      endMs: bounds.clipEndMs,
      durationMs: bounds.clipEndMs - bounds.clipStartMs,
      sourceHost: hostOnlyFromUrl(videoUrl),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount
  }, [])

  useEffect(() => {
    if (seededExportTemplateRef.current) return
    seededExportTemplateRef.current = true
    const s = (aiMeta as { streamer?: { login?: string; platform?: string } } | null)?.streamer
    const platform =
      s?.platform === 'kick' ? 'kick' : s?.platform === 'twitch' ? 'twitch' : undefined
    const login = s?.login
    const channelUrl =
      login && platform
        ? platform === 'kick'
          ? `https://kick.com/${login}`
          : `https://twitch.tv/${login}`
        : undefined
    const next = seedEditorExportTemplate(edits, { title, aiMeta }, { platform, channelUrl })
    if (next.exportTemplate !== edits.exportTemplate) setEdits(next, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on open
  }, [])

  const [showSurrounding, setShowSurrounding] = useState(false)
  useEffect(() => {
    try {
      setShowSurrounding(localStorage.getItem('transovo.script.showSurrounding') === '1')
    } catch {
      /* private mode */
    }
  }, [])

  const editorWordsContextMs = showSurrounding ? SHOW_SURROUNDING_CONTEXT_MS : undefined
  const { words: clipEditorWords, wordsLoading } = useEditorWords(
    clipId,
    words,
    bounds,
    edits.trim,
    editorWordsContextMs,
  )
  // E5b: words of transcribed media join the transcript where that clip's own sound plays.
  const mediaTranscripts = useMediaTranscripts(projectId)
  const editSources = edits.sources
  const editSourceSegments = edits.sourceSegments
  const editorWords = useMemo(
    () => mergeMediaWords(clipEditorWords, { sources: editSources, sourceSegments: editSourceSegments }, mediaTranscripts.transcripts),
    [clipEditorWords, editSources, editSourceSegments, mediaTranscripts.transcripts],
  )
  const fvHighlights = useFullVideoHighlights(projectId, fullVideo, editorWords)
  const [versionsEnabled, setVersionsEnabled] = useState(true)
  const [editVersions, setEditVersions] = useState<EditVersionRow[]>([])
  const vocabMountRef = useRef(false)

  useEffect(() => {
    void clipsFetch<{ items: EditVersionRow[] } | { code: string }>(`/api/clips/clips/${clipId}/versions`)
      .then((data) => {
        if (data && 'code' in data && data.code === 'VERSIONS_UNAVAILABLE') {
          setVersionsEnabled(false)
          return
        }
        if (data && 'items' in data) setEditVersions(data.items)
      })
      .catch(() => setVersionsEnabled(false))
  }, [clipId])

  useEffect(() => {
    if (vocabMountRef.current || !editorWords.length) return
    vocabMountRef.current = true
    void (async () => {
      try {
        const res = await clipsFetch<{ data: { vocabulary?: VocabEntry[]; vocabAutoApply?: boolean } }>(
          '/api/clips/export-user-preferences',
        )
        const vocabulary = res.data?.vocabulary ?? []
        if (!vocabulary.length) return
        const fp = vocabularyFingerprint(vocabulary)
        if (!shouldApplyVocabulary(res.data?.vocabAutoApply, edits.vocabApplied, fp)) return
        const batch = vocabularyBatchFixes(editorWords, edits, vocabulary)
        if (!batch.count) {
          applyWordFixesBatch({}, {}, { vocabApplied: fp, pushHistory: false })
          return
        }
        const prevEdits = edits
        applyWordFixesBatch(batch.fixes, batch.meta, { vocabApplied: fp, pushHistory: false })
        logEditorDecision('vocab_apply', { n: batch.count })
        toast.success(`Applied ${batch.count} vocabulary fix${batch.count === 1 ? '' : 'es'}`, {
          action: { label: 'Undo', onClick: () => setEdits(prevEdits) },
        })
      } catch {
        console.warn('[clipper:vocab] prefs_fail')
      }
    })()
  }, [applyWordFixesBatch, clipId, editorWords, edits, setEdits])

  const refreshVersions = useCallback(async () => {
    if (!versionsEnabled) return
    try {
      const data = await clipsFetch<{ items: EditVersionRow[] }>(`/api/clips/clips/${clipId}/versions`)
      setEditVersions(data.items)
    } catch {
      /* ignore */
    }
  }, [clipId, versionsEnabled])

  const saveEditVersion = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      try {
        const res = await clipsFetch<{ id: string }>(`/api/clips/clips/${clipId}/versions`, {
          method: 'POST',
          body: JSON.stringify({ name: trimmed, kind: 'manual', edits }),
        })
        if (!res?.id) throw new Error('Save failed')
        logEditorDecision('version_save', { kind: 'manual' })
        const row: EditVersionRow = {
          id: res.id,
          name: trimmed,
          kind: 'manual',
          createdAt: new Date().toISOString(),
        }
        setEditVersions((prev) => [row, ...prev])
        await refreshVersions()
        toast.success('Version saved')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save version')
      }
    },
    [clipId, edits, refreshVersions],
  )

  const restoreEditVersion = useCallback(
    async (versionId: string) => {
      const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      try {
        await clipsFetch(`/api/clips/clips/${clipId}/versions`, {
          method: 'POST',
          body: JSON.stringify({
            name: `Before restore · ${stamp}`,
            kind: 'auto',
            edits,
          }),
        })
      } catch {
        toast.message("Couldn't save a backup first — use Undo to go back")
      }
      try {
        const row = await clipsFetch<{ edits: ClipEditsV2 }>(`/api/clips/clips/${clipId}/versions/${versionId}`)
        applyRestoredEdits(normalizeEdits(row.edits, bounds))
        logEditorDecision('version_restore', { kind: 'manual' })
        toast.success('Version restored')
        await refreshVersions()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Restore failed')
      }
    },
    [applyRestoredEdits, bounds, clipId, edits, refreshVersions],
  )

  const deleteEditVersion = useCallback(
    async (versionId: string) => {
      const removed = editVersions.find((v) => v.id === versionId)
      setEditVersions((prev) => prev.filter((v) => v.id !== versionId))
      try {
        await clipsFetch(`/api/clips/clips/${clipId}/versions/${versionId}`, { method: 'DELETE' })
        toast.success('Version deleted', {
          action: removed
            ? {
                label: 'Undo',
                onClick: () => {
                  void clipsFetch(`/api/clips/clips/${clipId}/versions`, {
                    method: 'POST',
                    body: JSON.stringify({
                      name: removed.name,
                      kind: removed.kind,
                      edits,
                    }),
                  }).then(() => refreshVersions())
                },
              }
            : undefined,
        })
        await refreshVersions()
      } catch (e) {
        await refreshVersions()
        toast.error(e instanceof Error ? e.message : 'Delete failed')
      }
    },
    [clipId, editVersions, edits, refreshVersions],
  )

  const restoreOriginalEdits = useCallback(async () => {
    const original = editVersions.find((v) => v.kind === 'original')
    if (original) {
      await restoreEditVersion(original.id)
      logEditorDecision('version_restore', { kind: 'original' })
      return
    }
    setEdits(
      normalizeEdits(
        {
          ...edits,
          trim: { in: bounds.clipStartMs, out: bounds.clipEndMs },
          cutRanges: [],
          wordFixes: {},
          wordFixMeta: undefined,
        },
        bounds,
      ),
    )
    toast.message('Original was not saved for this clip; reset cuts and trim only')
  }, [bounds, editVersions, edits, restoreEditVersion, setEdits])

  const audioNorm = useMemo(() => normalizeAudioEdits(edits.audio), [edits.audio])
  const studioSound = audioNorm.studioSound
  // E5: project media library (uploads + Rooms angles) — Media panel, B-roll Upload tab, preview.
  const media = useProjectMedia(projectId, mediaTranscripts)
  const clipRec = useClipRecorder(projectId)
  const recAtMsRef = useRef(0)
  const editsRef = useRef(edits)
  editsRef.current = edits
  const recPlacement = useClipRecordingPlacement({
    projectId,
    getEdits: () => editsRef.current,
    mediaLabels: media.items.map((i) => i.label),
    onCommitEdits: setEdits,
    refreshMedia: () => media.refresh(),
  })
  const recordDevicesOk = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
  const tpLsKey = `clip-rec:${projectId}:teleprompter`
  const [teleprompterOpen, setTeleprompterOpen] = useState(false)
  const [teleprompterScript, setTeleprompterScript] = useState('')
  useEffect(() => {
    if (typeof window === 'undefined') return
    setTeleprompterScript(localStorage.getItem(tpLsKey) ?? '')
  }, [tpLsKey])
  const saveTeleprompterScript = useCallback(
    (t: string) => {
      setTeleprompterScript(t)
      localStorage.setItem(tpLsKey, t)
    },
    [tpLsKey],
  )
  // G1b2: synced camera angles in the media library (manual multicam keys 1–9 / transcript / menu).
  const angleSources = useMemo(
    () => media.items.filter((i) => i.mediaType === 'video' && !i.isMain && (i.ref === 'take' || i.syncMs != null)).map(sourceFromItem),
    [media.items],
  )
  const mediaItems = media.items
  const musicUploadId = edits.audio?.music?.uploadId ?? null
  const musicGenId = musicUploadId ? null : (edits.audio?.music?.generationId ?? null)
  const musicGen = useGeneration(musicGenId)
  const musicUrl = musicUploadId ? mediaUrlFor(mediaItems, musicUploadId) : musicGen.downloadUrl
  const aiExtras = clipEditorAiExtrasEnabled()
  const textVoiceoverTarget = useMemo(() => {
    if (!selectedTextId) return null
    const t = (edits.textItems ?? []).find((x) => x.id === selectedTextId)
    if (!t || t.kind) return null
    return { text: t.text, atMs: t.startMs }
  }, [selectedTextId, edits.textItems])
  // E2: hidden / muted timeline lanes apply to preview exactly as the worker applies them to export
  // (a muted Voice lane also drops the dub track, as export does).
  const renderEdits = useMemo(() => applyTimelineLaneState(edits), [edits])
  const laneVoiceMuted = voiceMuted(edits)
  const { dubs, refreshDubs, dubAudioUrl, useDubAudio, previewWords, duckWords } = useDubPreview(
    clipId,
    renderEdits,
    editorWords,
    { enabled: aiExtras },
  )

  useEffect(() => {
    const previewEdits = editorPreviewEdits(edits, editorWords)
    const segs = keepSegments(previewEdits.trim.in, previewEdits.trim.out, previewEdits.cutRanges)
    logEditorDecision('edits_cuts', {
      clipId,
      trimIn: previewEdits.trim.in,
      trimOut: previewEdits.trim.out,
      cutCount: previewEdits.cutRanges.length,
      segmentCount: segs.length,
      outputDurationMs: outputDurationMs(previewEdits),
    })
  }, [clipId, edits, editorWords])

  useEffect(() => {
    logEditorDecision('preview_source', {
      clipId,
      source: useDubAudio ? 'dub' : 'source',
      dubTrackId: useDubAudio ? edits.audioTrack : null,
    })
  }, [clipId, edits.audioTrack, useDubAudio])

  const previewEditsForTimeline = useMemo(
    () => editorPreviewEdits(edits, editorWords),
    [edits, editorWords],
  )
  const playheadSourceMs = useMemo(
    () => sourceMsAtOutput(previewEditsForTimeline, outputMs),
    [previewEditsForTimeline, outputMs],
  )
  // G1c: source monitor (Media panel) + match frame (F on the timeline).
  const timelineTb = useMemo(() => timebaseFor(previewEditsForTimeline), [previewEditsForTimeline])
  const [monitorRequest, setMonitorRequest] = useState<MonitorRequest | null>(null)
  const matchFrame = (outMs: number): boolean => {
    const m = matchFrameAt(renderEdits, timelineTb, outMs, media.items)
    if (!m) {
      toast.message('No source media at the playhead', { id: 'match-frame' })
      return true
    }
    setMonitorRequest((r) => ({ itemId: m.itemId, mediaMs: m.mediaMs, seq: (r?.seq ?? 0) + 1 }))
    selectPanel('media')
    return true
  }
  // FV4e: "Build from transcript" (Script panel) → Media panel source monitor on an uploaded file.
  const openBuildFromTranscript = () => {
    const it = buildFromTranscriptItem(media.items, mediaTranscripts.transcripts)
    if (!it) {
      toast.message('Upload a video or audio file in Media first, then build from its transcript', { id: 'build-from-transcript' })
      selectPanel('media')
      return
    }
    setMonitorRequest((r) => ({ itemId: it.id, mediaMs: 0, seq: (r?.seq ?? 0) + 1 }))
    selectPanel('media')
  }

  const onLayoutMode = useCallback(
    (
      mode: ClipEditsV2['layout']['mode'],
      facecam?: ClipEditsV2['layout']['facecam'],
      opts?: { reason?: 'layout_panel' | 'quick_picker' | 'export' },
    ) => {
      logEditorDecision('layout', {
        clipId,
        mode,
        reason: opts?.reason ?? 'layout_panel',
      })
      setLayoutMode(mode, facecam)
    },
    [clipId, setLayoutMode],
  )

  const onLayoutPick = useCallback(
    (mode: ClipEditsV2['layout']['mode'], facecam?: ClipEditsV2['layout']['facecam']) => {
      onLayoutMode(mode, facecam, { reason: 'quick_picker' })
    },
    [onLayoutMode],
  )

  const studioGenId = studioSound?.enabled && studioSound.generationId ? studioSound.generationId : null
  const studioGen = useGeneration(studioGenId, 1500)

  const [studioJobId, setStudioJobId] = useState<string | null>(null)

  const enqueueStudioSound = useCallback(async () => {
    const { generationId, jobId } = await clipsFetch<{ generationId: string; jobId: string }>(
      `/api/clips/clips/${clipId}/studio-sound`,
      { method: 'POST', body: '{}' },
    )
    setStudioJobId(jobId)
    patchStudioSound({
      enabled: true,
      generationId,
      mix: studioSound?.mix ?? DEFAULT_STUDIO_SOUND_MIX,
    })
  }, [clipId, patchStudioSound, studioSound?.mix])

  const disableStudioSound = useCallback(() => {
    patchStudioSound({
      enabled: false,
      generationId: studioSound?.generationId ?? '',
      mix: studioSound?.mix ?? DEFAULT_STUDIO_SOUND_MIX,
    })
    setStudioJobId(null)
  }, [patchStudioSound, studioSound?.generationId, studioSound?.mix])

  const studioPreviewActive = Boolean(
    studioSound?.enabled && studioGen.status === 'READY' && studioGen.downloadUrl && !useDubAudio,
  )

  const { loading: studioPollLoading, studioSlow, retryPoll } = useStudioSoundPreview({
    clipId,
    generationId: studioGenId,
    jobId: studioJobId,
    enabled: Boolean(studioSound?.enabled && !useDubAudio && !studioPreviewActive),
    onReady: () => {
      setStudioJobId(null)
      void studioGen.refresh()
    },
    onFailed: () => {
      disableStudioSound()
    },
  })

  const studioPreviewLoading = Boolean(
    studioSound?.enabled && !useDubAudio && !studioPreviewActive && (studioPollLoading || studioGen.running),
  )

  const startStudioSoundPreview = useCallback(() => {
    void enqueueStudioSound().catch(() => {
      toast.error('Could not start Studio Sound')
    })
  }, [enqueueStudioSound])

  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null)
  const [brandTemplates, setBrandTemplates] = useState<
    {
      id: string
      name: string
      settings: unknown
      logoKey?: string | null
      introVideoKey?: string | null
      outroVideoKey?: string | null
    }[]
  >([])
  const outDur = editorPreviewDurationMs(edits, editorWords)
  // G4a: a deleted / undone adjustment layer drops the Color target back to the whole video.
  useEffect(() => {
    if (colorTarget.kind === 'adjust' && !edits.adjustLayers?.some((l) => l.id === colorTarget.id)) setColorTarget({ kind: 'video' })
  }, [colorTarget, edits.adjustLayers])
  const displayEdits = useMemo(() => ({ ...editorPreviewEdits(edits, editorWords), speed: edits.speed }), [edits, editorWords])
  const displayDur = useMemo(() => displayDurationMs(displayEdits), [displayEdits])
  // E4fix: the clock shows output (exported) time on both sides — position warped like the duration.
  const displayPos = useMemo(() => Math.min(displayDur, displayPositionMs(displayEdits, outputMs)), [displayDur, displayEdits, outputMs])
  /** TC2: match the timeline ruler / playhead (export time with inserts), not a lagging preview tick. */
  const transportClockMs = useMemo(() => {
    const preview = editorPreviewEdits(edits, editorWords)
    const tb = timebaseFor(preview)
    const tmap = exportTimeMap(tb.segs, edits.inserts)
    const exportAt = toExportMs(tmap, outputMs, 'end')
    return Math.min(displayDur, Math.max(0, exportAt))
  }, [displayDur, edits, editorWords, outputMs])

  useEffect(() => {
    void clipsFetch<{ items: { id: string; name: string; settings: unknown }[] }>('/api/clips/brand/templates')
      .then((data) => setBrandTemplates(data.items ?? []))
      .catch(() => setBrandTemplates([]))
  }, [])
  const uploadUrlFor = useCallback((id: string) => mediaUrlFor(mediaItems, id), [mediaItems])
  const sfxPreview = useSfxCues(edits.audio?.sfx ?? [], uploadUrlFor)
  const previewBrollMedia = useMemo(() => {
    // E5: uploaded B-roll (videos / stills) resolves through the project media library.
    const uploadRows: BrollMediaRow[] = []
    for (const it of edits.broll ?? []) {
      if (it.source !== 'upload') continue
      const m = mediaItems.find((x) => x.refId === it.uploadId)
      uploadRows.push({
        id: it.id,
        source: 'upload',
        uploadId: it.uploadId,
        url: m?.url ?? null,
        mediaType: it.still || m?.mediaType === 'image' ? 'image' : 'video',
      } as BrollMediaRow)
    }
    const byId = new Map((edits.broll ?? []).map((b) => [b.id, b]))
    const liveServer = brollMedia.filter((r) => {
      const it = byId.get(r.id)
      if (!it) return true
      if (it.source === 'upload') return false
      return it.source === 'stock' ? r.assetId === it.assetId : r.generationId === it.generationId
    })
    return brollMediaForItems(edits.broll ?? [], [...liveServer, ...uploadRows])
  }, [brollMedia, edits.broll, mediaItems])
  const sourceUrls = useMemo(() => {
    const m: Record<string, string> = {}
    for (const it of mediaItems) if (it.url) m[it.refId] = it.url
    return m
  }, [mediaItems])
  const [selectedVideo, setSelectedVideo] = useState<{ srcInMs: number; srcOutMs: number } | null>(null)
  const [selectedSourceSegmentId, setSelectedSourceSegmentId] = useState<string | null>(null)
  const applyAdd = useCallback(
    (res: ReturnType<typeof addMediaToLane>) => {
      if (!res.edits) {
        toast.message(res.message)
        return
      }
      setEdits(res.edits)
      if (res.message) toast.message(res.message)
    },
    [setEdits],
  )
  const onAddMedia = useCallback(
    (item: ProjectMediaItem, lane: MediaDropLane, atOutMs: number = outputMs) => {
      applyAdd(
        addMediaToLane(edits, timebaseFor(previewEditsForTimeline), item, lane, atOutMs, () => crypto.randomUUID()),
      )
    },
    [applyAdd, edits, outputMs, previewEditsForTimeline],
  )
  const onDropMedia = useCallback(
    (lane: MediaDropLane, atOutMs: number, mediaId: string, trackId?: string) => {
      const item = mediaItems.find((m) => m.id === mediaId)
      if (!item) return
      const res = addMediaToLane(edits, timebaseFor(previewEditsForTimeline), item, lane, atOutMs, () => crypto.randomUUID())
      // G1b3: dropped on an extra track row → the new item lives on that track.
      applyAdd(res.edits ? { ...res, edits: placeAddedOnTrack(edits, res.edits, lane, trackId) } : res)
    },
    [applyAdd, edits, mediaItems, previewEditsForTimeline],
  )
  const onReplaceSelected = useCallback(
    (item: ProjectMediaItem) => {
      if (!selectedVideo) {
        toast.message('Select a Video clip on the timeline first')
        return
      }
      applyAdd(replaceVideoRange(edits, item, selectedVideo.srcInMs, selectedVideo.srcOutMs, () => crypto.randomUUID()))
    },
    [applyAdd, edits, selectedVideo],
  )
  const onReplaceBrollMedia = useCallback(
    (item: ProjectMediaItem) => {
      if (!replaceBrollId) return
      applyAdd(replaceBrollMedia(edits, replaceBrollId, item))
      setReplaceBrollId(null)
    },
    [applyAdd, edits, replaceBrollId],
  )
  const replaceMediaApi = useMemo((): ProjectMediaApi => {
    const uploadFiles = async (files: File[]) => {
      const created = await media.uploadFiles(files)
      const v = created.find((x) => x.mediaType !== 'audio')
      if (v) onReplaceBrollMedia(v)
      return created
    }
    return { ...media, uploadFiles }
  }, [media, onReplaceBrollMedia])
  const onSelectSourceSegment = useCallback(
    (id: string) => {
      setSelectedSourceSegmentId(id)
      selectPanel('media')
    },
    [selectPanel],
  )
  // E4: per-item speed → the music bed follows the video rate (pitch-preserved like export atempo).
  // TC1 (TL-39): × the preview-only speed (1 when unset — same as the default element rate).
  const previewRate = useSyncExternalStore(subscribePreviewRate, getPreviewRate, () => 1)
  const baseMusicRate = renderEdits.segmentSpeeds?.length
    ? (normalizeEditSpeed(renderEdits.speed) ?? 1) * speedAtSource(renderEdits.segmentSpeeds, playheadSourceMs)
    : undefined
  const musicRate = (baseMusicRate ?? 1) * previewRate
  const onTimelineSelection = useCallback(
    (item: TimelineItem | null) => {
      setSelectedVideo(
        item?.lane === 'video' && item.srcInMs != null && item.srcOutMs != null
          ? { srcInMs: item.srcInMs, srcOutMs: item.srcOutMs }
          : null,
      )
      if (item?.lane === 'video' && item.srcInMs != null && item.srcOutMs != null) {
        setColorTarget({ kind: 'segment', fromMs: item.srcInMs, toMs: item.srcOutMs, label: item.label })
      } else if (item?.lane === 'broll') {
        setColorTarget({ kind: 'broll', id: item.id, label: item.label })
      } else if (item?.lane === 'adjust') {
        setColorTarget({ kind: 'adjust', id: item.id, label: item.label })
      } else {
        setColorTarget({ kind: 'video' })
      }
      if (item?.lane === 'text' && item.id !== 'hook') setSelectedTextId(item.id)
      // G3a: a caption line selected on the Captions row is highlighted in Captions → Manual captions.
      if (item?.lane === 'captions') setSelectedCaptionLineId(item.id)
      // G1a: the timeline selection drives the canvas box + Properties too.
      setSelVideoSeg(
        item?.lane === 'video' && item.srcInMs != null && item.srcOutMs != null ? { srcInMs: item.srcInMs, srcOutMs: item.srcOutMs } : null,
      )
      const t: KeyframeTarget | null = !item
        ? null
        : item.lane === 'video'
          ? 'video'
          : item.lane === 'broll'
            ? `broll:${item.id}`
            : item.lane === 'text'
              ? item.id === 'hook'
                ? 'text'
                : `text:${item.id}`
              : item.lane === 'voice'
                ? 'voice'
                : item.lane === 'music'
                  ? 'music'
                  : item.lane === 'sfx'
                    ? `sfx:${item.id}`
                    : item.lane === 'adjust'
                      ? `adjust:${item.id}`
                      : null
      setCanvasSel((prev) => {
        if (prev?.target !== t) setCropMode(false)
        return t ? { target: t, label: item?.label || t } : null
      })
    },
    [],
  )
  const onCanvasSelect = useCallback(
    (target: KeyframeTarget | null) => {
      setCanvasSel((prev) => {
        if (prev?.target !== target) setCropMode(false)
        if (!target) return null
        const label =
          target === 'video'
            ? 'Video'
            : target === 'text'
              ? 'Hook'
              : target.startsWith('broll:')
                ? 'B-roll'
                : (edits.textItems?.find((x) => `text:${x.id}` === target)?.text ?? 'Text').slice(0, 40)
        return { target, label }
      })
      setTimelineSelReq((prev) => {
        const seq = (prev?.seq ?? 0) + 1
        if (!target) return { lane: 'video', id: '__none__', seq }
        if (target === 'video') return { lane: 'video', atMs: outputMs, seq }
        if (target === 'text') return { lane: 'text', id: 'hook', seq }
        if (target.startsWith('broll:')) return { lane: 'broll', id: target.slice(6), seq }
        return { lane: 'text', id: target.slice(5), seq }
      })
      if (target?.startsWith('text:')) setSelectedTextId(target.slice(5))
      // Text panel open + a text item clicked: stay there (it follows the selection); else Properties.
      if (target && !(panel === 'text' && target.startsWith('text:'))) setPanel('inspector')
    },
    [edits.textItems, outputMs, panel],
  )
  const onCanvasCommit = useCallback(
    (next: ClipEditsV2, pushHistory: boolean) => setEdits(next, pushHistory),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const audioMeter = useAudioMix({
    musicRate,
    videoRef,
    edits: renderEdits,
    words: duckWords,
    musicUrl,
    dubUrl: dubAudioUrl,
    useDubAudio,
    sfxCues: renderEdits.audio?.sfx?.length ? sfxPreview.cues : [],
    outputMs,
    playing,
    outputDurationMs: outDur,
    voiceMuted: laneVoiceMuted,
    meterOn,
  })
  const peakLevels = usePeakLevels(meterOn ? audioMeter.analysers : null)

  useEffect(() => {
    const key = (edits.brand as { logoKey?: string } | undefined)?.logoKey
    if (!key) {
      setBrandLogoUrl(null)
      return
    }
    void clipsFetch<{ url: string }>(`/api/clips/brand/logo?key=${encodeURIComponent(key)}`)
      .then((d) => setBrandLogoUrl(d.url))
      .catch(() => setBrandLogoUrl(null))
  }, [edits.brand])

  const saveLayersBrandTemplate = useCallback(async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const logoKey = (edits.brand as { logoKey?: string } | undefined)?.logoKey ?? null
    const settings = {
      ...clipStyleSettingsFromEdits(edits),
      templateV3: templateFromEdits(edits, trimmed),
    }
    const tempId = `tmp_${Date.now()}`
    setBrandTemplates((prev) => [
      { id: tempId, name: trimmed, settings, pending: true } as {
        id: string
        name: string
        settings: unknown
        pending?: boolean
      },
      ...prev,
    ])
    try {
      const res = await saveClipBrandTemplate({
        name: trimmed,
        settings,
        logoKey,
      })
      setBrandTemplates((prev) => [
        { id: res.template.id, name: res.template.name, settings },
        ...prev.filter((t) => t.id !== tempId && t.id !== res.template.id),
      ])
      toast.success('Brand template saved')
      void clipsFetch<{ items: { id: string; name: string; settings: unknown }[] }>('/api/clips/brand/templates')
        .then((data) => setBrandTemplates(data.items ?? []))
        .catch(() => {})
    } catch (e) {
      setBrandTemplates((prev) => prev.filter((t) => t.id !== tempId))
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }, [edits])

  const applyBrandTemplateById = useCallback(
    (templateId: string) => {
      const row = brandTemplates.find((t) => t.id === templateId)
      if (!row) return
      let next: ClipEditsV2
      try {
        next = applyBrandTemplateToEdits(edits, {
          id: row.id,
          logoKey: row.logoKey ?? null,
          introVideoKey: row.introVideoKey ?? null,
          outroVideoKey: row.outroVideoKey ?? null,
          settings: row.settings as BrandTemplateSettings,
        })
      } catch (e) {
        toast.error(e instanceof Error ? `Template could not be applied: ${e.message}` : 'Template could not be applied')
        return
      }
      setEdits(next)
      // E1fix: say what changed (or that nothing did) instead of a bare "Template applied".
      toast.success(templateAppliedMessage(row.name, describeTemplateChange(edits, next)))
    },
    [brandTemplates, edits, setEdits],
  )

  const saveClipTemplate = useCallback(async () => {
    const name = window.prompt('Clip template name (captions + layout + brand kit)')
    if (!name?.trim()) return
    try {
      const logoKey = (edits.brand as { logoKey?: string } | undefined)?.logoKey ?? null
      await saveClipBrandTemplate({
        name: name.trim(),
        settings: clipStyleSettingsFromEdits(edits),
        logoKey,
      })
      toast.success('Clip template saved — apply from project results or Brand')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }, [edits])

  const applyBrand = useCallback(async () => {
    try {
      const data = await clipsFetch<{
        template: {
          id: string
          logoKey: string | null
          introVideoKey: string | null
          outroVideoKey: string | null
          settings: BrandTemplateSettings
        } | null
        logoUrl: string | null
      }>('/api/clips/brand')
      if (!data.template) {
        toast.error('No brand template saved')
        return
      }
      setEdits(
        applyBrandTemplateToEdits(edits, {
          id: data.template.id,
          logoKey: data.template.logoKey,
          introVideoKey: data.template.introVideoKey,
          outroVideoKey: data.template.outroVideoKey,
          settings: data.template.settings,
        }),
      )
      setBrandLogoUrl(data.logoUrl)
      toast.success('Brand applied')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Apply brand failed')
    }
  }, [edits, setEdits])

  const onTick = useCallback((tick: { sourceMs: number; outputMs: number; playing: boolean }) => {
    setOutputMs(tick.outputMs)
    setPlaying(tick.playing)
  }, [])

  const mediaOffsetMs = editorMedia?.offsetMs ?? 0

  const seekSource = useCallback(
    (sourceMs: number) => {
      const v = videoRef.current
      if (!v) return
      const resume = keepPlayStateAcrossSeek(v)
      v.currentTime = videoTimeFromSourceMs(sourceMs, mediaOffsetMs)
      resume()
    },
    [mediaOffsetMs],
  )

  const seekOutput = useCallback(
    (ms: number) => {
      const preview = editorPreviewEdits(edits, editorWords)
      const clamped = Math.max(0, Math.min(Math.max(0, outputDurationMs(preview) - 1), Math.round(ms)))
      outputMsRef.current = clamped
      setOutputMs(clamped)
      const v = videoRef.current
      if (!v) return
      const resume = keepPlayStateAcrossSeek(v)
      seekToOutputMs(v, preview, clamped, mediaOffsetMs)
      resume()
    },
    [edits, editorWords, mediaOffsetMs],
  )

  /** Transport / display-clock scrub (PlayerControls) → stored edit ms. Timeline uses seekOutput directly. */
  const seekDisplay = useCallback(
    (displayMs: number) => {
      const preview = editorPreviewEdits(edits, editorWords)
      const timingActive =
        preview.segmentSpeeds?.length ||
        preview.inserts?.length ||
        (normalizeEditSpeed(preview.speed) ?? 1) !== 1
      const editMs = timingActive ? editMsAtDisplayMs({ ...preview, speed: edits.speed }, displayMs) : displayMs
      seekOutput(editMs)
    },
    [edits, editorWords, seekOutput],
  )

  const togglePlay = async () => {
    const v = videoRef.current
    if (!v) return
    if (!v.paused) {
      v.pause()
      return
    }
    v.volume = playerVolume / 100
    const mode = await playWithSound(v)
    if (mode === 'muted') {
      setPlayerMuted(true)
    } else {
      setPlayerMuted(false)
    }
  }

  const beginClipRecording = useCallback(async () => {
    recAtMsRef.current = outputMs
    if (clipRec.mode === 'voiceover') {
      toast.message('Use headphones to avoid echo', { id: 'vo-headphones' })
      const v = videoRef.current
      if (v) {
        v.muted = clipRec.mutePreview || playerMuted || laneVoiceMuted
        if (clipRec.mutePreview) setPlayerMuted(true)
        if (v.paused) await togglePlay()
      }
    } else {
      videoRef.current?.pause()
    }
    try {
      await clipRec.startRecording({
        onFinish: (take) => {
          clipRec.setArmed(false)
          if (take) void recPlacement.finishTake(take, recAtMsRef.current, clipRec.placeMode)
        },
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start recording')
    }
  }, [clipRec, laneVoiceMuted, outputMs, playerMuted, recPlacement, togglePlay])

  useEffect(() => {
    const v = videoRef.current
    if (!v || useDubAudio) return
    v.muted = playerMuted || laneVoiceMuted
    v.volume = playerVolume / 100
  }, [laneVoiceMuted, playerMuted, playerVolume, useDubAudio, videoUrl])

  const deleteSelection = useCallback(() => {
    const sel = selectionRef.current
    if (!sel || sel.startMs === sel.endMs) return
    const a = Math.min(sel.startMs, sel.endMs)
    const b = Math.max(sel.startMs, sel.endMs)
    const selected = editorWords.filter((w) => {
      const s = w.s * 1000
      const e = w.e * 1000
      return e > a && s < b
    })
    if (!selected.length) return
    const wa = selected[0]
    const wb = selected[selected.length - 1]
    applyCutRange([Math.round(wa.s * 1000), Math.round(wb.e * 1000)])
    sel.clear()
  }, [applyCutRange, editorWords])

  // G1b: J / K / L shuttle. L plays (again: 2× / 4× / 8×), J plays backward (again: faster), K
  // stops. Above 1× and backward the preview scrubs frame by frame (no sound), like a jog wheel.
  const shuttleRef = useRef({ dir: 0 as -1 | 0 | 1, rate: 1, raf: 0, ms: 0, last: 0 })
  const outputMsRef = useRef(outputMs)
  outputMsRef.current = outputMs
  const seekOutputRef = useRef(seekOutput)
  seekOutputRef.current = seekOutput
  const outDurRef = useRef(outDur)
  outDurRef.current = outDur
  const stopShuttle = useCallback(() => {
    const s = shuttleRef.current
    if (s.raf) cancelAnimationFrame(s.raf)
    s.raf = 0
    s.dir = 0
    s.rate = 1
  }, [])
  const shuttle = useCallback(
    (k: 'j' | 'k' | 'l') => {
      const v = videoRef.current
      if (!v) return
      const s = shuttleRef.current
      if (k === 'k') {
        stopShuttle()
        v.pause()
        return
      }
      const dir = k === 'l' ? 1 : -1
      const playingNative = dir === 1 && s.dir === 0 && !v.paused
      if (dir === 1 && s.dir === 0 && v.paused) {
        s.dir = 1
        s.rate = 1
        void togglePlay()
        return
      }
      const rate = s.dir === dir || playingNative ? nextShuttleRate(s.rate) : 1
      if (s.raf) cancelAnimationFrame(s.raf)
      v.pause()
      s.dir = dir
      s.rate = rate
      s.ms = outputMsRef.current
      s.last = performance.now()
      const tick = (now: number) => {
        const dt = now - s.last
        s.last = now
        s.ms = Math.max(0, Math.min(outDurRef.current, s.ms + dt * s.rate * s.dir))
        seekOutputRef.current(s.ms)
        if ((s.dir < 0 && s.ms <= 0) || (s.dir > 0 && s.ms >= outDurRef.current)) {
          stopShuttle()
          return
        }
        s.raf = requestAnimationFrame(tick)
      }
      s.raf = requestAnimationFrame(tick)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stopShuttle],
  )
  useEffect(() => stopShuttle, [stopShuttle])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // TC3 (c): Ctrl/⌘+Z (Shift = redo) and Ctrl+Y stay global on a focused slider — a slider has
      // no undo of its own (text inputs keep their native undo).
      if (isSliderTarget(e.target) && (e.metaKey || e.ctrlKey) && !e.altKey && /^[zy]$/i.test(e.key)) {
        e.preventDefault()
        if (e.shiftKey || e.key.toLowerCase() === 'y') redo()
        else undo()
        return
      }
      if (isEditableTarget(e.target)) return
      if (e.key === 'Escape') {
        if (!document.fullscreenElement) {
          onCanvasSelect(null)
          e.preventDefault()
        }
        return
      }
      const v = videoRef.current
      if (e.code === 'Space' && v) {
        e.preventDefault()
        stopShuttle()
        togglePlay()
      }
      const jkl = shuttleKey(e)
      if (jkl && v && !e.defaultPrevented) {
        e.preventDefault()
        shuttle(jkl)
        return
      }
      const playbackEdits = editorPreviewEdits(edits, editorWords)
      // E2fix: same step as the timeline's item nudge — 1 frame, Shift = 10 frames. Skipped when
      // the timeline already handled the arrow (nudged a selection / locked item).
      const arrow = e.code === 'ArrowLeft' || e.code === 'ArrowRight'
      if (arrow && v && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        const step = arrowStepMs(e.shiftKey) * (e.code === 'ArrowLeft' ? -1 : 1)
        seekToOutputMs(v, playbackEdits, Math.max(0, Math.min(outDur, outputMs + step)))
      }
      if (e.code === 'Backspace' || e.code === 'Delete') {
        e.preventDefault()
        deleteSelection()
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteSelection, edits, onCanvasSelect, outDur, outputMs, redo, undo, shuttle, stopShuttle])

  useEffect(() => {
    const t = setTimeout(() => {
      if (title !== initialTitle) {
        void patchClip(clipId, { title }).then((res) => {
          if (res.updatedAt) syncServerUpdatedAt(res.updatedAt)
        })
      }
    }, 800)
    return () => clearTimeout(t)
  }, [clipId, initialTitle, syncServerUpdatedAt, title])

  const TabIcon = editorRailIcon(panel)
  const meta = TAB_META[panel] ?? { label: panel, hint: '' }
  const previewAspect = edits.aspectRatio ?? '9:16'
  useEffect(() => {
    setPreviewZoom('fit')
    setPreviewPan({ x: 0, y: 0 })
  }, [previewAspect])
  useEffect(() => {
    setPreviewZoom('fit')
    setPreviewPan({ x: 0, y: 0 })
  }, [clipId])
  const mainVideoSize = useMemo(() => {
    const m = mediaItems.find((i) => i.isMain)
    return m?.width && m?.height ? { width: m.width, height: m.height } : null
  }, [mediaItems])
  const canvasBgChipVisible = canvasBgRelevant(
    edits,
    previewAspect,
    mainVideoSize?.width,
    mainVideoSize?.height,
  )
  const compositePreviewClip = editorMedia?.kind === 'composite'
  const aspectStyle = aspectCss(previewAspect)
  useEffect(() => {
    const el = previewFrameRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setPreviewFrameW(entry.contentRect.width))
    ro.observe(el)
    setPreviewFrameW(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [aspectStyle, panel])
  const pickerWhy = clipWhySummary(aiMeta as ClipAiMeta | null)
  const detectedLayout = clipLayoutChip(aiMeta as ClipAiMeta | null)
  const clipTypeLabel = clipTypeBadge(aiMeta as ClipAiMeta | null)
  const streamerSide = (
    aiMeta as {
      streamer?: {
        login?: string
        platform?: string
        meta?: { channel?: string | null; platform?: string }
        chat?: { available?: boolean; messageCount?: number }
      }
    } | null
  )?.streamer
  const streamChannelDisplay = streamerSide?.meta?.channel ?? null
  const vodChatResolveInput = useMemo(
    () => ({
      sourceType: vodChat?.sourceType,
      chatSource: vodChat?.chatSource,
      chatMessages: vodChat?.chatMessages,
      chatError: vodChat?.chatError,
      chatMeta: vodChat?.chatMeta,
      projectStatus,
    }),
    [vodChat, projectStatus],
  )
  const streamChatAvailable = vodChatOverlayEnabled(vodChatResolveInput)
  const streamChatToggleHint = vodChatToggleHint(vodChatResolveInput)

  const applyAutoBrandTemplate = useCallback(() => {
    setEdits(
      applyAutoTemplateToEdits(edits, {
        streamerSide,
        platform:
          streamerSide?.platform === 'kick'
            ? 'kick'
            : streamerSide?.platform === 'twitch'
              ? 'twitch'
              : undefined,
      }),
    )
    toast.success('Auto template applied')
  }, [edits, setEdits, streamerSide])

  const panelBody = (
    <>
      <div className={panel === 'transcript' ? undefined : 'hidden'} aria-hidden={panel !== 'transcript'}>
        <EditorPanelErrorBoundary label="Script">
        <TranscriptPanel
          words={editorWords}
          wordsLoading={wordsLoading}
          clipStartMs={bounds.clipStartMs}
          clipEndMs={bounds.clipEndMs}
          shots={cropShots}
          edits={edits}
          onSeek={seekSource}
          onAddCut={applyCutRange}
          onSaveAsNewClip={handleDeriveClip}
          onWordFix={setWordFix}
          applyWordFixesBatch={applyWordFixesBatch}
          onRestoreWord={restoreWord}
          onRestoreCutRange={restoreCutRange}
          onExtendTrim={(ms) => {
            if (ms < edits.trim.in) setTrim({ in: ms, out: edits.trim.out })
            else if (ms > edits.trim.out) setTrim({ in: edits.trim.in, out: ms })
          }}
          onToggleEmphasis={edits.captions?.keywordHighlight ? toggleEmphasis : undefined}
          selectionRef={selectionRef}
          onPatchSectionOrder={(order) =>
            setEdits({
              ...edits,
              sectionOrder: order,
            })
          }
          mediaKind={editorMedia?.kind}
          onSetEdits={setEdits}
          angleSources={angleSources}
          onBuildFromTranscript={openBuildFromTranscript}
          playheadSourceMs={playheadSourceMs}
          showSurrounding={showSurrounding}
          onShowSurroundingChange={(on) => {
            setShowSurrounding(on)
            try {
              localStorage.setItem('transovo.script.showSurrounding', on ? '1' : '0')
            } catch {
              /* private mode */
            }
          }}
          highlightWordIdx={fullVideo && fvHighlights.highlightsOn ? fvHighlights.highlightWordIdx : undefined}
          momentRows={fullVideo && fvHighlights.highlightsOn ? fvHighlights.momentRows : undefined}
          onSelectRange={
            fullVideo && fvHighlights.highlightsOn
              ? (startMs, endMs) => {
                  const mid = fvHighlights.picks.find((p) => p.startMs === startMs && p.endMs === endMs)
                  if (mid) fvHighlights.setSelectedClipId(mid.clipId)
                  seekSource(startMs)
                }
              : undefined
          }
        />
        </EditorPanelErrorBoundary>
      </div>
      <div className={panel === 'cleanup' ? undefined : 'hidden'} aria-hidden={panel !== 'cleanup'}>
        <EditorPanelErrorBoundary label="Cleanup">
          <CleanupPanel
            clipId={clipId}
            bounds={bounds}
            edits={edits}
            words={editorWords}
            gapSettings={gapToolSettings}
            aiExtras={aiExtras}
            videoUrl={videoUrl}
            peaksUrl={editorAssets?.peaksUrl ?? null}
            onApplyProposal={onApplyCleanupProposal}
            onApplyPass={onApplyCleanupPass}
            onRestoreProposal={onRestoreCleanupProposal}
            onCommitTrim={setTrim}
            onAuditionChange={setAuditionEdits}
            onSeek={seekSource}
          />
        </EditorPanelErrorBoundary>
      </div>
      <div className={panel === 'layout' ? 'p-3' : 'hidden'} aria-hidden={panel !== 'layout'}>
        <EditorPanelErrorBoundary label="Layout">
        <LayoutPanel
          edits={edits}
          shots={cropShots}
          onMode={onLayoutMode}
          onShotFocus={setShotOverride}
          onRerunReframe={() => void requestClipReframe(clipId)}
          onApplyBrand={() => void applyBrand()}
          onEdits={setEdits}
          reframeV2Enabled={reframeV2Enabled}
          appliedLayoutLabel={clipLayoutChip(aiMeta as ClipAiMeta | null)}
          clipId={clipId}
          words={editorWords}
          clipStartMs={bounds.clipStartMs}
          clipEndMs={bounds.clipEndMs}
          gapToolSettings={gapToolSettings}
          onGapToolSettingsChange={(patch) => setGapToolSettings((s) => ({ ...s, ...patch }))}
          onAddCut={applyCutRange}
          onSetCutRanges={setCutRanges}
          onSeekSource={seekSource}
          onOpenGapReview={() => setGapReviewOpen(true)}
          onOpenFillerReview={() => setFillerReviewOpen(true)}
          headlinePlatform={
            streamerSide?.platform === 'kick'
              ? 'kick'
              : streamerSide?.platform === 'twitch'
                ? 'twitch'
                : undefined
          }
          facecamLayout={facecamLayout}
          onOpenLayersTab={openLayersTab}
          videoUrl={videoUrl}
          peaksUrl={editorAssets?.peaksUrl ?? null}
          posterUrl={posterUrl}
          projectId={projectId}
          channelId={streamChannelId}
          clipType={(aiMeta as ClipAiMeta | null)?.clipType ?? null}
          mediaOffsetMs={mediaOffsetMs}
          aiMeta={aiMeta as Record<string, unknown> | null}
        />
        </EditorPanelErrorBoundary>
      </div>
      <div className={panel === 'layers' ? 'p-3' : 'hidden'} aria-hidden={panel !== 'layers'}>
        <EditorPanelErrorBoundary label="Layers">
          <LayoutQuickPicker
            value={edits.layout.mode}
            edits={edits}
            facecamLayout={facecamLayout}
            reframeV2Enabled={reframeV2Enabled}
            onPick={onLayoutPick}
            className="mb-4"
          />
          <LayersPanel
            clipId={clipId}
            edits={edits}
            layers={layers}
            setLayers={setLayers}
            onEdits={setEdits}
            clipType={(aiMeta as ClipAiMeta | null)?.clipType ?? null}
            platform={
              streamerSide?.platform === 'kick'
                ? 'kick'
                : streamerSide?.platform === 'twitch'
                  ? 'twitch'
                  : undefined
            }
            brandTemplates={brandTemplates}
            onApplyTemplate={applyBrandTemplateById}
            onApplyAutoTemplate={applyAutoBrandTemplate}
            onSaveTemplate={saveLayersBrandTemplate}
            onSyncEditsSaveVersion={syncEditsSaveVersion}
            savePending={saveState === 'saving'}
          />
          <div className="mt-4" data-testid="hook-overlay-section">
            <HookOverlayPanel
              clipId={clipId}
              edits={edits}
              defaultHook={(aiMeta as { hook?: string } | null)?.hook}
              onChange={(patch) => setEdits({ ...edits, ...patch })}
            />
          </div>
        </EditorPanelErrorBoundary>
      </div>
      <div className={panel === 'captions' ? undefined : 'hidden'} aria-hidden={panel !== 'captions'}>
        <EditorPanelErrorBoundary label="Captions">
        <CaptionsPanel
          clipId={clipId}
          edits={edits}
          words={editorWords}
          onWordFix={setWordFix}
          onResetWordFix={(i) => setWordFix(i, '')}
          onChange={setCaptions}
          onApplyBrand={() => void applyBrand()}
          onSaveClipTemplate={() => void saveClipTemplate()}
          outputMs={outputMs}
          onEdits={setEdits}
          onSeekOutput={seekOutput}
        />
        <CaptionLinesPanel
          edits={edits}
          words={editorWords}
          playheadMs={outputMs}
          durationMs={outDur}
          selectedId={selectedCaptionLineId}
          onSelect={setSelectedCaptionLineId}
          onEdits={(e) => setEdits(e)}
          onSeekOutput={seekOutput}
        />
        </EditorPanelErrorBoundary>
      </div>
      <div className={panel === 'audio' ? undefined : 'hidden'} aria-hidden={panel !== 'audio'}>
        <EditorPanelErrorBoundary label="Audio">
        <AudioPanel
          clipId={clipId}
          edits={edits}
          outputDurationMs={outDur}
          playheadMs={outputMs}
          playheadSourceMs={playheadSourceMs}
          uploadLibraryFiles={media.uploadFiles}
          onSuggestMusic={() => {}}
          onAttachMusic={attachMusicGeneration}
          onPatchMusic={patchMusic}
          onRemoveMusic={() => setMusic(null)}
          onAddSfx={(generationId, atMs) => addSfx({ generationId, atMs, volume: 0.8 })}
          onUpdateSfx={updateSfx}
          onRemoveSfx={removeSfx}
          onPatchStudioSound={patchStudioSound}
          onStartStudioSound={startStudioSoundPreview}
          studioSlow={studioSlow}
          onRetryStudioPoll={retryPoll}
          onPatchExportAudio={(patch) => {
            const next = { ...edits, ...patch }
            if ('speed' in patch && (patch.speed === null || patch.speed === undefined)) {
              delete next.speed
            }
            setEdits(next)
          }}
          textVoiceover={textVoiceoverTarget}
          addVoiceover={placeVoiceoverClip}
          onCutToBeat={(every) => beatCutApi?.cut(every)}
          beatsAvailable={Boolean(beatCutApi?.hasBeats)}
        />
        </EditorPanelErrorBoundary>
      </div>
      {panelMounted('broll') ? (
        <div className={panel === 'broll' ? undefined : 'hidden'} aria-hidden={panel !== 'broll'} data-testid="editor-panel-broll">
          <EditorPanelErrorBoundary label="B-roll">
          <BrollPanel
            clipId={clipId}
            edits={edits}
            outputDurationMs={outDur}
            playheadMs={outputMs}
            aiMeta={aiMeta}
            brollMedia={previewBrollMedia}
            onMergeBroll={mergeBroll}
            onSetBroll={setBroll}
            onRemoveBroll={removeBroll}
            onBrollMedia={mergeBrollMedia}
            onFlushEdits={() => void flushSave()}
            uploadSlot={
              <MediaLibraryGrid media={media} filter="visual" lanes={['broll']} onAdd={(item, lane) => onAddMedia(item, lane)} compact />
            }
          />
          </EditorPanelErrorBoundary>
        </div>
      ) : null}
      {panelMounted('brand') ? (
        <div className={panel === 'brand' ? 'p-3' : 'hidden'} aria-hidden={panel !== 'brand'} data-testid="editor-panel-brand">
          <EditorPanelErrorBoundary label="Brand">
          <BrandPanel edits={edits} onEdits={setEdits} />
          </EditorPanelErrorBoundary>
        </div>
      ) : null}
      {panelMounted('thumbnail') ? (
        <div className={panel === 'thumbnail' ? 'p-3' : 'hidden'} aria-hidden={panel !== 'thumbnail'} data-testid="editor-panel-thumbnail">
          <EditorPanelErrorBoundary label="Cover">
          <ThumbnailPanel clipId={clipId} edits={edits} onEdits={setEdits} />
          </EditorPanelErrorBoundary>
        </div>
      ) : null}
      {aiExtras && panelMounted('dub') ? (
        <div className={panel === 'dub' ? 'p-3' : 'hidden'} aria-hidden={panel !== 'dub'} data-testid="editor-panel-dub">
          <EditorPanelErrorBoundary label="Dub">
          <DubPanel
            clipId={clipId}
            durationMs={outDur}
            edits={edits}
            onEdits={setEdits}
            onRefresh={refreshDubs}
            dubs={dubs}
          />
          </EditorPanelErrorBoundary>
        </div>
      ) : null}
      {panelMounted('text') ? (
        <div className={panel === 'text' ? undefined : 'hidden'} aria-hidden={panel !== 'text'} data-testid="editor-panel-text">
          <EditorPanelErrorBoundary label="Text">
          <TextPanel
            edits={edits}
            onEdits={setEdits}
            playheadMs={outputMs}
            durationMs={outDur}
            selectedId={selectedTextId}
            onSelect={setSelectedTextId}
            onLive={(e) => setAuditionEdits(e ? applyTimelineLaneState(e) : null)}
            clipId={clipId}
            uploadLibraryFiles={media.uploadFiles}
            placeVoiceover={placeVoiceoverClip}
          />
          </EditorPanelErrorBoundary>
        </div>
      ) : null}
      {panelMounted('templates') ? (
        <div className={panel === 'templates' ? undefined : 'hidden'} aria-hidden={panel !== 'templates'} data-testid="editor-panel-templates">
          <EditorPanelErrorBoundary label="Templates">
          <TemplatesPanel
            edits={edits}
            onEdits={setEdits}
            playheadMs={outputMs}
            durationMs={outDur}
            brandTemplates={brandTemplates}
            onApplyBrand={applyBrandTemplateById}
            layoutSlot={
              t6TemplatesEnabled() ? (
                <TemplateLayoutPanel
                  edits={edits}
                  onEdits={setEdits}
                  aiMeta={aiMeta as Record<string, unknown> | null}
                  videoUrl={videoUrl}
                  posterUrl={posterUrl}
                />
              ) : (
                <LayoutQuickPicker
                  value={edits.layout.mode}
                  edits={edits}
                  facecamLayout={facecamLayout}
                  reframeV2Enabled={reframeV2Enabled}
                  onPick={onLayoutPick}
                />
              )
            }
          />
          </EditorPanelErrorBoundary>
        </div>
      ) : null}
      {panelMounted('inspector') ? (
        <div className={panel === 'inspector' ? undefined : 'hidden'} aria-hidden={panel !== 'inspector'} data-testid="editor-panel-inspector">
          <EditorPanelErrorBoundary label="Properties">
          <PropertiesPanel
            edits={edits}
            target={canvasSel?.target ?? null}
            label={canvasSel?.label ?? ''}
            outputMs={outputMs}
            onCommit={(next) => setEdits(next)}
            onSeekOutput={seekOutput}
            cropMode={cropMode}
            onCropModeChange={setCropMode}
            readOnly={Boolean(
              canvasSel &&
                edits.timelineLanes?.[
                  canvasSel.target === 'video'
                    ? 'video'
                    : canvasSel.target.startsWith('broll:')
                      ? 'broll'
                      : canvasSel.target === 'voice'
                        ? 'voice'
                        : canvasSel.target === 'music'
                          ? 'music'
                          : canvasSel.target.startsWith('sfx:')
                            ? 'sfx'
                            : canvasSel.target.startsWith('adjust:')
                              ? 'adjust'
                              : 'text'
                ]?.locked,
            )}
            onReplaceBroll={setReplaceBrollId}
            speedSlot={
              selVideoSeg ? (
                <ItemSpeedControl
                  edits={edits}
                  srcInMs={selVideoSeg.srcInMs}
                  srcOutMs={selVideoSeg.srcOutMs}
                  onCommit={(next) => setEdits(next)}
                  readOnly={Boolean(edits.timelineLanes?.video?.locked)}
                />
              ) : null
            }
            brollSceneSlot={(id) => {
              const b = (edits.broll ?? []).find((x) => x.id === id)
              const m = previewBrollMedia.find((x) => x.id === id)
              if (!b || !m?.url || m.mediaType === 'image' || ('still' in b && b.still)) return null
              const inMs = b.inMs ?? 0
              return (
                <MediaSceneSplit
                  edits={edits}
                  kind="broll"
                  id={id}
                  url={m.url}
                  inMs={inMs}
                  outMs={inMs + (b.endMs - b.startMs)}
                  onCommit={(next) => setEdits(next)}
                  readOnly={Boolean(edits.timelineLanes?.broll?.locked)}
                />
              )
            }}
            videoSlot={
              <>
                <MainVideoTools
                  edits={edits}
                  videoItem={selVideoSeg ? { srcInMs: selVideoSeg.srcInMs, srcOutMs: selVideoSeg.srcOutMs } : null}
                  outputMs={outputMs}
                  durationMs={outDur}
                  onCommit={(next) => setEdits(next)}
                  onSeekOutput={seekOutput}
                  readOnly={Boolean(edits.timelineLanes?.video?.locked)}
                />
                <CanvasBackgroundSection
                  edits={edits}
                  media={media}
                  projectId={projectId}
                  clipId={clipId}
                  compositeLocked={compositePreviewClip}
                  readOnly={Boolean(edits.timelineLanes?.video?.locked)}
                  onCommit={(next) => setEdits(next)}
                />
              </>
            }
            colorSlot={
              <ColorPanel
              edits={edits}
              target={colorTarget}
              onEdits={setEdits}
              onLive={(e) => setAuditionEdits(e ? applyTimelineLaneState(e) : null)}
              outputMs={outputMs}
              outputDurationMs={outDur}
              onSeekOutput={seekOutput}
              onTargetChange={setColorTarget}
            />
            }
          />
          </EditorPanelErrorBoundary>
        </div>
      ) : null}
      {panelMounted('color') ? (
        <div className={panel === 'color' ? undefined : 'hidden'} aria-hidden={panel !== 'color'} data-testid="editor-panel-color">
          <EditorPanelErrorBoundary label="Color">
          <ColorPanel
              edits={edits}
              target={colorTarget}
              onEdits={setEdits}
              onLive={(e) => setAuditionEdits(e ? applyTimelineLaneState(e) : null)}
              outputMs={outputMs}
              outputDurationMs={outDur}
              onSeekOutput={seekOutput}
              onTargetChange={setColorTarget}
            />
          </EditorPanelErrorBoundary>
        </div>
      ) : null}
      {panelMounted('repurpose') ? (
        <div className={panel === 'repurpose' ? undefined : 'hidden'} aria-hidden={panel !== 'repurpose'}>
          <EditorPanelErrorBoundary label="Repurpose">
            <RepurposePanel clipId={clipId} edits={edits} aiMeta={aiMeta} onCommitEdits={setEdits} />
          </EditorPanelErrorBoundary>
        </div>
      ) : null}
      {panelMounted('media') ? (
        <div className={panel === 'media' ? undefined : 'hidden'} aria-hidden={panel !== 'media'} data-testid="editor-panel-media">
          <EditorPanelErrorBoundary label="Media">
          <MediaPanel
            projectId={projectId}
            media={media}
            edits={edits}
            words={editorWords}
            shots={cropShots}
            selectedVideo={selectedVideo}
            selectedSegmentId={selectedSourceSegmentId}
            onSelectSegment={setSelectedSourceSegmentId}
            onAdd={(item, lane) => onAddMedia(item, lane)}
            onReplaceSelected={onReplaceSelected}
            onEdits={setEdits}
            playheadSourceMs={playheadSourceMs}
            onSeekSource={seekSource}
            monitorRequest={monitorRequest}
            timebase={timelineTb}
            playheadOutMs={outputMs}
            playheadOutMsRef={outputMsRef}
          />
          </EditorPanelErrorBoundary>
        </div>
      ) : null}
    </>
  )

  return (
    <div
      className={cn(
        'flex h-[calc(100dvh-3.5rem)] max-w-[100vw] flex-col overflow-x-hidden bg-background',
        clipEditorAnton.variable,
        clipEditorMontserrat.variable,
        clipEditorPoppins.variable,
        clipDisplayFontVars,
      )}
    >
      <EditorTopBar
          backHref={`/app/clips/${projectId}`}
          title={title}
          onTitleChange={setTitle}
          saveState={saveState}
          optimisticPending={saveState === 'dirty'}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          historySlot={historyPanel}
          onExport={() => setExportOpen(true)}
          layoutSlot={<OpenInFullVideoButton clipId={clipId} />}
          onRetrySave={() => {
            void flushSave()
          }}
          onOpenProducer={() => setProducerOpen((o) => !o)}
          producerOpen={producerOpen}
          producerStrip={producerStrip ? { changeCount: producerStrip.changeCount, onUndo: undo } : null}
          pendingPaidCount={producerPendingPaid}
          layoutSlot={
            <EditorLayoutMenu>
              <LayoutQuickPicker
                value={edits.layout.mode}
                edits={edits}
                facecamLayout={facecamLayout}
                reframeV2Enabled={reframeV2Enabled}
                onPick={onLayoutPick}
              />
            </EditorLayoutMenu>
          }
          versionsSlot={
            <>
            {fullVideo ? (
              <FindClipsInVideoButton projectId={projectId} durationMs={bounds.clipEndMs - bounds.clipStartMs} />
            ) : null}
            {fullVideo && fvHighlights.hasPicks ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant={fvHighlights.highlightsOn ? 'default' : 'outline'}
                  data-testid="editor-highlights-toggle"
                  onClick={() => fvHighlights.persistToggle(!fvHighlights.highlightsOn)}
                >
                  Highlights
                </Button>
                {fvHighlights.highlightsOn ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    data-testid="highlight-make-all"
                    onClick={() => void fvHighlights.onMakeAll()}
                  >
                    Make all
                  </Button>
                ) : null}
              </>
            ) : null}
            <EditorVersionsMenu
              enabled={versionsEnabled}
              versions={editVersions}
              onSaveVersion={(name) => void saveEditVersion(name)}
              onRestoreVersion={(id) => void restoreEditVersion(id)}
              onDeleteVersion={(id) => void deleteEditVersion(id)}
              onRestoreOriginal={() => void restoreOriginalEdits()}
            />
            </>
          }
        />
      <EditorPanelErrorBoundary label="AI Producer">
        <ProducerPopover
          open={producerOpen}
          onClose={() => setProducerOpen(false)}
          clipId={clipId}
          bounds={bounds}
          edits={edits}
          durationMs={outDur}
          onAudition={setAuditionEdits}
          onAccept={(next, before, n) => applyProducerPatch(next, before, n)}
          onUndo={undo}
          onPendingPaidChange={setProducerPendingPaid}
        />
      </EditorPanelErrorBoundary>
      <ClipFillerReview
        clipId={clipId}
        words={editorWords}
        edits={edits}
        clipBounds={{ clipStartMs: bounds.clipStartMs, clipEndMs: bounds.clipEndMs }}
        open={fillerReviewOpen}
        onOpenChange={setFillerReviewOpen}
        onApplyProposal={onApplyCleanupProposal}
        onSeek={seekSource}
      />
      <ClipGapReview
        clipId={clipId}
        words={editorWords}
        edits={edits}
        clipBounds={{ clipStartMs: bounds.clipStartMs, clipEndMs: bounds.clipEndMs }}
        open={gapReviewOpen}
        onOpenChange={setGapReviewOpen}
        onApplyProposal={onApplyCleanupProposal}
        onSeek={seekSource}
        minGapSec={gapToolSettings.minGapSec}
        maxGapSec={gapToolSettings.maxGapSec}
        gapMode={gapToolSettings.mode}
        targetGapSec={gapToolSettings.targetGapSec}
        onTargetGapSecChange={(n) => setGapToolSettings((s) => ({ ...s, targetGapSec: n }))}
      />
      <EditorMobileRail active={panel} onChange={selectPanel} />
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_56px_minmax(0,380px)] xl:grid-cols-[minmax(0,1fr)_56px_minmax(0,420px)]">
        <section className="flex min-h-0 min-w-0 max-w-full flex-col gap-3 overflow-x-hidden overflow-y-auto p-2 sm:p-3 md:p-4">
          <div className="relative grid min-h-0 flex-1 place-items-center bg-[radial-gradient(ellipse_at_center,oklch(0.22_0.02_280)_0%,var(--background)_70%)] p-2 md:p-4">
            <div
              ref={previewFrameRef}
              className="relative h-full max-h-full w-auto max-w-full overflow-hidden rounded-xl shadow-lg ring-1 ring-white/10"
              style={{ aspectRatio: aspectStyle }}
            >
            {(edits.layout.shotOverrides?.length ?? 0) > 0 ? (
              <span
                className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white ring-1 ring-white/15"
                aria-hidden
              >
                Manual framing
              </span>
            ) : edits.layout.mode === 'auto' || edits.layout.mode === 'dynamic' ? (
              <span
                className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white ring-1 ring-white/15"
                aria-hidden
              >
                AI reframing
              </span>
            ) : null}
            {pendingDerivedClipId ? (
              <Badge className="absolute right-2 top-2 z-10" variant="secondary">
                {pendingDerivedClipId === 'pending' ? 'Creating clip…' : 'New clip saved'}
              </Badge>
            ) : null}
            <PreviewChipRow>
              <button type="button" className={previewChipButtonClass()} onClick={toggleLoopFriendly}>
                {previewFrameW < 320
                  ? `Loop ${edits.loopFriendlyEnd === false ? 'off' : 'on'}`
                  : `Loop trim ${edits.loopFriendlyEnd === false ? 'off' : 'on'}`}
              </button>
              <button
                type="button"
                className={previewChipButtonClass()}
                onClick={() => {
                  const box = previewFrameRef.current
                  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
                  else void box?.requestFullscreen?.().catch(() => {})
                }}
                title="Full-screen preview (Esc to leave)"
                aria-label="Full screen"
                data-testid="preview-fullscreen"
              >
                {previewFrameW < 320 ? '⛶' : '⛶ Full screen'}
              </button>
              <Select
                value={previewQuality}
                onValueChange={(v) => {
                  if (v === 'auto' || v === 'full' || v === 'half') {
                    setPreviewQuality(v)
                    writePreviewQuality(v)
                  }
                }}
              >
                <SelectTrigger
                  className={cn(previewChipButtonClass(), 'h-auto gap-1 border-0 px-2 py-1 shadow-none')}
                  data-testid="preview-quality"
                  title="Preview only — export is unaffected"
                >
                  <SelectValue>
                    {previewFrameW < 320
                      ? previewQuality === 'half'
                        ? '½'
                        : 'HD'
                      : `Quality: ${previewQuality === 'auto' ? 'Auto' : previewQuality === 'full' ? 'Full' : 'Half'}`}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto" data-testid="preview-quality-auto">
                    Auto
                  </SelectItem>
                  <SelectItem value="full" data-testid="preview-quality-full">
                    Full
                  </SelectItem>
                  <SelectItem value="half" data-testid="preview-quality-half">
                    Half
                  </SelectItem>
                </SelectContent>
              </Select>
              <button
                type="button"
                className={previewChipButtonClass()}
                data-testid="preview-zoom-out"
                title="Zoom out"
                onClick={() => setPreviewZoom((z) => nextZoom(z, -1, fitPct))}
              >
                −
              </button>
              {previewFrameW >= 320 ? (
                <div className="relative">
                  <button
                    type="button"
                    className={previewChipButtonClass()}
                    data-testid="preview-zoom-label"
                    onClick={() => setZoomMenuOpen((o) => !o)}
                  >
                    {previewZoom === 'fit' ? `Fit · ${fitPct}%` : `${previewZoom}%`}
                  </button>
                  {zoomMenuOpen ? (
                    <div className="absolute bottom-full left-0 z-[60] mb-1 flex flex-col rounded-md border border-border bg-popover p-1 shadow-md">
                      <button
                        type="button"
                        className="rounded px-2 py-1 text-left text-xs hover:bg-muted"
                        data-testid="preview-zoom-fit"
                        onClick={() => {
                          setPreviewZoom('fit')
                          setPreviewPan({ x: 0, y: 0 })
                          setZoomMenuOpen(false)
                        }}
                      >
                        Fit
                      </button>
                      {[25, 50, 75, 100, 150, 200].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className="rounded px-2 py-1 text-left text-xs hover:bg-muted"
                          data-testid={`preview-zoom-${n}`}
                          onClick={() => {
                            setPreviewZoom(n as PreviewZoom)
                            setZoomMenuOpen(false)
                          }}
                        >
                          {n}%
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                className={previewChipButtonClass()}
                data-testid="preview-zoom-in"
                title="Zoom in"
                onClick={() => setPreviewZoom((z) => nextZoom(z, 1, fitPct))}
              >
                +
              </button>
              <CanvasBackgroundChip
                edits={edits}
                media={media}
                projectId={projectId}
                clipId={clipId}
                visible={canvasBgChipVisible}
                compositeLocked={compositePreviewClip}
                readOnly={Boolean(edits.timelineLanes?.video?.locked)}
                onCommit={(next) => setEdits(next)}
                narrow={previewFrameW < 320}
              />
            </PreviewChipRow>
            <EditorPanelErrorBoundary label="Preview">
            <PreviewStage
              videoUrl={videoUrl}
              posterUrl={posterUrl}
              edits={renderEdits}
              canvasBgImageUrl={
                edits.canvasBg?.type === 'image' && edits.canvasBg.imageId
                  ? uploadUrlFor(edits.canvasBg.imageId)
                  : null
              }
              mainVideoSize={mainVideoSize}
              previewQuality={previewQuality}
              previewZoom={previewZoom}
              previewPan={previewPan}
              onPreviewPanChange={setPreviewPan}
              onPreviewZoomChange={setPreviewZoom}
              onFitPercent={setFitPct}
              words={editorWords}
              previewWords={previewWords}
              brandLogoUrl={brandLogoUrl}
              cropTrack={cropTrack}
              brollMedia={previewBrollMedia}
              sourceUrls={sourceUrls}
              videoRef={videoRef}
              onTick={onTick}
              channelDisplay={streamChannelDisplay}
              chatPreviewEnabled={streamChatAvailable}
              media={editorMedia}
              audition={auditionEdits ? { edits: auditionEdits } : null}
              safeZoneVisible={safeZoneVisible}
              onStickerMove={onStickerMove}
              onPipCornerChange={
                edits.layout.mode === 'facecam_pip' && edits.layout.facecam?.box ? onPipCornerChange : undefined
              }
              aiMeta={aiMeta as Record<string, unknown> | null}
              selectedTextId={panel === 'text' ? selectedTextId : null}
              canvas={{
                baseEdits: edits,
                selected: canvasSel?.target ?? null,
                onSelect: onCanvasSelect,
                onCommit: onCanvasCommit,
                cropMode,
                onCropModeChange: setCropMode,
              }}
            />
            {studioPreviewLoading ? (
              <div
                className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/45"
                role="status"
                aria-live="polite"
              >
                <span className="flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  Studio Sound preview…
                </span>
              </div>
            ) : null}
            <StudioSoundPreview
              videoRef={videoRef}
              isolatedUrl={studioGen.downloadUrl}
              mix={studioSound?.mix ?? 0.35}
              enabled={studioPreviewActive}
            />
            </EditorPanelErrorBoundary>
            </div>
          </div>
          {pickerWhy || detectedLayout || clipTypeLabel ? (
            <div className="max-w-xl space-y-1 px-1">
              {clipTypeLabel ? (
                <p className="text-[10px] text-muted-foreground">
                  <span className="font-medium text-foreground">Clip type:</span> {clipTypeLabel}
                </p>
              ) : null}
              {detectedLayout ? (
                <p className="text-[10px] text-muted-foreground">
                  <span className="font-medium text-foreground">Detected layout:</span> {detectedLayout}
                </p>
              ) : null}
              {pickerWhy ? (
                <p className="line-clamp-2 text-xs text-muted-foreground" title={pickerWhy}>{pickerWhy}</p>
              ) : null}
            </div>
          ) : null}
          <div className="min-w-0 w-full space-y-2">
          <Timeline
            angleSources={angleSources}
            edits={edits}
            words={editorWords}
            shots={cropShots}
            outputMs={outputMs}
            clipOutputDurationMs={outDur}
            videoUrl={videoUrl}
            editorAssets={editorAssets}
            brollMedia={previewBrollMedia}
            sourceUrls={sourceUrls}
            posterUrl={posterUrl}
            onSeekOutput={seekOutput}
            onTrimChange={setTrim}
            clipStartMs={bounds.clipStartMs}
            clipEndMs={bounds.clipEndMs}
            mediaMinMs={editorMedia?.minMs}
            mediaMaxMs={editorMedia?.maxMs}
            trimMinMs={bounds.trimMinMs}
            trimMaxMs={bounds.trimMaxMs}
            onSplitLayout={() => splitLayoutAtSource(playheadSourceMs)}
            onCutSection={() => cutSectionAtSource(playheadSourceMs)}
            onSetLayoutMode={(mode) => {
              logEditorDecision('layout', { clipId, mode, reason: 'timeline_segment' })
              setLayoutModeAtSource(playheadSourceMs, mode)
            }}
            onBrollChange={(id, patch) => updateBrollItem(id, patch)}
            onCommitEdits={setEdits}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            historySlot={historyPanel}
            mediaOffsetMs={mediaOffsetMs}
            musicUrl={musicUrl}
            sfxDurationsMs={sfxPreview.durationsMs}
            sfxPeaks={sfxPreview.peaks}
            sfxBeatsMs={sfxPreview.beatsMs}
            sfxBpm={sfxPreview.bpm}
            onOpenCover={() => selectPanel('thumbnail')}
            onSelectionChange={onTimelineSelection}
            onDropMedia={onDropMedia}
            onSelectSourceSegment={onSelectSourceSegment}
            selectedSourceSegmentId={selectedSourceSegmentId}
            selectRequest={timelineSelReq}
            onMatchFrame={matchFrame}
            onOpenExport={() => setExportOpen(true)}
            onReplaceBrollMedia={setReplaceBrollId}
            inOut={exportTimelineInOut}
            onInOutChange={setExportTimelineInOut}
            onArmVoiceover={() => clipRec.arm('voiceover')}
            onOpenTextVoiceover={(id) => {
              setSelectedTextId(id)
              selectPanel('text')
            }}
            playheadOutMsRef={outputMsRef}
            transcriptSelectionRef={selectionRef}
            registerBeatCut={registerBeatCut}
            highlights={
              fullVideo && fvHighlights.highlightsOn && fvHighlights.ranges.length
                ? {
                    picks: fvHighlights.picks,
                    ranges: fvHighlights.ranges,
                    selectedClipId: fvHighlights.selectedClipId,
                    durationMs: bounds.clipEndMs - bounds.clipStartMs,
                    onSelect: (id) => fvHighlights.setSelectedClipId(id),
                    onRangeChange: fvHighlights.onRangeChange,
                    onMakeClip: (pick, range) => void fvHighlights.onMakeClip(pick, range),
                    onOpenCard: fvHighlights.onOpenCard,
                  }
                : undefined
            }
          />
          {clipRec.armed ? (
            <ClipRecorderBar
              mode={clipRec.mode}
              recording={clipRec.recording}
              countdown={clipRec.countdown}
              recSeconds={clipRec.recSeconds}
              cameras={clipRec.cameras}
              mics={clipRec.mics}
              cameraId={clipRec.cameraId}
              micId={clipRec.micId}
              onCameraId={clipRec.setCameraId}
              onMicId={clipRec.setMicId}
              countdownEnabled={clipRec.countdownEnabled}
              onCountdownEnabled={clipRec.setCountdownEnabled}
              mutePreview={clipRec.mutePreview}
              onMutePreview={clipRec.setMutePreview}
              placeMode={clipRec.placeMode}
              onPlaceMode={clipRec.setPlaceMode}
              bubbleOn={clipRec.bubbleOn}
              onBubbleOn={clipRec.setBubbleOn}
              bubbleCorner={clipRec.bubbleCorner}
              onBubbleCorner={clipRec.setBubbleCorner}
              bubbleSize={clipRec.bubbleSize}
              onBubbleSize={clipRec.setBubbleSize}
              analysers={clipRec.analysers}
              previewStream={clipRec.previewStream}
              teleprompterOpen={teleprompterOpen}
              onTeleprompterOpen={setTeleprompterOpen}
              scriptText={teleprompterScript}
              onScriptText={saveTeleprompterScript}
              onUseTranscript={() =>
                saveTeleprompterScript(editorWords.map((w) => w.word).join(' '))
              }
              teleprompterPlaying={clipRec.teleprompterPlaying}
              onDisarm={clipRec.disarm}
              onStart={() => void beginClipRecording()}
              onStop={() => void clipRec.stopRecording()}
              onCancel={() => void clipRec.cancelRecording()}
            />
          ) : (
          <PlayerControls
            playing={playing}
            outputMs={transportClockMs}
            outputDurationMs={displayDur}
            onToggle={() => void togglePlay()}
            onScrub={seekDisplay}
            showScrubber={false}
            muted={playerMuted}
            volume={playerVolume}
            meterOn={meterOn}
            onMeterToggle={() => setMeterOn((v) => !v)}
            meterSlot={
              meterOn ? <AudioMeter levels={peakLevels} voiceMetered={audioMeter.voiceMetered} /> : null
            }
            leadingSlot={
              recordDevicesOk ? (
                <ClipRecordMenu
                  onPick={(m) => {
                    clipRec.arm(m)
                    if (m === 'voiceover') selectPanel('media')
                  }}
                />
              ) : (
                <ClipRecordMenu disabled disabledReason="Recording needs a secure origin and microphone access" onPick={() => undefined} />
              )
            }
            onMuteToggle={() => {
              const v = videoRef.current
              if (!v) return
              const next = !playerMuted
              setPlayerMuted(next)
              v.muted = next
              if (!next) {
                v.volume = playerVolume / 100
                void playWithSound(v)
              }
            }}
            onVolumeChange={(pct) => {
              setPlayerVolume(pct)
              const v = videoRef.current
              if (v) {
                v.volume = pct / 100
                if (pct > 0) {
                  v.muted = false
                  setPlayerMuted(false)
                }
              }
            }}
          />
          )}
          </div>
        </section>
        <EditorRail active={panel} onChange={selectPanel} />
        <aside
          className={cn(
            'flex min-h-0 flex-col border-border bg-card',
            'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-50 max-md:max-h-[85dvh] max-md:rounded-t-xl max-md:border-t max-md:shadow-2xl',
            !mobilePanelOpen && 'max-md:hidden',
            'md:relative md:border-l md:max-h-none',
          )}
        >
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
            <TabIcon className="size-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-semibold">{meta.label}</h2>
            <span className="ml-auto text-xs text-muted-foreground">{meta.hint}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="md:hidden"
              onClick={() => setMobilePanelOpen(false)}
            >
              Close
            </Button>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4">{panelBody}</div>
          </ScrollArea>
        </aside>
      </div>
      <Button
        type="button"
        size="icon"
        className="fixed bottom-4 right-4 z-40 size-12 rounded-full shadow-lg md:hidden"
        aria-label="Open editor panel"
        onClick={() => setMobilePanelOpen(true)}
      >
        <PanelRightOpen className="size-5" />
      </Button>
      <ClipperSurfaceErrorBoundary surface="Export">
        <ExportDialog
        clipId={clipId}
        title={title}
        edits={edits}
        fullVideo={fullVideo}
        dubs={dubs}
        layoutMode={edits.layout.mode}
        onLayoutModeChange={(mode, facecam) => onLayoutMode(mode, facecam, { reason: 'export' })}
        facecamLayout={facecamLayout}
        reframeV2Enabled={reframeV2Enabled}
        exportSurfaceClassName={cn(
          clipEditorAnton.variable,
          clipEditorMontserrat.variable,
          clipEditorPoppins.variable,
          clipDisplayFontVars,
        )}
        platform={
          (aiMeta as { streamer?: { platform?: string } } | null)?.streamer?.platform === 'kick'
            ? 'kick'
            : (aiMeta as { streamer?: { platform?: string } } | null)?.streamer?.platform === 'twitch'
              ? 'twitch'
              : undefined
        }
        defaultChannelUrl={
          (() => {
            const s = streamerSide
            const login = s?.login || s?.meta?.channel
            const platform = s?.platform || s?.meta?.platform
            if (!login || !platform) return undefined
            return platform === 'kick' ? `https://kick.com/${login}` : `https://twitch.tv/${login}`
          })()
        }
        chatAvailable={streamChatAvailable}
        chatToggleHint={streamChatToggleHint}
        onAudioTrack={(track) => setEdits({ ...edits, audioTrack: track })}
        open={exportOpen}
        onAspectChange={(aspect) => setEdits({ ...edits, aspectRatio: aspect })}
        onBeforeExport={() => flushSave()}
        words={editorWords}
        onEdits={setEdits}
        onOpenLayersTab={() => {
          setExportOpen(false)
          openLayersTab()
        }}
        onSilenceTrimChange={(enabled) =>
          setEdits({
            ...edits,
            silenceTrim: {
              ...edits.silenceTrim,
              enabled,
              minGapMs: edits.silenceTrim?.minGapMs ?? 350,
              keepMs: edits.silenceTrim?.keepMs ?? 120,
            },
          })
        }
        onClose={() => setExportOpen(false)}
        timelineInOut={exportTimelineInOut}
        playheadMs={outputMs}
      />
      </ClipperSurfaceErrorBoundary>
      <Dialog open={!!replaceBrollId} onOpenChange={(o) => !o && setReplaceBrollId(null)}>
        <DialogContent className="max-w-2xl" data-testid="replace-media-dialog">
          <DialogHeader>
            <DialogTitle>Replace media</DialogTitle>
          </DialogHeader>
          <MediaLibraryGrid
            media={replaceMediaApi}
            filter="visual"
            lanes={['broll']}
            onAdd={(item, lane) => {
              if (lane === 'broll') onReplaceBrollMedia(item)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
