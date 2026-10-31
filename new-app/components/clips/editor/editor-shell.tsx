'use client'

import { Anton, Montserrat, Poppins } from 'next/font/google'
import { addFontVarsToBody, clipDisplayFontVars } from '@/components/clips/editor/clip-editor-fonts'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { keepSegments, outputDurationMs, displayDurationMs, displayPositionMs } from '@/lib/clips/edits'
import { playWithSound } from '@/lib/clips/video-playback'
import { EditorTopBar } from '@/components/clips/editor/editor-top-bar'
import { CaptionsPanel } from '@/components/clips/editor/captions-panel'
import { ExportDialog } from '@/components/clips/editor/export-dialog'
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
import { useSfxCues } from '@/components/clips/editor/use-sfx-cues'
import type { EditorAssets } from '@/lib/clips/editor/editor-assets'
import { applyTimelineLaneState, arrowStepMs, brollMediaForItems, voiceMuted } from '@/lib/clips/editor/clip-timeline'
import { useGeneration } from '@/components/clips/editor/use-generation'
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
import { useSetBreadcrumbTitle } from '@/components/shell/breadcrumb-context'
import { useSafeZoneVisible } from '@/lib/clips/use-safe-zone-visible'
import { EditorVersionsMenu, EditorLayoutMenu, type EditVersionRow } from '@/components/clips/editor/editor-versions-menu'
import { normalizeEdits, normalizeEditSpeed } from '@/lib/clips/edits'
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
import { useEditorWords } from '@/components/clips/editor/use-editor-words'
import { useEditorState } from '@/components/clips/editor/use-editor-state'
import { clipEditorAiExtrasEnabled } from '@/lib/clips/clip-editor-feature-flags'
import {
  vodChatOverlayEnabled,
  vodChatToggleHint,
  type VodChatMeta,
} from '@/lib/streamer/vod-chat-status'

const clipEditorAnton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-clip-anton' })
const clipEditorMontserrat = Montserrat({ subsets: ['latin'], weight: ['900'], variable: '--font-clip-montserrat' })
const clipEditorPoppins = Poppins({ subsets: ['latin'], weight: ['800'], variable: '--font-poppins' })

