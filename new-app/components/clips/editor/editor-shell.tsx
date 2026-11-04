'use client'

import { Anton, Montserrat, Poppins } from 'next/font/google'
import { addFontVarsToBody, clipDisplayFontVars } from '@/components/clips/editor/clip-editor-fonts'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { getPreviewRate, subscribePreviewRate } from '@/lib/clips/editor/preview-rate'
import { EditorRail, clipEditorRailIds, editorRailIcon, type EditorPanelId } from '@/components/clips/editor/editor-rail'
import {
  clipEditorLeftPanelIds,
  editorRailGroups,
  panelToRailGroup,
  readRailGroupTab,
  writeRailGroupTab,
  type EditorRailGroupId,
} from '@/lib/clips/editor/editor-rail-navigation'
import { useEditorPanelWidth } from '@/lib/clips/editor/use-editor-panel-width'
import { PropertiesProjectSettings } from '@/components/clips/editor/properties-project-settings'
import {
  readClipEditorLayoutView,
  writeClipEditorLayoutView,
  type ClipEditorLayoutView,
} from '@/lib/clips/editor/editor-layout-view'
import { EditorLayoutViewSwitch, ScriptViewWaveStrip } from '@/components/clips/editor/script-view-chrome'
import { ScriptViewMainSplit } from '@/components/clips/editor/script-view-main-split'
import { ScriptViewCompactTimeline } from '@/components/clips/editor/script-view-compact-timeline'
import { useScriptViewSplit } from '@/lib/clips/editor/use-script-view-split'
import { useAudioPeaks } from '@/components/clips/editor/use-audio-peaks'
import { setCutAudioSamples } from '@/lib/clips/editor/audio-cut-edges'
import { rmsSamplesFromPeaks, type GapRmsSample } from '@/lib/clips/gap-audio-trim'
import { loadFineEnvelope } from '@/lib/clips/editor/fine-audio-envelope'
import { EditorMobileRail } from '@/components/clips/editor/editor-mobile-rail'
import { EditorLayout, useEditorBand, aspectCssToNumber } from '@/components/clips/editor/editor-layout'
import { CanvasLayoutMenu } from '@/components/clips/editor/canvas-layout-menu'
import { TAB_META } from '@/components/clips/editor/editor-tab-meta'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Maximize2, PanelRightOpen, SlidersHorizontal } from 'lucide-react'
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
import { sourceMsToEditorMs } from '@/lib/clips/editor/source-ms-to-editor'
import { transcriptCutForSelection } from '@/lib/clips/editor/transcript-cut-map'
import { playWithSound } from '@/lib/clips/video-playback'
import { EditorTopBar } from '@/components/clips/editor/editor-top-bar'
import { EditorMenuBar, type EditorMenu } from '@/components/clips/editor/editor-menu-bar'
import { EditorHistoryPanel } from '@/components/clips/editor/history-panel'
import { CaptionsPanel } from '@/components/clips/editor/captions-panel'
import { CaptionLinesPanel } from '@/components/clips/editor/caption-lines-panel'
import { ExportDialog } from '@/components/clips/editor/export-dialog'
import { RepurposePanel } from '@/components/clips/editor/repurpose-panel'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FindClipsInVideoButton } from '@/components/clips/editor/find-clips-in-video-button'
import { HighlightsListPanel } from '@/components/clips/editor/highlights-list-panel'
import { ClipperSurfaceErrorBoundary } from '@/components/clips/clipper-surface-error-boundary'
import { LayoutPanel } from '@/components/clips/editor/layout-panel'
import { clipLayoutChip, clipTypeBadge, clipWhySummary, type ClipAiMeta } from '@/lib/clips/clip-results-chips'
import { PlayerControls } from '@/components/clips/editor/player-controls'
import { Timeline, type TimelineMenuCommand } from '@/components/clips/editor/timeline'
import { TextPanel } from '@/components/clips/editor/text-panel'
import { TemplatesPanel } from '@/components/clips/editor/templates-panel'
import { ColorPanel, type ColorTarget } from '@/components/clips/editor/color-panel'
import { EffectsBrowser } from '@/components/clips/editor/effects-browser'
import { ProducerPopover } from '@/components/clips/editor/producer-popover'
import { applyProducerPlanStep } from '@/lib/clips/editor/producer-plan'
import type { ClipWord } from '@/lib/clips/edits'
import type { ProducerToolCall } from '@/lib/clips/edits-reducer'
import { TemplateLayoutPanel } from '@/components/clips/editor/template-layout-panel'
import { t6CaptionPresetsEnabled, t6TemplatesEnabled } from '@/lib/clips/t6-feature-flags'
import {
  applyCatalogToken,
  applyLayoutPackPayload,
  fetchLayoutPackPayload,
  parseApplyToken,
} from '@/lib/clips/templates/apply-from-hub'
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
import { singleCleanupApplyLabel } from '@/lib/clips/editor/history-labels'
import { toggleMarkerAt } from '@/lib/clips/editor/markers'
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
import { EditorVersionsMenu, type EditVersionRow } from '@/components/clips/editor/editor-versions-menu'
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
import { EXPORT_LAYOUT_OPTIONS, layoutOptionDisabled, layoutPickPayload } from '@/lib/clips/layout-options'
import type { StickerLayer } from '@/lib/clips/layers'
import type { VocabEntry } from '@/lib/clips/clip-export-user-types'
import {
  shouldApplyVocabulary,
  vocabularyBatchFixes,
  vocabularyFingerprint,
} from '@/lib/clips/editor/vocab-apply'
import { toast } from 'sonner'
import { EditorPanelErrorBoundary } from '@/components/clips/editor/editor-panel-error-boundary'
import { MulticamAngleGrid } from '@/components/clips/editor/multicam-angle-grid'
import { switchAngleAt, multicamAngles } from '@/lib/clips/editor/multicam-manual'
import { sideBySideAfterAngleSwitch } from '@/components/clips/editor/multicam-segment-layout-controls'
import { useFullVideoHighlights } from '@/components/clips/editor/use-full-video-highlights'
import { useFullVideoMomentFocus } from '@/components/clips/editor/full-video-moment-focus'
import { snapTranscriptSelectionMs } from '@/lib/clips/editor/make-clip-from-transcript'
import { filterAutoBrollSuggestions } from '@/lib/clips/editor/broll-approve-first'
import type { BeatCutRegisterApi } from '@/lib/clips/editor/beat-autocut'
import { isPendingStockAssetId, pendingStockProviderId } from '@/lib/clips/broll-auto-utils'
import type { BrollItem } from '@/lib/clips/broll'
import { MediaLibraryGrid, MediaPanel } from '@/components/clips/editor/media-panel'
import type { ProjectMediaApi } from '@/components/clips/editor/use-project-media'
import type { MonitorRequest } from '@/components/clips/editor/source-monitor'
import { buildFromTranscriptItem, matchFrameAt } from '@/lib/clips/editor/source-monitor'
import { mediaUrlFor, useMediaTranscripts, useProjectMedia } from '@/components/clips/editor/use-project-media'
import { CanvasBackgroundChip, CanvasBackgroundSection } from '@/components/clips/editor/canvas-background'
import { PreviewChipRow, previewChipButtonClass } from '@/components/clips/editor/preview-chip-row'
import { PreviewTransportStrip } from '@/components/clips/editor/preview-transport-strip'
import { EditorProjectMenu } from '@/components/clips/editor/editor-project-menu'
import {
  ScriptViewToolTabs,
  EditorInspectorToolRail,
  SCRIPT_VIEW_TOOL_PANELS,
  type ScriptViewToolPanelId,
} from '@/components/clips/editor/script-view-tool-rail'
import { TimelineShortcutsSheet } from '@/components/clips/editor/timeline/shortcuts-sheet'
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
import { SHOW_SURROUNDING_CONTEXT_MS, editorWindowMs } from '@/lib/clips/trim-bounds'
import { readTimelineOpen, readTimelineDockPanelOpen, writeTimelineDockPanelOpen, writeTimelineOpen } from '@/lib/clips/editor/compact-editor'
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
  onEditorMediaError,
  compact = false,
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
  /** STREAMER_editor_fix1: fall back to segment / preview when primary media 404s. */
  onEditorMediaError?: () => void
  /** FIX2 R7: compact (Opus-style) clip editor: no Properties column, the timeline is collapsible (closed by default). */
  compact?: boolean
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
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false)
  const [beatCutApi, setBeatCutApi] = useState<BeatCutRegisterApi | null>(null)
  const registerBeatCut = useCallback((api: BeatCutRegisterApi | null) => {
    setBeatCutApi(api)
  }, [])
  const [exportTimelineInOut, setExportTimelineInOut] = useState<import('@/lib/clips/editor/timeline-edit-ops').InOut>({
    inMs: null,
    outMs: null,
  })
  const [replaceBrollId, setReplaceBrollId] = useState<string | null>(null)
  const [fillerReviewOpen, setFillerReviewOpen] = useState(false)
  const [videoToolRequest, setVideoToolRequest] = useState<{ id: 'blur-add' | 'bg-removal' | 'properties-panel'; seq: number } | null>(null)
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
  const pendingApplyDone = useRef(false)
  const [panel, setPanel] = useState<EditorPanelId>('transcript')
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const band = useEditorBand()
  const unifiedWorkspaceActive = band !== 'mobile'
  // FIX2 R7: read localStorage after mount (no SSR/hydration mismatch)
  const [timelineOpen, setTimelineOpen] = useState(false)
  useEffect(() => {
    if (compact) {
      const store = typeof window === 'undefined' ? null : window.localStorage
      setTimelineOpen(unifiedWorkspaceActive ? store?.getItem('clipEditor.timelineOpen') !== '0' : readTimelineOpen(store))
    }
  }, [compact, unifiedWorkspaceActive])
  const toggleTimeline = useCallback(() => {
    setTimelineOpen((o) => {
      const next = !o
      writeTimelineOpen(typeof window === 'undefined' ? null : window.localStorage, next)
      return next
    })
  }, [])
  const timelineVisible = !compact || timelineOpen
  const { widthPx: panelWidthPx, persist: persistPanelWidth } = useEditorPanelWidth()
  const [layoutView, setLayoutView] = useState<ClipEditorLayoutView>('timeline')
  const [timelineCollapsed, setTimelineCollapsed] = useState(false)
  const [timelineFocused, setTimelineFocused] = useState(false)
  const [scriptToolPanel, setScriptToolPanel] = useState<ScriptViewToolPanelId | null>(null)
  // TIMELINE_LAYOUT1: Timeline view (lg+) uses the Script-view layout: rail + docked panel on the right.
  const [dockPanelOpen, setDockPanelOpen] = useState(false)
  const dockTools = layoutView === 'timeline' && band !== 'mobile'
  const setDockPanelOpenPersist = useCallback(
    (open: boolean) => {
      setDockPanelOpen(open)
      if (layoutView === 'timeline' && band !== 'mobile') {
        writeTimelineDockPanelOpen(typeof window === 'undefined' ? null : window.localStorage, open)
      }
    },
    [band, layoutView],
  )
  const [editorShortcutsOpen, setEditorShortcutsOpen] = useState(false)
  /** MENUBAR1: last top-menu command for the Timeline (seq bumps on every click). */
  const [timelineMenuCmd, setTimelineMenuCmd] = useState<{ cmd: TimelineMenuCommand; seq: number } | null>(null)
  useEffect(() => {
    setLayoutView(readClipEditorLayoutView())
  }, [])
  useEffect(() => {
    if (unifiedWorkspaceActive || layoutView !== 'timeline' || band === 'mobile') return
    const storage = typeof window === 'undefined' ? null : window.localStorage
    const open = readTimelineDockPanelOpen(storage)
    setDockPanelOpen(open)
    if (open) setPanel((p) => (p === 'inspector' ? 'media' : p))
  }, [layoutView, band, unifiedWorkspaceActive])
  const setLayoutViewPersist = useCallback(
    (view: ClipEditorLayoutView) => {
      setLayoutView(view)
      writeClipEditorLayoutView(view)
      if (unifiedWorkspaceActive) return
      if (view !== 'script') setScriptToolPanel(null)
      if (view !== 'timeline') {
        setDockPanelOpen(false)
      } else if (typeof window !== 'undefined' && band !== 'mobile') {
        const open = readTimelineDockPanelOpen(window.localStorage)
        setDockPanelOpen(open)
        if (open) setPanel((p) => (p === 'inspector' ? 'media' : p))
      }
    },
    [band, unifiedWorkspaceActive],
  )
  const { transcriptPct: scriptSplitPct, persist: persistScriptSplit } = useScriptViewSplit()
  const selectPanel = useCallback((id: EditorPanelId) => {
    setPanel(id)
    if (layoutView === 'script' && SCRIPT_VIEW_TOOL_PANELS.some((tool) => tool.id === id)) {
      setScriptToolPanel(id as ScriptViewToolPanelId)
    }
    const group = panelToRailGroup(id)
    if (group) writeRailGroupTab(group.id, id)
    if (unifiedWorkspaceActive) return
    if (layoutView === 'timeline' && band !== 'mobile') setDockPanelOpenPersist(true)
    else if (band === 'mobile' || band === 'compact') {
      setMobilePanelOpen(true)
    }
  }, [band, layoutView, setDockPanelOpenPersist, unifiedWorkspaceActive])
  const selectRailGroup = useCallback(
    (groupId: EditorRailGroupId) => {
      const group = editorRailGroups(clipEditorAiExtrasEnabled()).find((g) => g.id === groupId)
      if (!group) return
      const fallback = group.tabs[0]!.id
      selectPanel(readRailGroupTab(groupId, fallback))
    },
    [selectPanel],
  )
  const openLayersTab = useCallback(() => selectPanel('layers'), [selectPanel])

  // G4cfix2: every B2 medium on the editor route in CORS mode (+ recovery of pre-hydration failures).
  useEffect(() => watchEditorMediaCors(typeof document === 'undefined' ? null : document.body), [])
  useEffect(() => {
    if (!clipEditorLeftPanelIds(clipEditorAiExtrasEnabled()).includes(panel)) {
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
  const outputMsRef = useRef(0)
  outputMsRef.current = outputMs
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
  const [layoutCtx, setLayoutCtx] = useState<{ x: number; y: number } | null>(null)
  useEffect(() => {
    if (!layoutCtx) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLayoutCtx(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [layoutCtx])
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
    historyFutureLabels,
    canUndo,
    canRedo,
    saveState,
    applyCleanupCut,
    applyCleanupCuts,
    syncWordsForCuts,
    setCutRanges,
    setWordFix,
    applyWordFixesBatch,
    restoreWord,
    restoreCutRange,
    restoreCutRanges,
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
    setEditsPass,
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
    setFillerReviewOpen(false)
    undoEdits()
  }, [undoEdits])
  const redo = useCallback(() => {
    setAuditionEdits(null)
    setFillerReviewOpen(false)
    redoEdits()
  }, [redoEdits])
  const jumpHistory = useCallback(
    (steps: number) => {
      setAuditionEdits(null)
      setFillerReviewOpen(false)
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
      historyFutureLabels={historyFutureLabels}
      jumpHistory={jumpHistory}
      disabled={!canUndo && !canRedo}
    />
  )

  const commitTimelineEdits = useCallback(
    (next: ClipEditsV2, pushHistory = true, passLabel?: string) => {
      if (passLabel) setEditsPass(next, passLabel)
      else setEdits(next, pushHistory)
    },
    [setEdits, setEditsPass],
  )

  const onApplyCleanupPass = useCallback(
    (proposals: CleanupProposal[], label: string) => {
      logEditorDecision('cleanup_pass', { clipId, label, count: proposals.length })
      applyCleanupCuts(proposals, label)
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
      applyCleanupCut(proposal.range, singleCleanupApplyLabel(proposal), proposal.kind)
    },
    [applyCleanupCut, clipId],
  )

  const onRestoreCleanupPass = useCallback(
    (proposals: CleanupProposal[], label: string) => {
      logEditorDecision('cleanup_restore_pass', {
        clipId,
        label,
        count: proposals.length,
      })
      restoreCutRanges(
        proposals.map((p) => p.range),
        label,
      )
    },
    [clipId, restoreCutRanges],
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

  const [transcriptFindRequestSeq, setTranscriptFindRequestSeq] = useState(0)
  const [showSurrounding, setShowSurrounding] = useState(false)
  useEffect(() => {
    try {
      setShowSurrounding(localStorage.getItem('transovo.script.showSurrounding') === '1')
    } catch {
      /* private mode */
    }
  }, [])

  const editorWordsContextMs = showSurrounding ? SHOW_SURROUNDING_CONTEXT_MS : undefined
  // FIX1 (E.2): one window for the timeline + trim clamp (timeline.tsx clampTrimWithMediaBounds, line 476).
  const editorWin = editorWindowMs(editorMedia?.minMs, editorMedia?.maxMs, bounds.clipStartMs, bounds.clipEndMs)
  const { words: clipEditorWords, wordsLoading, loadingReason, reloadWords } = useEditorWords(
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
  useEffect(() => {
    syncWordsForCuts(editorWords)
  }, [editorWords, syncWordsForCuts])

  const handleDeriveClip = useCallback(
    async (trimIn: number, trimOut: number, deriveTitle?: string) => {
      setPendingDerivedClipId('pending')
      try {
        const snapped = snapTranscriptSelectionMs(trimIn, trimOut, editorWords, edits.trim.in, edits.trim.out)
        const data = await deriveClipFromEditor(clipId, {
          trimIn: snapped.trimIn,
          trimOut: snapped.trimOut,
          title: deriveTitle?.trim() || snapped.title,
        })
        setPendingDerivedClipId(data.clipId)
        toast.success('New clip created from selection')
      } catch (e) {
        setPendingDerivedClipId(null)
        toast.error(e instanceof Error ? e.message : 'Could not create clip')
      }
    },
    [clipId, editorWords, edits.trim.in, edits.trim.out],
  )


  const fvMoment = useFullVideoMomentFocus(fullVideo, bounds.clipEndMs - bounds.clipStartMs)
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
  const [multicamGridOn, setMulticamGridOn] = useState(false)
  useEffect(() => {
    try {
      setMulticamGridOn(localStorage.getItem('transovo.multicam.grid') === '1')
    } catch {
      /* private mode */
    }
  }, [])
  const multicamGridEligible = useMemo(
    () => multicamAngles(edits, angleSources).length >= 2,
    [edits, angleSources],
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

  useEffect(() => {
    if (pendingApplyDone.current || typeof window === 'undefined') return
    const u = new URL(window.location.href)
    const fromUrl = u.searchParams.get('apply')
    let tokenRaw = fromUrl
    if (!tokenRaw) {
      try {
        tokenRaw = localStorage.getItem('transovo.pendingApply')
        if (tokenRaw) localStorage.removeItem('transovo.pendingApply')
      } catch {
        /* ignore */
      }
    }
    if (!tokenRaw) return
    const token = parseApplyToken(tokenRaw)
    if (!token) return
    pendingApplyDone.current = true
    void (async () => {
      let payload = null
      if (token.kind === 'layout_pack') {
        payload = await fetchLayoutPackPayload(token.id)
        if (!payload) toast.error('Layout pack not found')
      }
      const starterOpts = {
        t6Templates: t6TemplatesEnabled(),
        t6Captions: t6CaptionPresetsEnabled(),
        durationMs: outDur,
        newId: () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      }
      const e0 = editsRef.current
      let nextEdits = e0
      if (token.kind === 'layout_pack') {
        if (payload) nextEdits = applyLayoutPackPayload(e0, payload)
      } else {
        nextEdits = applyCatalogToken(e0, token, {
          facecamLayout,
          playheadSourceMs,
          mediaLibrary: media.items,
          starterOpts,
        }).edits
      }
      setEdits(nextEdits)
      if (token.kind === 'layout_pack' && payload) toast.success('Layout pack applied')
      if (token.kind === 'look_feature' && token.id === 'bg_removal') {
        setCanvasSel({ target: 'video', label: 'Video' })
        selectPanel('inspector')
      }
      if (fromUrl) {
        u.searchParams.delete('apply')
        window.history.replaceState(null, '', `${u.pathname}${u.search}${u.hash}`)
      }
    })()
    // One-shot: consume ?apply= / pendingApply when the editor shell mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      if (target && !(panel === 'text' && target.startsWith('text:'))) {
        setPanel('inspector')
        if (layoutView === 'script') setScriptToolPanel('inspector')
        if (layoutView === 'timeline' && band !== 'mobile') setDockPanelOpenPersist(true)
      }
    },
    [edits.textItems, outputMs, panel, layoutView, band, setDockPanelOpenPersist],
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
  const scriptVoicePeaks = useAudioPeaks(videoUrl, 40, 12_000, {
    peaksUrl: editorAssets?.peaksUrl ?? null,
    skipDecode: Boolean(editorAssets?.fullVideo),
  })
  // SCRIPT_DOC2: share the clip's audio levels (shifted to source ms) so every cut edge lands on quiet audio.
  // SCRIPT_DOC3: a 5 ms envelope decoded in the browser replaces the 25 ms peaks once ready
  // (clips only; full-length videos keep the peaks).
  const fineCutAudioRef = useRef<{ key: string; samples: GapRmsSample[] } | null>(null)
  useEffect(() => {
    const coarse = scriptVoicePeaks.peaks.length
      ? rmsSamplesFromPeaks(scriptVoicePeaks.peaks, scriptVoicePeaks.peaksPerSec).map((s) => ({
          tMs: s.tMs + mediaOffsetMs,
          rms: s.rms,
        }))
      : []
    const key = `${videoUrl ?? ''}|${mediaOffsetMs}`
    const fine = fineCutAudioRef.current?.key === key ? fineCutAudioRef.current.samples : null
    setCutAudioSamples(clipId, fine ?? coarse)
    if (fine || !videoUrl || editorAssets?.fullVideo) return
    let cancelled = false
    void loadFineEnvelope(videoUrl, mediaOffsetMs).then((s) => {
      if (cancelled || !s?.length) return
      fineCutAudioRef.current = { key, samples: s }
      setCutAudioSamples(clipId, s)
    })
    return () => {
      cancelled = true
    }
  }, [clipId, editorAssets?.fullVideo, mediaOffsetMs, scriptVoicePeaks.peaks, scriptVoicePeaks.peaksPerSec, videoUrl])

  const seekSource = useCallback(
    (sourceMs: number) => {
      const preview = editorPreviewEdits(edits, editorWords)
      const tb = timebaseFor(preview)
      const { ms: outMs } = sourceMsToEditorMs(tb, sourceMs)
      outputMsRef.current = outMs
      setOutputMs(outMs)
      const v = videoRef.current
      if (!v) return
      const resume = keepPlayStateAcrossSeek(v)
      v.currentTime = videoTimeFromSourceMs(sourceMs, mediaOffsetMs)
      resume()
    },
    [edits, editorWords, mediaOffsetMs],
  )

  const highlightsSeekApi = useMemo(
    () => ({
      seekSource,
      timelineTb,
      setInOut: setExportTimelineInOut,
    }),
    [seekSource, timelineTb, setExportTimelineInOut],
  )
  const fvHighlights = useFullVideoHighlights(projectId, fullVideo, editorWords, highlightsSeekApi)

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
    const cut = transcriptCutForSelection(edits, editorWords, sel.startMs, sel.endMs)
    if (!cut) {
      toast.error('Selected words are outside the editable video. Select words inside the clip and retry.')
      return
    }
    applyCleanupCut(cut.range, `Cut transcript at ${(cut.atOutputMs / 1000).toFixed(1)}s`)
    toast.success(`Cut ${((cut.range[1] - cut.range[0]) / 1000).toFixed(1)}s from the video`, {
      description: 'Removed from the preview, the Timeline (✂ marks the join) and the export. ⌘Z to undo.',
    })
    sel.clear()
  }, [applyCleanupCut, edits, editorWords])

  const playFromTranscriptSelection = useCallback(() => {
    const sel = selectionRef.current
    if (!sel || sel.startMs === sel.endMs) return
    seekSource(Math.min(sel.startMs, sel.endMs))
    void togglePlay()
  }, [seekSource, togglePlay])

  const previewTranscriptSelection = useCallback(() => {
    const sel = selectionRef.current
    if (!sel || sel.startMs === sel.endMs) return
    const preview = editorPreviewEdits(edits, editorWords)
    const tb = timebaseFor(preview)
    const a = Math.min(sel.startMs, sel.endMs)
    const b = Math.max(sel.startMs, sel.endMs)
    const inMs = sourceMsToEditorMs(tb, a).ms
    const outMs = sourceMsToEditorMs(tb, b).ms
    setExportTimelineInOut({ inMs, outMs: Math.max(inMs + 1, outMs) })
    seekOutput(inMs)
    void togglePlay()
  }, [edits, editorWords, seekOutput, togglePlay])

  const splitSceneAtTranscriptSelection = useCallback(() => {
    const sel = selectionRef.current
    if (!sel || sel.startMs === sel.endMs) return
    splitLayoutAtSource(Math.min(sel.startMs, sel.endMs))
  }, [splitLayoutAtSource])

  const addMarkerAtTranscriptSelection = useCallback(() => {
    const sel = selectionRef.current
    if (!sel || sel.startMs === sel.endMs) return
    const preview = editorPreviewEdits(edits, editorWords)
    const ms = sourceMsToEditorMs(timebaseFor(preview), Math.min(sel.startMs, sel.endMs)).ms
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    setEdits({ ...edits, markers: toggleMarkerAt(edits.markers, ms, id) })
  }, [edits, editorWords, setEdits])

  // G1b: J / K / L shuttle. L plays (again: 2× / 4× / 8×), J plays backward (again: faster), K
  // stops. Above 1× and backward the preview scrubs frame by frame (no sound), like a jog wheel.
  const shuttleRef = useRef({ dir: 0 as -1 | 0 | 1, rate: 1, raf: 0, ms: 0, last: 0 })
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
        if (document.querySelector('[data-testid="timeline-shortcuts-sheet"]')) return
        if (exportOpen) {
          setExportOpen(false)
          e.preventDefault()
          return
        }
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
  }, [deleteSelection, edits, exportOpen, onCanvasSelect, outDur, outputMs, redo, undo, shuttle, stopShuttle])

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
  const activeRailGroup = panelToRailGroup(panel, aiExtras)
  const panelTabs = activeRailGroup?.tabs ?? []
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

  const renderInspectorPropertiesPanel = (force = false) =>
    force || panelMounted('inspector') ? (
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
          onOpenTextPanel={() => selectPanel('text')}
          onOpenCaptionsPanel={() => selectPanel('captions')}
          onOpenLayoutPanel={() => selectPanel('layout')}
          projectSettingsSlot={
            <PropertiesProjectSettings
              edits={edits}
              durationMs={outDur}
              layoutSlot={
                <LayoutQuickPicker
                  value={edits.layout.mode}
                  edits={edits}
                  facecamLayout={facecamLayout}
                  reframeV2Enabled={reframeV2Enabled}
                  onPick={onLayoutPick}
                  onAspectChange={(aspect) => setEdits({ ...edits, aspectRatio: aspect })}
                />
              }
              canvasBgSlot={
                <CanvasBackgroundSection
                  edits={edits}
                  media={media}
                  projectId={projectId}
                  clipId={clipId}
                  compositeLocked={compositePreviewClip}
                  readOnly={Boolean(edits.timelineLanes?.video?.locked)}
                  onCommit={(next) => setEdits(next)}
                />
              }
              onOpenTextPanel={() => selectPanel('text')}
              onOpenCaptionsPanel={() => selectPanel('captions')}
              onOpenLayoutPanel={() => selectPanel('layout')}
            />
          }
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
          videoToolRequest={videoToolRequest}
          videoSlot={
            <>
              <MainVideoTools
                edits={edits}
                clipId={clipId}
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
    ) : null

  const renderTranscriptPanel = (options: { compactToolbar?: boolean; largeScript?: boolean; documentView?: boolean }) => (
    <>
      {fullVideo && fvHighlights.showHighlightsList ? (
        <HighlightsListPanel
          picks={fvHighlights.picks}
          ranges={fvHighlights.ranges}
          selectedClipId={fvHighlights.selectedClipId}
          onSelect={fvHighlights.selectAndSeek}
          onMakeClip={(pick, range) => void fvHighlights.onMakeClip(pick, range)}
          onMakeAll={() => void fvHighlights.onMakeAll()}
          jobRunning={fvHighlights.isJobRunning}
          onClose={fvHighlights.dismissList}
        />
      ) : null}
      <EditorPanelErrorBoundary label="Script">
        <TranscriptPanel
          words={editorWords}
          wordsLoading={wordsLoading}
          wordsLoadingReason={loadingReason}
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
          compactToolbar={options.compactToolbar}
          largeScript={options.largeScript}
          documentView={options.documentView}
          findRequestSeq={transcriptFindRequestSeq}
          panelActive={Boolean(options.documentView || (layoutView === 'script' ? scriptToolPanel == null : panel === 'transcript'))}
          beatsAvailable={Boolean(beatCutApi?.hasBeats)}
          beatsAnalyzing={Boolean(beatCutApi?.analyzing)}
          beatCount={beatCutApi?.beatCount ?? 0}
          beatBpm={beatCutApi?.bpm}
          onCutToBeat={beatCutApi ? (every) => beatCutApi.cut(every) : undefined}
          onPlayFromSelection={playFromTranscriptSelection}
          onPreviewSelection={previewTranscriptSelection}
          onSplitSceneAtSelection={splitSceneAtTranscriptSelection}
          onAddMarkerAtSelection={addMarkerAtTranscriptSelection}
          onSelectRange={
            fullVideo && fvHighlights.highlightsOn
              ? (startMs, endMs) => {
                  const mid = fvHighlights.picks.find((p) => p.startMs === startMs && p.endMs === endMs)
                  if (mid) fvHighlights.selectAndSeek(mid.clipId)
                }
              : undefined
          }
        />
      </EditorPanelErrorBoundary>
    </>
  )

  const renderSidePanels = (scope: EditorPanelId | null) => {
    const on = (id: EditorPanelId) => (scope != null ? scope === id : panel === id)
    return (
    <>
      {scope == null || scope === 'transcript' ? (
        <div className={on('transcript') ? undefined : 'hidden'} aria-hidden={!on('transcript')}>
          {renderTranscriptPanel({ compactToolbar: true })}
        </div>
      ) : null}
      <div className={on('cleanup') ? undefined : 'hidden'} aria-hidden={!on('cleanup')}>
        <EditorPanelErrorBoundary label="Cleanup">
          <CleanupPanel
            clipId={clipId}
            projectId={projectId}
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
            onRestorePass={onRestoreCleanupPass}
            onCommitTrim={setTrim}
            onAuditionChange={setAuditionEdits}
            onSeek={seekSource}
            onReloadWords={reloadWords}
            onGapSettingsChange={(patch) => setGapToolSettings((s) => ({ ...s, ...patch }))}
            mediaOffsetMs={mediaOffsetMs}
          />
        </EditorPanelErrorBoundary>
      </div>
      <div className={on('layout') ? 'p-3' : 'hidden'} aria-hidden={!on('layout')}>
        <EditorPanelErrorBoundary label="Layout">
        <LayoutPanel
          edits={edits}
          shots={cropShots}
          onMode={onLayoutMode}
          onShotFocus={setShotOverride}
          onSeekShot={seekSource}
          onRerunReframe={() => void requestClipReframe(clipId)}
          onApplyBrand={() => void applyBrand()}
          onEdits={setEdits}
          onEditsPass={setEditsPass}
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
      <div className={on('layers') ? 'p-3' : 'hidden'} aria-hidden={!on('layers')}>
        <EditorPanelErrorBoundary label="Layers">
          <LayersPanel
            clipId={clipId}
            edits={edits}
            layers={layers}
            setLayers={setLayers}
            onEdits={setEdits}
            selectedLayerKey={canvasSel?.target ?? null}
            onSelectActualLayer={(kind, id, startMs) => {
              if (kind === 'captions') {
                selectPanel('captions')
                return
              }
              if (kind === 'sticker' || kind === 'badge' || kind === 'headline' || kind === 'hook') {
                // These legacy overlay controls live in the expanded layer-design section.
                // Do not send a nonexistent text selection to the timeline.
                setCanvasSel(null)
                return
              }
              const target: KeyframeTarget = kind === 'video' ? 'video' : kind === 'broll' ? `broll:${id}` : `text:${id}`
              setCanvasSel({ target, label: kind === 'video' ? 'Main video' : kind === 'broll' ? 'B-roll' : 'Text' })
              setTimelineSelReq((prev) => ({
                lane: kind === 'video' ? 'video' : kind,
                ...(kind === 'video' ? { atMs: outputMs } : { id }),
                seq: (prev?.seq ?? 0) + 1,
              }))
              if (kind === 'text') setSelectedTextId(id)
              if (kind !== 'video' && Math.abs(startMs - outputMs) > 500) seekOutput(startMs)
            }}
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
      <div className={on('captions') ? undefined : 'hidden'} aria-hidden={!on('captions')}>
        <EditorPanelErrorBoundary label="Captions">
        <CaptionLinesPanel
          part="fix"
          edits={edits}
          words={editorWords}
          playheadMs={outputMs}
          durationMs={outDur}
          onEdits={(e) => setEdits(e)}
          onSeekOutput={seekOutput}
        />
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
          part="manual"
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
      <div className={on('audio') ? undefined : 'hidden'} aria-hidden={!on('audio')}>
        <EditorPanelErrorBoundary label="Audio">
        <AudioPanel
          clipId={clipId}
          edits={edits}
          outputDurationMs={outDur}
          playheadMs={outputMs}
          playheadAtMsRef={outputMsRef}
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
          beatCount={beatCutApi?.beatCount ?? 0}
          beatBpm={beatCutApi?.bpm}
          beatsAnalyzing={Boolean(beatCutApi?.analyzing)}
          onBeatSyncPass={setEditsPass}
        />
        </EditorPanelErrorBoundary>
      </div>
      {panelMounted('broll') ? (
        <div className={on('broll') ? undefined : 'hidden'} aria-hidden={!on('broll')} data-testid="editor-panel-broll">
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
            onAcceptBrollSuggestions={(items) => {
              void (async () => {
                const resolved: BrollItem[] = []
                for (const item of items) {
                  if (item.source !== 'stock' || !isPendingStockAssetId(item.assetId)) {
                    resolved.push(item)
                    continue
                  }
                  const providerId = pendingStockProviderId(item.assetId)
                  try {
                    const data = await clipsFetch<{ assetId: string }>(`/api/clips/clips/${clipId}/broll`, {
                      method: 'POST',
                      body: JSON.stringify({
                        providerId,
                        startMs: item.startMs,
                        endMs: item.endMs,
                      }),
                    })
                    resolved.push({ ...item, assetId: data.assetId })
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Failed to cache stock clip')
                    return
                  }
                }
                const filtered = filterAutoBrollSuggestions(edits.broll ?? [], resolved)
                if (!filtered.accepted.length) {
                  toast.message('No new B-roll passed the 60 s repeat rule')
                  return
                }
                setEditsPass({ ...edits, broll: [...(edits.broll ?? []), ...filtered.accepted] }, 'Accept B-roll')
              })()
            }}
            uploadSlot={
              <MediaLibraryGrid media={media} filter="visual" lanes={['broll']} onAdd={(item, lane) => onAddMedia(item, lane)} compact />
            }
          />
          </EditorPanelErrorBoundary>
        </div>
      ) : null}
      {panelMounted('brand') ? (
        <div className={on('brand') ? 'p-3' : 'hidden'} aria-hidden={!on('brand')} data-testid="editor-panel-brand">
          <EditorPanelErrorBoundary label="Brand">
          <BrandPanel edits={edits} onEdits={setEdits} />
          </EditorPanelErrorBoundary>
        </div>
      ) : null}
      {panelMounted('thumbnail') ? (
        <div className={on('thumbnail') ? 'p-3' : 'hidden'} aria-hidden={!on('thumbnail')} data-testid="editor-panel-thumbnail">
          <EditorPanelErrorBoundary label="Cover">
          <ThumbnailPanel
            clipId={clipId}
            edits={edits}
            onEdits={setEdits}
            videoUrl={videoUrl}
            trimIn={edits.trim.in}
            trimOut={edits.trim.out}
            defaultTitle={title}
          />
          </EditorPanelErrorBoundary>
        </div>
      ) : null}
      {aiExtras && panelMounted('dub') ? (
        <div className={on('dub') ? 'p-3' : 'hidden'} aria-hidden={!on('dub')} data-testid="editor-panel-dub">
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
        <div className={on('text') ? undefined : 'hidden'} aria-hidden={!on('text')} data-testid="editor-panel-text">
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
        <div className={on('templates') ? undefined : 'hidden'} aria-hidden={!on('templates')} data-testid="editor-panel-templates">
          <EditorPanelErrorBoundary label="Templates">
          <TemplatesPanel
            edits={edits}
            onEdits={setEdits}
            playheadMs={outputMs}
            durationMs={outDur}
            brandTemplates={brandTemplates}
            onApplyBrand={applyBrandTemplateById}
            onOpenBgRemoval={() => {
              setCanvasSel({ target: 'video', label: 'Video' })
              selectPanel('inspector')
            }}
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
                  onAspectChange={(aspect) => setEdits({ ...edits, aspectRatio: aspect })}
                />
              )
            }
          />
          </EditorPanelErrorBoundary>
        </div>
      ) : null}
      {(scope === 'inspector' || ((band !== 'wide' || dockTools) && panelMounted('inspector'))) ? (
        <div className={on('inspector') ? undefined : 'hidden'} aria-hidden={!on('inspector')} data-testid="editor-panel-inspector">
          {renderInspectorPropertiesPanel(scope === 'inspector' || band !== 'wide' || dockTools)}
        </div>
      ) : null}
      {panelMounted('color') ? (
        <div className={on('color') ? undefined : 'hidden'} aria-hidden={!on('color')} data-testid="editor-panel-color">
          <EditorPanelErrorBoundary label="Color">
          <EffectsBrowser edits={edits} onEdits={setEdits} playheadSourceMs={playheadSourceMs} outputMs={outputMs} outputDurationMs={outDur} onSeekOutput={seekOutput}>
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
          </EffectsBrowser>
          </EditorPanelErrorBoundary>
        </div>
      ) : null}
      {panelMounted('repurpose') ? (
        <div className={on('repurpose') ? undefined : 'hidden'} aria-hidden={!on('repurpose')}>
          <EditorPanelErrorBoundary label="Repurpose">
            <RepurposePanel
              clipId={clipId}
              edits={edits}
              aiMeta={aiMeta}
              onCommitEdits={setEdits}
              onSeekOutputMs={(ms) => seekOutput(ms)}
            />
          </EditorPanelErrorBoundary>
        </div>
      ) : null}
      {panelMounted('media') ? (
        <div className={on('media') ? undefined : 'hidden'} aria-hidden={!on('media')} data-testid="editor-panel-media">
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
            onEditsPass={setEditsPass}
            playheadSourceMs={playheadSourceMs}
            onSeekSource={seekSource}
            monitorRequest={monitorRequest}
            timebase={timelineTb}
            playheadOutMs={outputMs}
            playheadOutMsRef={outputMsRef}
            sourceDurationMs={bounds.trimMaxMs ?? bounds.clipEndMs}
          />
          </EditorPanelErrorBoundary>
        </div>
      ) : null}
    </>
  )
  }
  // Script tools are owned by ScriptViewMainSplit; never construct the legacy panel tree there.
  const panelBody = unifiedWorkspaceActive || layoutView === 'script' ? null : renderSidePanels(null)

  const previewColumnContent = (
      <div className={cn("flex h-full min-h-0 w-full min-w-0 flex-col gap-1 overflow-hidden", unifiedWorkspaceActive ? "px-0 pb-0 pt-0" : "px-2 pb-1 pt-2")}>
        <div
          className={cn("relative grid min-h-0 flex-1 place-items-center bg-[radial-gradient(ellipse_at_center,oklch(0.22_0.02_280)_0%,var(--background)_70%)] [container-type:size]", unifiedWorkspaceActive ? "p-0" : "p-1 md:p-2")}
          style={dockTools && !unifiedWorkspaceActive ? { alignItems: 'end', paddingBottom: 4 } : undefined}
        >
          <div
            ref={previewFrameRef}
            className="relative max-h-full min-w-0 overflow-hidden rounded-xl shadow-lg ring-1 ring-white/10"
            style={{
              aspectRatio: aspectStyle,
              width: `min(100%, calc(100cqh * ${aspectCssToNumber(previewAspect)}))`,
            }}
            onContextMenu={(e) => {
              if ((e.target as HTMLElement).closest('input,textarea,[contenteditable="true"]')) return
              e.preventDefault()
              // FIX2 R4: viewport coords. The menu is portaled + position:fixed.
              setLayoutCtx({ x: e.clientX, y: e.clientY })
            }}
          >
      {(edits.layout.shotOverrides?.length ?? 0) > 0 ? (
        <span
          className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-medium text-white ring-1 ring-white/15"
          aria-hidden
        >
          Manual framing
        </span>
      ) : edits.layout.mode === 'auto' || edits.layout.mode === 'dynamic' ? (
        <span
          className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-medium text-white ring-1 ring-white/15"
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
        onEditorMediaError={onEditorMediaError}
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
      {layoutCtx ? (
        <CanvasLayoutMenu x={layoutCtx.x} y={layoutCtx.y} onClose={() => setLayoutCtx(null)}>
          <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">This scene (from the playhead)</p>
          <div className="mb-2 grid grid-cols-2 gap-1">
            {EXPORT_LAYOUT_OPTIONS.filter(
              (o) =>
                !layoutOptionDisabled(o, {
                  facecamLayout: facecamLayout ?? null,
                  reframeV2Enabled,
                  aiExtras: clipEditorAiExtrasEnabled(),
                }),
            ).map((o) => (
              <button
                key={o.id}
                type="button"
                role="menuitem"
                className="min-h-8 rounded px-2 py-1.5 text-left leading-tight hover:bg-muted"
                onClick={() => {
                  setLayoutModeAtSource(playheadSourceMs, o.id)
                  setLayoutCtx(null)
                }}
              >
                {o.title}
              </button>
            ))}
          </div>
          <div className="my-2 h-px bg-border" role="separator" />
          <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">Whole clip</p>
          <LayoutQuickPicker
            value={edits.layout.mode}
            edits={edits}
            facecamLayout={facecamLayout}
            reframeV2Enabled={reframeV2Enabled}
            onPick={(mode, facecam) => {
              onLayoutPick(mode, facecam)
              setLayoutCtx(null)
            }}
            onAspectChange={(aspect) => { setEdits({ ...edits, aspectRatio: aspect }); setLayoutCtx(null) }}
          />
        </CanvasLayoutMenu>
      ) : null}
      {multicamGridOn && multicamGridEligible ? (
        <div className="absolute right-3 top-3 z-10 hidden w-[min(28%,240px)] xl:block">
          <MulticamAngleGrid
            edits={edits}
            library={angleSources}
            sourceUrls={sourceUrls}
            mainVideoUrl={videoUrl}
            playheadSourceMs={playheadSourceMs}
            playing={playing}
            onSwitchAngle={(sourceId, opts) => {
              const library = angleSources
              if (opts?.shiftKey) {
                const library = angleSources
                const switched = switchAngleAt(edits, playheadSourceMs, sourceId, library)
                setEditsPass(
                  sideBySideAfterAngleSwitch(switched, playheadSourceMs, sourceId, library),
                  'Side by side',
                )
                return
              }
              setEditsPass(switchAngleAt(edits, playheadSourceMs, sourceId, library), 'Camera angle')
            }}
          />
        </div>
      ) : null}
          </div>
        </div>
        {!dockTools && (pickerWhy || detectedLayout || clipTypeLabel) ? (
          <div className="hidden max-w-xl space-y-1 px-1 2xl:block">
        {clipTypeLabel ? (
          <p className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Clip type:</span> {clipTypeLabel}
          </p>
        ) : null}
        {detectedLayout ? (
          <p className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Detected layout:</span> {detectedLayout}
          </p>
        ) : null}
        {pickerWhy ? (
          <p className="line-clamp-2 text-xs text-muted-foreground" title={pickerWhy}>{pickerWhy}</p>
        ) : null}
      </div>
          ) : null}
        <div className={cn('mt-auto min-w-0 shrink-0 space-y-1 border-t border-border pt-1.5', dockTools && 'mx-auto w-full max-w-4xl', unifiedWorkspaceActive && 'pt-0.5')}>
          {dockTools && (clipTypeLabel || detectedLayout || pickerWhy) ? (
            <p
              className="truncate px-1 text-center text-[11px] text-muted-foreground"
              title={[clipTypeLabel ? `Clip type: ${clipTypeLabel}` : '', detectedLayout ? `Detected layout: ${detectedLayout}` : '', pickerWhy ?? '']
                .filter(Boolean)
                .join(' · ')}
              data-testid="preview-clip-meta-line"
            >
              {[clipTypeLabel, detectedLayout, pickerWhy].filter(Boolean).join(' · ')}
            </p>
          ) : null}
          <PreviewTransportStrip
            compact={layoutView === 'script' || (!dockTools && previewFrameW < 560)}
            recordSlot={
              recordDevicesOk ? (
                <ClipRecordMenu
                  onPick={(m) => {
                    clipRec.arm(m)
                    if (m === 'voiceover') selectPanel('media')
                  }}
                  onOpenAiVoiceover={() => selectPanel('audio')}
                />
              ) : (
                <ClipRecordMenu disabled disabledReason="Recording needs a secure origin and microphone access" onPick={() => undefined} />
              )
            }
            viewSummary={`Loop ${edits.loopFriendlyEnd === false ? 'off' : 'on'} · ${previewQuality === 'auto' ? 'Auto' : previewQuality}`}
            viewMenuBody={
              <div className="flex flex-col gap-2" data-testid="preview-chip-row">
                <button type="button" className={previewChipButtonClass()} onClick={toggleLoopFriendly}>
                  Loop trim {edits.loopFriendlyEnd === false ? 'off' : 'on'}
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
                    className={cn(previewChipButtonClass(), 'h-auto w-full gap-1 border-0 px-2 py-1 shadow-none')}
                    data-testid="preview-quality"
                    title="Preview only — export is unaffected"
                  >
                    <SelectValue>
                      Quality: {previewQuality === 'auto' ? 'Auto' : previewQuality === 'full' ? 'Full' : 'Half'}
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
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className={previewChipButtonClass()}
                    data-testid="preview-zoom-out"
                    title="Zoom out"
                    onClick={() => setPreviewZoom((z) => nextZoom(z, -1, fitPct))}
                  >
                    −
                  </button>
                  {multicamGridEligible ? (
                    <button
                      type="button"
                      className={previewChipButtonClass(multicamGridOn ? 'ring-2 ring-primary' : undefined)}
                      data-testid="preview-multicam-grid-toggle"
                      title="Show all camera angles beside the preview"
                      onClick={() => {
                        setMulticamGridOn((on) => {
                          const next = !on
                          try {
                            localStorage.setItem('transovo.multicam.grid', next ? '1' : '0')
                          } catch {
                            /* private mode */
                          }
                          return next
                        })
                      }}
                    >
                      Angles
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={previewChipButtonClass()}
                      data-testid="preview-multicam-grid-toggle"
                      disabled
                      title="Needs 2+ angles"
                    >
                      Angles
                    </button>
                  )}
                  <button
                    type="button"
                    className={previewChipButtonClass()}
                    data-testid="preview-zoom-in"
                    title="Zoom in"
                    onClick={() => setPreviewZoom((z) => nextZoom(z, 1, fitPct))}
                  >
                    +
                  </button>
                </div>
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
                      <div className="absolute left-0 top-full z-[60] mt-1 flex flex-col rounded-md border border-border bg-popover p-1 shadow-md">
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
                <button
                  type="button"
                  className={previewChipButtonClass(meterOn ? 'ring-2 ring-primary' : undefined)}
                  data-testid="preview-meter-toggle"
                  onClick={() => setMeterOn((v) => !v)}
                >
                  Meter {meterOn ? 'on' : 'off'}
                </button>
              </div>
            }
            transportSlot={
              clipRec.armed ? null : (
                <>
                  <PlayerControls
                    playing={playing}
                    outputMs={transportClockMs}
                    outputDurationMs={displayDur}
                    onToggle={() => void togglePlay()}
                    onScrub={seekDisplay}
                    showScrubber={false}
                    muted={playerMuted}
                    volume={playerVolume}
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
                    meterSlot={meterOn ? <AudioMeter levels={peakLevels} voiceMetered={audioMeter.voiceMetered} /> : null}
                  />
                </>
              )
            }
            fullscreenSlot={
              clipRec.armed ? null : (
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
                  {layoutView === 'script' || dockTools || previewFrameW < 560 ? (
                    <Maximize2 className="size-4" aria-hidden />
                  ) : (
                    'Full screen'
                  )}
                </button>
              )
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
          ) : null}
        </div>
      </div>
  )

  // MENUBAR1: top menu bar. Every item calls an EXISTING handler / panel; conditional items are greyed with a hint.
  const runTimelineMenu = (cmd: TimelineMenuCommand) => {
    if (layoutView !== 'timeline') setLayoutViewPersist('timeline')
    setTimelineMenuCmd((prev) => ({ cmd, seq: (prev?.seq ?? 0) + 1 }))
  }
  const runPalette = (id: string) => runTimelineMenu({ kind: 'palette', id })
  const openToolPanel = (id: EditorPanelId) => {
    if (unifiedWorkspaceActive) {
      selectPanel(id)
      return
    }
    if (layoutView === 'script' && SCRIPT_VIEW_TOOL_PANELS.some((p) => p.id === id)) {
      const sid = id as ScriptViewToolPanelId
      setVisitedPanels((v) => (v.has(sid) ? v : new Set([...v, sid])))
      selectPanel(sid)
      setScriptToolPanel(sid)
      return
    }
    if (layoutView === 'script') setLayoutViewPersist('timeline')
    selectPanel(id)
  }
  const scrollToTestId = (testId: string) => {
    window.setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 150)
  }
  /** Select the main video (same as clicking it on the canvas) and open Properties at its video tools. */
  const openVideoTools = (testId: 'blur-add' | 'bg-removal' | 'properties-panel') => {
    onCanvasSelect('video')
    if (layoutView === 'script') openToolPanel('inspector')
    else if (band !== 'wide' || layoutView === 'timeline') selectPanel('inspector')
    setVideoToolRequest((prev) => ({ id: testId, seq: (prev?.seq ?? 0) + 1 }))
  }
  const openVersions = () => {
    document.querySelector<HTMLElement>('[data-testid="versions-menu"]')?.click()
  }
  const openProjectSettings = () => {
    // SCRIPT_DOC3: a dialog always opens, whatever is selected and whichever view is shown.
    setProjectSettingsOpen(true)
  }
  /** TIMELINE_LAYOUT1: clicking the open group again closes the docked panel (Script-view rail behaviour). */
  const dockSelectGroup = (groupId: EditorRailGroupId) => {
    if (dockPanelOpen && panelToRailGroup(panel)?.id === groupId) {
      setDockPanelOpenPersist(false)
      return
    }
    selectRailGroup(groupId)
  }
  const needSel = canvasSel ? null : 'Select a clip first'
  const needBroll = canvasSel?.target.startsWith('broll:') ? null : 'Select a B-roll clip first'
  const needFull = fullVideo ? null : 'Available on full-length videos'
  const editorMenus: EditorMenu[] = [
    {
      id: 'file',
      label: 'File',
      groups: [
        {
          items: [
            { id: 'new-project', label: 'New project', onSelect: () => window.location.assign('/app/clips/new') },
            { id: 'open-projects', label: 'Open projects', onSelect: () => window.location.assign('/app/clips') },
            { id: 'versions', label: 'Versions / History', onSelect: openVersions, disabledHint: versionsEnabled ? null : 'Unavailable' },
            { id: 'project-settings', label: 'Project settings', onSelect: openProjectSettings },
          ],
        },
        {
          items: [
            { id: 'export', label: 'Export video…', shortcut: '⌘E', onSelect: () => setExportOpen(true) },
            { id: 'export-other', label: 'Export audio, stems, subtitles, XML…', onSelect: () => setExportOpen(true) },
            { id: 'cover', label: 'Cover / thumbnail', onSelect: () => openToolPanel('thumbnail') },
          ],
        },
        { items: [{ id: 'back', label: 'Back to projects', onSelect: () => window.location.assign(`/app/clips/${projectId}`) }] },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      groups: [
        {
          items: [
            { id: 'undo', label: 'Undo', shortcut: '⌘Z', onSelect: undo, disabledHint: canUndo ? null : 'Nothing to undo' },
            { id: 'redo', label: 'Redo', shortcut: '⇧⌘Z', onSelect: redo, disabledHint: canRedo ? null : 'Nothing to redo' },
          ],
        },
        {
          items: [
            { id: 'cut', label: 'Cut', onSelect: () => runPalette('cut'), disabledHint: needSel },
            { id: 'copy', label: 'Copy', onSelect: () => runPalette('copy'), disabledHint: needSel },
            { id: 'paste', label: 'Paste at playhead', onSelect: () => runPalette('paste') },
            { id: 'paste-attrs', label: 'Paste attributes', onSelect: () => runPalette('pasteAttrs'), disabledHint: needSel },
            { id: 'duplicate', label: 'Duplicate', onSelect: () => runPalette('duplicate'), disabledHint: needSel },
            { id: 'delete', label: 'Delete selected', onSelect: () => runPalette('delete'), disabledHint: needSel },
          ],
        },
        {
          items: [
            {
              id: 'find-replace',
              label: 'Find & replace in script',
              onSelect: () => {
                // A3: request focus through React so it survives opening a hidden or unmounted Script panel.
                if (!unifiedWorkspaceActive) {
                  if (layoutView === 'script') setScriptToolPanel(null)
                  else selectPanel('transcript')
                }
                setTranscriptFindRequestSeq((seq) => seq + 1)
              },
            },
            { id: 'marker', label: 'Add / remove marker', shortcut: 'M', onSelect: () => runPalette('marker') },
            { id: 'marker-list', label: 'Markers & chapters…', onSelect: () => runPalette('markerList') },
            { id: 'next-take', label: 'Next take', onSelect: () => runPalette('nextTake') },
          ],
        },
        {
          label: 'Range',
          items: [
            { id: 'mark-in', label: 'Mark in', shortcut: 'I', onSelect: () => runPalette('markIn') },
            { id: 'mark-out', label: 'Mark out', shortcut: 'O', onSelect: () => runPalette('markOut') },
            { id: 'clear-io', label: 'Clear in / out', onSelect: () => runPalette('clearIO') },
            { id: 'range-delete', label: 'Delete in–out range', onSelect: () => runPalette('rangeDel') },
          ],
        },
      ],
    },
    {
      id: 'view',
      label: 'View',
      groups: [
        {
          items: [
            { id: 'view-script', label: 'Compact timeline', onSelect: () => setLayoutViewPersist('script'), disabledHint: layoutView === 'script' ? 'Current view' : null },
            { id: 'view-timeline', label: 'Full multitrack timeline', onSelect: () => setLayoutViewPersist('timeline'), disabledHint: layoutView === 'timeline' ? 'Current view' : null },
          ],
        },
        {
          items: [
            { id: 'safe-zone', label: safeZoneVisible ? 'Hide safe zone' : 'Show safe zone', onSelect: () => setSafeZoneVisible(!safeZoneVisible) },
            { id: 'zoom-fit', label: 'Zoom timeline to fit', shortcut: '0', onSelect: () => runPalette('zoomFit') },
            { id: 'zoom-in', label: 'Zoom timeline in', shortcut: '+', onSelect: () => runPalette('zoomIn') },
            { id: 'zoom-out', label: 'Zoom timeline out', shortcut: '−', onSelect: () => runPalette('zoomOut') },
          ],
        },
        {
          items: [
            {
              id: 'highlights',
              label: fullVideo && fvHighlights.highlightsOn ? 'Hide highlights lane' : 'Show highlights lane',
              onSelect: () => fvHighlights.persistToggle(!fvHighlights.highlightsOn),
              disabledHint: needFull,
            },
          ],
        },
      ],
    },
    {
      id: 'layout',
      label: 'Layout',
      groups: [
        {
          label: 'Aspect ratio',
          items: (['16:9', '9:16', '1:1', '4:5'] as const).map((aspect) => ({
            id: `aspect-${aspect.replace(':', '-')}`,
            label: `Aspect ${aspect}${(edits.aspectRatio ?? '9:16') === aspect ? ' ✓' : ''}`,
            onSelect: () => setEdits({ ...edits, aspectRatio: aspect }),
          })),
        },
        {
          label: 'Video layouts',
          items: EXPORT_LAYOUT_OPTIONS.map((opt) => {
            const disabled = layoutOptionDisabled(opt, {
              facecamLayout: facecamLayout ?? null,
              reframeV2Enabled,
              aiExtras: clipEditorAiExtrasEnabled(),
            })
            const landscapeOff = (edits.aspectRatio ?? '9:16') === '16:9' && opt.id !== 'full_frame' && opt.id !== 'center_crop'
            return {
              id: `layout-${opt.id}`,
              label: opt.title,
              onSelect: () => {
                const selection = layoutPickPayload(opt.id, facecamLayout ?? null, edits)
                onLayoutPick(selection.mode, selection.facecam)
              },
              disabledHint: disabled ? (opt.hint ?? 'Not available for this clip') : landscapeOff ? 'Change Aspect above first' : null,
            }
          }),
        },
      ],
    },
    {
      id: 'clip',
      label: 'Clip',
      groups: [
        {
          items: [
            { id: 'split', label: 'Split at playhead', shortcut: 'S', onSelect: () => runPalette('split') },
            { id: 'freeze', label: 'Freeze frame', onSelect: () => runPalette('freeze') },
            { id: 'trim-start', label: 'Trim start to playhead', onSelect: () => runPalette('trimStart') },
            { id: 'trim-end', label: 'Trim end to playhead', onSelect: () => runPalette('trimEnd') },
            { id: 'speed', label: 'Speed…', onSelect: () => runPalette('speed') },
            { id: 'gap', label: 'Insert gap at playhead', onSelect: () => runPalette('gap') },
            { id: 'replace-gap', label: 'Replace clip with gap', onSelect: () => runPalette('replaceGap'), disabledHint: needSel },
            { id: 'toggle-enabled', label: 'Disable / enable clip', onSelect: () => runPalette('toggleEnabled'), disabledHint: needSel },
          ],
        },
        {
          items: [
            { id: 'j-cut', label: 'J-cut (audio leads)', onSelect: () => runTimelineMenu({ kind: 'jCut' }) },
            { id: 'l-cut', label: 'L-cut (audio trails)', onSelect: () => runTimelineMenu({ kind: 'lCut' }) },
            { id: 'group', label: 'Group', onSelect: () => runPalette('group'), disabledHint: needSel },
            { id: 'ungroup', label: 'Ungroup', onSelect: () => runPalette('ungroup'), disabledHint: needSel },
            { id: 'compound', label: 'Create compound clip', onSelect: () => runPalette('compound'), disabledHint: needSel },
            { id: 'uncompound', label: 'Uncompound', onSelect: () => runPalette('uncompound'), disabledHint: needSel },
          ],
        },
        {
          label: 'Video tools',
          items: [
            { id: 'transform', label: 'Transform & crop', onSelect: () => openVideoTools('properties-panel') },
            { id: 'blur', label: 'Blur faces / regions', onSelect: () => openVideoTools('blur-add') },
            { id: 'bg-removal', label: 'Background removal', onSelect: () => openVideoTools('bg-removal') },
            { id: 'color', label: 'Color & effects', onSelect: () => openToolPanel('color') },
            { id: 'layers', label: 'Layers, masks & chroma key', onSelect: () => openToolPanel('layers') },
            { id: 'layout', label: 'Layout & aspect ratio', onSelect: () => openToolPanel('layout') },
          ],
        },
      ],
    },
    {
      id: 'audio',
      label: 'Audio',
      groups: [
        {
          items: [
            { id: 'music', label: 'Music, SFX & AI music', onSelect: () => openToolPanel('audio') },
            { id: 'beats', label: 'Beats & cut to beat', onSelect: () => openToolPanel('audio') },
            { id: 'voiceover', label: 'Record voiceover', onSelect: () => clipRec.arm('voiceover') },
            { id: 'add-audio-track', label: 'Add audio track', onSelect: () => runPalette('addAudio') },
          ],
        },
        {
          items: [
            { id: 'detach-audio', label: 'Detach audio', onSelect: () => runTimelineMenu({ kind: 'detachAudio' }), disabledHint: needBroll },
            { id: 'j-cut-audio', label: 'J-cut / L-cut (split audio)', onSelect: () => runTimelineMenu({ kind: 'jCut' }) },
          ],
        },
      ],
    },
    {
      id: 'tools',
      label: 'Tools',
      groups: [
        {
          items: [
            { id: 'cleanup', label: 'Clean up (fillers, gaps, retakes)', onSelect: () => openToolPanel('cleanup') },
            { id: 'pacing', label: 'Pacing check', onSelect: () => runPalette('pacing') },
            { id: 'producer', label: 'AI Producer', onSelect: () => setProducerOpen(true) },
            { id: 'captions', label: 'Captions & translate', onSelect: () => openToolPanel('captions') },
            { id: 'repurpose', label: 'Repurpose (chapters, show notes)', onSelect: () => openToolPanel('repurpose') },
          ],
        },
        {
          items: [
            {
              id: 'find-clips',
              label: 'Find clips in video',
              onSelect: () => document.querySelector<HTMLElement>('[data-testid="editor-find-clips-in-video"]')?.click(),
              disabledHint: needFull,
            },
            {
              id: 'make-all-highlights',
              label: 'Make clips from all highlights',
              onSelect: () => void fvHighlights.onMakeAll(),
              disabledHint: needFull ?? (fvHighlights.highlightsOn && fvHighlights.hasPicks ? null : 'Turn on highlights first'),
            },
          ],
        },
        {
          items: [
            { id: 'media', label: 'Media library', onSelect: () => openToolPanel('media') },
            { id: 'broll', label: 'B-roll', onSelect: () => openToolPanel('broll') },
            { id: 'templates', label: 'Templates', onSelect: () => openToolPanel('templates') },
            { id: 'brand', label: 'Brand kit', onSelect: () => openToolPanel('brand') },
          ],
        },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      groups: [
        {
          items: [
            { id: 'shortcuts', label: 'Keyboard shortcuts', shortcut: '?', onSelect: () => setEditorShortcutsOpen(true) },
            { id: 'palette', label: 'Search all tools', shortcut: '⌘K', onSelect: () => runTimelineMenu({ kind: 'openPalette' }) },
          ],
        },
      ],
    },
  ]

  return (
    <div
      data-testid="editor-shell-root"
      className={cn(
        'flex h-dvh min-h-0 flex-col overflow-hidden bg-background',
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
          titleMenuSlot={
            <EditorProjectMenu
              title={title}
              onTitleChange={setTitle}
              actions={{
                newProject: { kind: 'link', label: 'New project', href: '/app/clips/new' },
                openProjects: { kind: 'link', label: 'Open projects', href: '/app/clips' },
                rename: { kind: 'button', label: 'Rename', onClick: () => undefined },
                versionsHistory: {
                  kind: 'button',
                  label: 'Versions / History',
                  onClick: openVersions,
                  disabled: !versionsEnabled,
                },
                projectSettings: {
                  kind: 'button',
                  label: 'Project settings',
                  onClick: openProjectSettings,
                },
                export: { kind: 'button', label: 'Export…', onClick: () => setExportOpen(true) },
                keyboardShortcuts: {
                  kind: 'button',
                  label: 'Keyboard shortcuts',
                  onClick: () => setEditorShortcutsOpen(true),
                },
                backToProjects: { kind: 'link', label: 'Back to projects', href: `/app/clips/${projectId}` },
              }}
            />
          }
          saveState={saveState}
          optimisticPending={saveState === 'dirty'}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          historySlot={historyPanel}
          onExport={() => setExportOpen(true)}
          onRetrySave={() => {
            void flushSave()
          }}
          onOpenProducer={() => setProducerOpen((o) => !o)}
          producerOpen={producerOpen}
          producerStrip={producerStrip ? { changeCount: producerStrip.changeCount, onUndo: undo } : null}
          pendingPaidCount={producerPendingPaid}
          layoutViewSlot={unifiedWorkspaceActive ? null : <EditorLayoutViewSwitch value={layoutView} onChange={setLayoutViewPersist} />}
          menuBarSlot={
            <EditorMenuBar menus={editorMenus} onOpenSearch={() => runTimelineMenu({ kind: 'openPalette' })} />
          }
          layoutSlot={null}
          versionsSlot={
            fullVideo ? (
              <FindClipsInVideoButton
                projectId={projectId}
                durationMs={bounds.clipEndMs - bounds.clipStartMs}
                onStarted={fvHighlights.startedFind}
              />
            ) : null
          }
        />
      {/* File > Versions / History and the project menu keep the full version manager accessible without a top-bar button. */}
      <div className="absolute left-24 top-9 z-40 h-px w-px overflow-visible" data-testid="editor-versions-anchor">
        <EditorVersionsMenu
          concealed
          enabled={versionsEnabled}
          versions={editVersions}
          onSaveVersion={(name) => void saveEditVersion(name)}
          onRestoreVersion={(id) => void restoreEditVersion(id)}
          onDeleteVersion={(id) => void deleteEditVersion(id)}
          onRestoreOriginal={() => void restoreOriginalEdits()}
        />
      </div>
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
          words={clipEditorWords as ClipWord[]}
          onRunPlanStep={(index, tools: ProducerToolCall[]) => {
            const cur = editsRef.current
            const res = applyProducerPlanStep(cur, bounds, clipEditorWords as ClipWord[], tools, index)
            if (res?.applied) {
              editsRef.current = res.edits
              setEditsPass(res.edits, res.label)
              return true
            }
            if (res && !res.applied) toast.message(`Producer: ${tools[index]?.name ?? 'step'} made no change`)
            return false
          }}
        />
      </EditorPanelErrorBoundary>
      <ClipFillerReview
        clipId={clipId}
        words={editorWords}
        edits={edits}
        clipBounds={{ clipStartMs: bounds.clipStartMs, clipEndMs: bounds.clipEndMs }}
        open={fillerReviewOpen}
        playing={playing}
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
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <EditorLayout
          unified={unifiedWorkspaceActive}
          unifiedTimelineView={layoutView}
          unifiedTimelineHidden={compact && !timelineOpen && !timelineFocused}
          unifiedTimelineCollapsed={timelineCollapsed && !timelineFocused}
          onUnifiedTimelineFocusChange={setTimelineFocused}
          onUnifiedTimelineViewChange={setLayoutViewPersist}
          unifiedMain={
            unifiedWorkspaceActive ? (
              <ScriptViewMainSplit
                transcriptPct={scriptSplitPct}
                onTranscriptPctChange={persistScriptSplit}
                className="h-full"
                minTranscriptPx={280}
                minPreviewPx={320}
                transcript={
                  <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-card" data-testid="unified-transcript-pane">
                    {renderTranscriptPanel({ largeScript: true, compactToolbar: true, documentView: true })}
                  </div>
                }
                preview={<div className="flex h-full min-h-0 min-w-0 overflow-hidden" data-testid="unified-video-preview">{previewColumnContent}</div>}
              />
            ) : null
          }
          band={band}
          compact={compact}
          panelOpen={dockTools ? dockPanelOpen : mobilePanelOpen}
          onClosePanel={() => (dockTools ? setDockPanelOpenPersist(false) : setMobilePanelOpen(false))}
          panelWidthPx={panelWidthPx}
          onPanelWidthChange={persistPanelWidth}
          hidePanelColumn={layoutView === 'script'}
          hidePropertiesColumn={layoutView === 'script' || dockTools}
          dockTools={dockTools}
          rail={
            <>
              <EditorMobileRail active={panel} onChange={selectPanel} onSelectGroup={selectRailGroup} />
              {dockTools ? (
                <div className="hidden min-w-0 items-stretch rounded-lg border border-border bg-card p-0.5 lg:flex" data-testid="timeline-dock-rail">
                  <button
                    type="button"
                    className={cn(
                      'flex h-10 min-w-[2.5rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-0.5 text-[0.625rem] leading-none text-muted-foreground hover:bg-accent hover:text-foreground [&_svg]:size-4',
                      dockPanelOpen && panel === 'inspector' && 'bg-accent text-foreground',
                    )}
                    onClick={() => {
                      if (dockPanelOpen && panel === 'inspector') setDockPanelOpenPersist(false)
                      else selectPanel('inspector')
                    }}
                    aria-label="Properties"
                    aria-pressed={dockPanelOpen && panel === 'inspector'}
                    data-testid="timeline-dock-properties"
                  >
                    <SlidersHorizontal className="size-5" aria-hidden />
                    Properties
                  </button>
                  <div className="min-w-0 flex-[8_1_0%]">
                    <EditorRail
                      variant="tabs"
                      active={panel}
                      onChange={(id) => (dockPanelOpen && panel === id ? setDockPanelOpenPersist(false) : selectPanel(id))}
                      onSelectGroup={(g) => (g === 'script' ? setLayoutViewPersist('script') : dockSelectGroup(g))}
                    />
                  </div>
                </div>
              ) : (
                <div className="hidden min-h-0 lg:block">
                  <EditorRail active={panel} onChange={selectPanel} onSelectGroup={selectRailGroup} />
                </div>
              )}
            </>
          }
          panel={
            <>
              <div className="flex min-h-10 shrink-0 flex-col justify-center gap-1 border-b border-border px-2.5 py-1">
                <div className="flex h-9 items-center gap-2">
                  <TabIcon className="size-4 text-muted-foreground" aria-hidden />
                  <h2 className="text-sm font-semibold">{meta.label}</h2>
                  <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">{meta.hint}</span>
                  {band === 'mobile' || band === 'compact' || dockTools ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setMobilePanelOpen(false)
                        setDockPanelOpenPersist(false)
                      }}
                      data-testid="timeline-dock-close"
                    >
                      Close
                    </Button>
                  ) : null}
                </div>
                {panelTabs.length > 1 ? (
                  <div className="flex gap-1 rounded-md border border-border/80 bg-muted/30 p-0.5" role="tablist" aria-label="Panel tabs">
                    {panelTabs.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={panel === t.id}
                        data-testid={`editor-panel-tab-${t.id}`}
                        className={cn(
                          'flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors',
                          panel === t.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                        )}
                        onClick={() => selectPanel(t.id)}
                      >
                        {t.tabLabel}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <div className={cn(panel === 'transcript' || panel === 'repurpose' ? 'p-0' : 'p-4')}>{panelBody}</div>
              </ScrollArea>
            </>
          }
          preview={
            layoutView === 'script' ? (
              <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
                <ScriptViewMainSplit
                  transcriptPct={scriptSplitPct}
                  onTranscriptPctChange={persistScriptSplit}
                  className="flex-1"
                  transcript={
                    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
                      <ScriptViewToolTabs
                        active={scriptToolPanel}
                        onSelect={(id) => {
                          selectPanel(id)
                          setScriptToolPanel(id)
                        }}
                        onShowScript={() => {
                          setScriptToolPanel(null)
                          setPanel('transcript')
                        }}
                      />
                      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-2" data-testid="script-workspace-content">
                        {scriptToolPanel == null
                          ? renderTranscriptPanel({ largeScript: true, compactToolbar: true })
                          : renderSidePanels(scriptToolPanel)}
                      </div>
                    </div>
                  }
                  preview={
                    <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden" data-testid="script-view-preview-stack">
                      {previewColumnContent}
                    </div>
                  }
                />
              </div>
            ) : (
              previewColumnContent
            )
          }
          properties={
            unifiedWorkspaceActive ? (
              <div className="flex h-full min-h-0 min-w-0" data-testid="unified-tools-content">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" data-testid="unified-inspector-body">
                  <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/70 px-3">
                    <h2 className="truncate text-sm font-semibold">{panel === 'transcript' ? 'Properties' : (TAB_META[panel]?.label ?? 'Tools')}</h2>
                  </div>
                  {panelTabs.length > 1 ? (
                    <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border/70 p-1" role="tablist" aria-label="Tool categories">
                      {panelTabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={panel === tab.id}
                          onClick={() => selectPanel(tab.id)}
                          className={cn('shrink-0 rounded px-2 py-1 text-xs', panel === tab.id ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-muted')}
                        >
                          {tab.tabLabel}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <ScrollArea className="min-h-0 flex-1">
                    <div className="p-3">
                      {panel === 'transcript' ? renderInspectorPropertiesPanel(true) : renderSidePanels(panel)}
                    </div>
                  </ScrollArea>
                </div>
                <EditorInspectorToolRail
                  active={SCRIPT_VIEW_TOOL_PANELS.some((item) => item.id === panel) ? panel as ScriptViewToolPanelId : null}
                  onSelect={selectPanel}
                  onShowScript={() => {
                    setPanel('transcript')
                    setScriptToolPanel(null)
                  }}
                />
              </div>
            ) : !dockTools && !compact && band === 'wide' && layoutView !== 'script' ? (
              <>
                <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
                  <h2 className="text-sm font-semibold">Properties</h2>
                </div>
                <ScrollArea className="min-h-0 flex-1">
                  <div className="p-4" data-testid="editor-panel-inspector">
                    {renderInspectorPropertiesPanel(true)}
                  </div>
                </ScrollArea>
              </>
            ) : null
          }
          timeline={
          layoutView === 'script' ? (
            <ScriptViewWaveStrip
              onShowTimeline={() => setLayoutViewPersist('timeline')}
              timelineSlot={
                <ScriptViewCompactTimeline
                  peaks={scriptVoicePeaks}
                  edits={edits}
                  words={editorWords}
                  trimInMs={edits.trim.in}
                  trimOutMs={edits.trim.out}
                  mediaOffsetMs={mediaOffsetMs}
                  outputDurationMs={outDur}
                  outputMs={outputMs}
                  videoUrl={videoUrl}
                  posterUrl={posterUrl}
                  editorAssets={editorAssets}
                  onSeekOutput={seekOutput}
                />
              }
            />
          ) : (
          <>
          {compact ? (
            <button
              type="button"
              data-testid="compact-timeline-toggle"
              aria-expanded={timelineOpen}
              className="flex h-8 w-full items-center justify-center gap-1 text-xs font-medium text-muted-foreground hover:bg-muted"
              onClick={toggleTimeline}
            >
              {timelineOpen ? 'Hide timeline' : 'Show timeline'}
            </button>
          ) : null}
          <div className={cn('h-full min-h-0 min-w-0 overflow-hidden', !timelineVisible && !timelineFocused && 'hidden')} data-testid="editor-timeline-wrap">
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
            mediaMinMs={editorWin.min}
            mediaMaxMs={editorWin.max}
            trimMinMs={bounds.trimMinMs != null && editorWin.min != null ? Math.max(bounds.trimMinMs, editorWin.min) : bounds.trimMinMs}
            trimMaxMs={bounds.trimMaxMs != null && editorWin.max != null ? Math.min(bounds.trimMaxMs, editorWin.max) : bounds.trimMaxMs}
            onSplitLayout={() => splitLayoutAtSource(playheadSourceMs)}
            onCutSection={() => cutSectionAtSource(playheadSourceMs)}
            onSetLayoutMode={(mode) => {
              logEditorDecision('layout', { clipId, mode, reason: 'timeline_segment' })
              setLayoutModeAtSource(playheadSourceMs, mode)
            }}
            onBrollChange={(id, patch) => updateBrollItem(id, patch)}
            onCommitEdits={commitTimelineEdits}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            historySlot={historyPanel}
            onCollapsedChange={setTimelineCollapsed}
            controlledCollapsed={timelineCollapsed}
            forceExpanded={timelineFocused}
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
            menuCommand={timelineMenuCmd}
            editorToolCommands={[
              ...editorMenus.flatMap((menu) => menu.groups.flatMap((group) => group.items.map((item) => ({
                id: `editor-${menu.id}-${item.id}`,
                group: menu.label,
                label: item.label,
                keys: item.shortcut,
                keywords: item.id === 'bg-removal' ? 'background cutout remove bg green screen chroma' : item.id === 'blur' ? 'face blur region mask privacy' : item.id === 'cleanup' ? 'clean fillers remove retakes edit clarity' : item.id === 'music' ? 'music audio sfx sound' : item.id === 'layout' ? 'layout aspect ratio crop 16:9 9:16' : '',
                run: item.onSelect,
                disabled: Boolean(item.disabledHint),
              })))),
              ...(['transcript', 'cleanup', 'layout', 'inspector', 'captions', 'text', 'audio', 'effects', 'media', 'layers', 'templates', 'broll', 'brand'] as EditorPanelId[]).map((id) => ({
                id: `editor-panel-${id}`,
                group: 'Editor tools',
                label: id === 'inspector' ? 'Properties / Inspector' : id === 'transcript' ? 'Script / Transcript' : id === 'cleanup' ? 'Clean up / Edit for clarity' : id[0]!.toUpperCase() + id.slice(1),
                keywords: id === 'inspector' ? 'transform rotation position scale' : id === 'effects' ? 'color filters speed adjustment' : id === 'audio' ? 'music sfx sound' : id === 'layout' ? 'aspect ratio background' : '',
                run: () => openToolPanel(id),
              })),
            ]}
            momentFocus={fvMoment}
            onMomentSeek={seekSource}
            highlights={
              fullVideo && fvHighlights.highlightsOn && (fvHighlights.ranges.length || fvHighlights.isJobRunning)
                ? {
                    picks: fvHighlights.picks,
                    ranges: fvHighlights.ranges,
                    selectedClipId: fvHighlights.selectedClipId,
                    durationMs: bounds.clipEndMs - bounds.clipStartMs,
                    jobRunning: fvHighlights.isJobRunning,
                    progress: fvHighlights.progress,
                    onSelect: (id) => fvHighlights.selectAndSeek(id),
                    onRangeChange: fvHighlights.onRangeChange,
                    onMakeClip: (pick, range) => void fvHighlights.onMakeClip(pick, range),
                    onOpenCard: fvHighlights.onOpenCard,
                    onSelectPrev: fvHighlights.selectPrev,
                    onSelectNext: fvHighlights.selectNext,
                  }
                : undefined
            }
          />
          </div>
          </>
          )}
        />
      </div>
      <Button
        type="button"
        size="icon"
        className="fixed bottom-4 right-4 z-40 size-12 rounded-full shadow-lg lg:hidden"
        aria-label="Open editor panel"
        onClick={() => setMobilePanelOpen(true)}
      >
        <PanelRightOpen className="size-5" />
      </Button>
      <TimelineShortcutsSheet open={editorShortcutsOpen} onClose={() => setEditorShortcutsOpen(false)} />
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
        posterUrl={posterUrl}
      />
      </ClipperSurfaceErrorBoundary>
      <Dialog open={projectSettingsOpen} onOpenChange={setProjectSettingsOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto" data-testid="project-settings-dialog">
          <DialogHeader>
            <DialogTitle>Project settings</DialogTitle>
          </DialogHeader>
          <PropertiesProjectSettings
            edits={edits}
            durationMs={outDur}
            layoutSlot={
              <LayoutQuickPicker
                value={edits.layout.mode}
                edits={edits}
                facecamLayout={facecamLayout}
                reframeV2Enabled={reframeV2Enabled}
                onPick={onLayoutPick}
                  onAspectChange={(aspect) => setEdits({ ...edits, aspectRatio: aspect })}
              />
            }
            canvasBgSlot={
              <CanvasBackgroundSection
                edits={edits}
                media={media}
                projectId={projectId}
                clipId={clipId}
                compositeLocked={compositePreviewClip}
                readOnly={Boolean(edits.timelineLanes?.video?.locked)}
                onCommit={(next) => setEdits(next)}
              />
            }
            onOpenTextPanel={() => {
              setProjectSettingsOpen(false)
              openToolPanel('text')
            }}
            onOpenCaptionsPanel={() => {
              setProjectSettingsOpen(false)
              openToolPanel('captions')
            }}
            onOpenLayoutPanel={() => {
              setProjectSettingsOpen(false)
              openToolPanel('layout')
            }}
          />
        </DialogContent>
      </Dialog>
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