function isEditableTarget(t: EventTarget | null) {
  if (!t || !(t instanceof HTMLElement)) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable
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
  const [fillerReviewOpen, setFillerReviewOpen] = useState(false)
  const [gapReviewOpen, setGapReviewOpen] = useState(false)
  const [auditionEdits, setAuditionEdits] = useState<ClipEditsV2 | null>(null)
  // E4: Text / Color panels follow the timeline selection; ✨ Producer pop-over.
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
  const [colorTarget, setColorTarget] = useState<ColorTarget>({ kind: 'video' })
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
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const selectionRef = useRef<TranscriptSelection | null>(null)
  const seededExportTemplateRef = useRef(false)
  const {
    edits,
    undo,
    redo,
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
  } = useEditorState(clipId, bounds, initialEdits, { serverUpdatedAt, editsSaveVersion, words })

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
    if (next.exportTemplate !== edits.exportTemplate) hydrateEdits(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on open
  }, [])

  const { words: editorWords, wordsLoading } = useEditorWords(clipId, words, bounds, edits.trim)
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
          applyWordFixesBatch({}, {}, { vocabApplied: fp })
          return
        }
        const prevEdits = edits
        applyWordFixesBatch(batch.fixes, batch.meta, { vocabApplied: fp })
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
  const musicGenId = edits.audio?.music?.generationId ?? null
  const musicGen = useGeneration(musicGenId)
  const aiExtras = clipEditorAiExtrasEnabled()
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
  const displayEdits = useMemo(() => ({ ...editorPreviewEdits(edits, editorWords), speed: edits.speed }), [edits, editorWords])
  const displayDur = useMemo(() => displayDurationMs(displayEdits), [displayEdits])
  // E4fix: the clock shows output (exported) time on both sides — position warped like the duration.
  const displayPos = useMemo(() => Math.min(displayDur, displayPositionMs(displayEdits, outputMs)), [displayDur, displayEdits, outputMs])

  useEffect(() => {
    void clipsFetch<{ items: { id: string; name: string; settings: unknown }[] }>('/api/clips/brand/templates')
      .then((data) => setBrandTemplates(data.items ?? []))
      .catch(() => setBrandTemplates([]))
  }, [])
  const sfxPreview = useSfxCues(edits.audio?.sfx ?? [])
  const previewBrollMedia = useMemo(
    () => brollMediaForItems(edits.broll ?? [], brollMedia),
    [brollMedia, edits.broll],
  )
  // E4: per-item speed → the music bed follows the video rate (pitch-preserved like export atempo).
  const musicRate = renderEdits.segmentSpeeds?.length
    ? (normalizeEditSpeed(renderEdits.speed) ?? 1) * speedAtSource(renderEdits.segmentSpeeds, playheadSourceMs)
    : undefined
  const onTimelineSelection = useCallback(
    (item: TimelineItem | null) => {
      if (item?.lane === 'video' && item.srcInMs != null && item.srcOutMs != null) {
        setColorTarget({ kind: 'segment', fromMs: item.srcInMs, toMs: item.srcOutMs, label: item.label })
      } else if (item?.lane === 'broll') {
        setColorTarget({ kind: 'broll', id: item.id, label: item.label })
      } else {
        setColorTarget({ kind: 'video' })
      }
      if (item?.lane === 'text' && item.id !== 'hook') setSelectedTextId(item.id)
    },
    [],
  )
  useAudioMix({
    musicRate,
    videoRef,
    edits: renderEdits,
    words: duckWords,
    musicUrl: musicGen.downloadUrl,
    dubUrl: dubAudioUrl,
    useDubAudio,
    sfxCues: renderEdits.audio?.sfx?.length ? sfxPreview.cues : [],
    outputMs,
    playing,
    outputDurationMs: outDur,
    voiceMuted: laneVoiceMuted,
  })

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
      const v = videoRef.current
      if (!v) return
      const resume = keepPlayStateAcrossSeek(v)
      seekToOutputMs(v, editorPreviewEdits(edits, editorWords), ms, mediaOffsetMs)
      resume()
    },
    [edits, editorWords, mediaOffsetMs],
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      const v = videoRef.current
      if (e.code === 'Space' && v) {
        e.preventDefault()
        togglePlay()
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
  }, [deleteSelection, edits, outDur, outputMs, redo, undo])

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
  const meta = TAB_META[panel]
  const previewAspect = edits.aspectRatio ?? '9:16'
  const aspectStyle =
    previewAspect === '16:9'
      ? '16 / 9'
      : previewAspect === '1:1'
        ? '1 / 1'
        : previewAspect === '4:5'
          ? '4 / 5'
          : '9 / 16'
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
            onApplyProposal={onApplyCleanupProposal}
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
            brollMedia={brollMedia}
            onMergeBroll={mergeBroll}
            onSetBroll={setBroll}
            onRemoveBroll={removeBroll}
            onBrollMedia={mergeBrollMedia}
            onFlushEdits={() => void flushSave()}
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
      {panelMounted('color') ? (
        <div className={panel === 'color' ? undefined : 'hidden'} aria-hidden={panel !== 'color'} data-testid="editor-panel-color">
          <EditorPanelErrorBoundary label="Color">
          <ColorPanel edits={edits} target={colorTarget} onEdits={setEdits} onLive={(e) => setAuditionEdits(e ? applyTimelineLaneState(e) : null)} />
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
          onExport={() => setExportOpen(true)}
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
            <button
              type="button"
              className="absolute bottom-2 right-2 z-10 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white ring-1 ring-white/15"
              onClick={toggleLoopFriendly}
            >
              Loop trim {edits.loopFriendlyEnd === false ? 'off' : 'on'}
            </button>
            <EditorPanelErrorBoundary label="Preview">
            <PreviewStage
              videoUrl={videoUrl}
              posterUrl={posterUrl}
              edits={renderEdits}
              words={editorWords}
              previewWords={previewWords}
              brandLogoUrl={brandLogoUrl}
              cropTrack={cropTrack}
              brollMedia={previewBrollMedia}
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
            edits={edits}
            words={editorWords}
            shots={cropShots}
            outputMs={outputMs}
            clipOutputDurationMs={outDur}
            videoUrl={videoUrl}
            editorAssets={editorAssets}
            brollMedia={previewBrollMedia}
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
            mediaOffsetMs={mediaOffsetMs}
            musicUrl={musicGen.downloadUrl}
            sfxDurationsMs={sfxPreview.durationsMs}
            onOpenCover={() => selectPanel('thumbnail')}
            onSelectionChange={onTimelineSelection}
          />
          <PlayerControls
            playing={playing}
            outputMs={displayPos}
            outputDurationMs={displayDur}
            onToggle={() => void togglePlay()}
            onScrub={seekOutput}
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
          />
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
      />
      </ClipperSurfaceErrorBoundary>
    </div>
  )
}
