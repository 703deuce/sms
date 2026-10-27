'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { groupSpeakerBlocks } from '@/lib/clips/script-editor/group-speaker-blocks'
import {
  findActiveWordIndex,
  formatScriptTimecode,
  sourceTimeMsFromVideo,
  videoTimeSecFromSourceMs,
} from '@/lib/clips/script-editor/sync-playhead'
import { loadScriptEditorLayout, saveScriptEditorLayout } from '@/lib/clips/script-editor/panel-layout'
import { deriveEdl, outputTimeToSourceMs, sourceMsToOutputTime } from '@/lib/clips/script-edl/derive-edl'
import { isSourceMsInEdl, nextKeptSourceMs, outputDurationMs } from '@/lib/clips/script-edl/edl-playback'
import {
  clampOutputMs,
  edlUsesOutputClock,
  sourceMsAtOutput,
} from '@/lib/clips/script-editor/output-playback'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'
import type { ScriptCompositionOp } from '@/lib/clips/script-edl/ops'
import { useScriptComposition } from '@/components/script-editor/use-script-composition'
import { scrollWordIntoTranscriptPane } from '@/lib/clips/script-editor/scroll-word-into-view'
import { scrollWordToFollowPlayhead } from '@/lib/clips/script-editor/follow-playhead'
import { ScriptSelectionToolbar } from '@/components/script-editor/script-selection-toolbar'
import { TimelinePanel } from '@/components/script-editor/transport/timeline/timeline-panel'
import {
  buildWordChips,
  outputRangeForWordIndices,
  splitMarkerAfterWordIndex,
} from '@/lib/clips/script-editor/timeline-model'
import { markersByAfterWordIndex } from '@/lib/clips/script-editor/marker-word-index'
import { ScriptMarkerHeading } from '@/components/script-editor/markers/script-marker-heading'
import { CommentMentionTextarea } from '@/components/script-editor/comments/comment-mention-textarea'
import { toast } from 'sonner'
import {
  ArrowLeft,
  LayoutGrid,
  MessageSquare,
  Pause,
  Play,
  Redo2,
  Rows3,
  Scissors,
  Settings,
  Share2,
  Undo2,
} from 'lucide-react'
import {
  ScriptFillerReviewBar,
  type FillerSearchMode,
  type FillerSearchOptions,
  type FillerReviewAction,
} from '@/components/script-editor/script-filler-review-bar'
import { ScriptReframeCropOverlay } from '@/components/script-editor/preview/script-reframe-layer'
import { ScriptEditorRail, type ScriptSideTab } from '@/components/script-editor/script-editor-rail'
import { ScriptCaptionsPanel } from '@/components/script-editor/side/script-captions-panel'
import { ScriptPropertiesPanel } from '@/components/script-editor/side/script-properties-panel'
import { ScriptEditToolsPanel } from '@/components/script-editor/side/script-edit-tools-panel'
import { ScriptMediaPanel } from '@/components/script-editor/side/script-media-panel'
import { PreviewPillBar } from '@/components/script-editor/preview/preview-pill-bar'
import { ScriptCaptionOverlay } from '@/components/script-editor/preview/script-caption-overlay'
import { resolveScriptSettings } from '@/lib/clips/script-editor/default-settings'
import { formatGapChip, listFillerHits, type FillerFilter } from '@/lib/clips/script-editor/filler-hits'
import { gapMsBetween, listGapHits, type GapFilterMode, type GapHit } from '@/lib/clips/script-editor/gap-hits'
import { ScriptGapChipMenu } from '@/components/script-editor/script-gap-chip-menu'
import { useCompositionTabLock } from '@/components/script-editor/use-composition-tab-lock'
import {
  cropAtSourceMs,
  cropToVideoStyle,
  defaultCropForAspect,
} from '@/lib/clips/script-editor/reframe-keyframes'
import type { ReframeCropRect, ScriptAspect, ScriptEditorSettings } from '@/lib/clips/script-edl/types'
import type { EditToolsTab } from '@/components/script-editor/side/script-edit-tools-panel'
import { outputCutRegions } from '@/lib/clips/script-editor/cut-regions'
import { ScriptTranscriptContextMenu } from '@/components/script-editor/script-transcript-context-menu'
import { EditorRecorderBar } from '@/components/recording/editor/editor-recorder-bar'
import { useEditorRecorder } from '@/components/recording/editor/use-editor-recorder'
import { TeleprompterPanel } from '@/components/recording/editor/teleprompter-panel'
import { RoomsUploadCard } from '@/components/recording/rooms/upload-card'
import { ScriptExportPopover } from '@/components/script-editor/script-export-popover'
import { ScriptVersionHistoryPanel } from '@/components/script-editor/script-version-history-panel'
import { ScriptShortcutsSheet } from '@/components/script-editor/script-shortcuts-sheet'
import { ScriptActionBar, type ScriptAction } from '@/components/script-editor/script-action-bar'
import { nextMarkerOutMs, prevMarkerOutMs } from '@/lib/clips/script-editor/marker-nav'
import { nextSceneOutMs, prevSceneOutMs } from '@/lib/clips/script-editor/scene-nav'
import { buildAutoMulticamScenes } from '@/lib/clips/script-editor/multicam-scenes'
import { ScriptVuMeter } from '@/components/script-editor/transport/script-vu-meter'
import { ScriptClarityPanel } from '@/components/script-editor/side/script-clarity-panel'
import { ScriptMulticamPanel } from '@/components/script-editor/side/script-multicam-panel'
import { StudioSoundPreview } from '@/components/script-editor/studio-sound-preview'
import { useGeneration } from '@/components/clips/editor/use-generation'
import { ScriptPreviewCanvas } from '@/components/script-editor/preview/script-preview-canvas'
import { SpeakerRenamePopover } from '@/components/script-editor/speaker-rename-popover'
import { transcriptFindHits } from '@/lib/clips/script-editor/transcript-find'
import { ScriptStoryboardPanel } from '@/components/script-editor/storyboard/script-storyboard-panel'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { HelpCircle } from 'lucide-react'
import { useCompositionComments } from '@/components/script-editor/comments/use-composition-comments'
import { ScriptCommentsPanel } from '@/components/script-editor/comments/script-comments-panel'
import { ScriptMarkerListPopover } from '@/components/script-editor/markers/script-marker-list-popover'
import { ScriptProjectAccessModal } from '@/components/script-editor/share/script-project-access-modal'
import { ScriptEditorSettingsModal } from '@/components/script-editor/settings/script-editor-settings-modal'
import { CommentComposerPill } from '@/components/script-editor/comments/comment-composer-pill'
import { ScriptSlashMenu } from '@/components/script-editor/markers/script-slash-menu'
import { ScriptTimelineViewMenu } from '@/components/script-editor/transport/timeline/script-timeline-view-menu'
import { clipsFetch } from '@/lib/clips-api'
import type { ScriptEditorUserPreferences } from '@/lib/server/clips/editor-preferences'
import { useTheme } from 'next-themes'
import { ScriptCompositionSwitcher } from '@/components/script-editor/script-composition-switcher'
import { ScriptProjectPanel } from '@/components/script-editor/side/script-project-panel'
import { ScriptElementsPanel } from '@/components/script-editor/side/script-elements-panel'
import { ScriptLayoutsPanel } from '@/components/script-editor/side/script-layouts-panel'
import { ScriptAudioPanel } from '@/components/script-editor/side/script-audio-panel'
import type { ClipEditsAudio } from '@/lib/clips/audio'

export type ScriptBootstrapView = {
  projectId: string
  title: string
  durationMs: number
  mediaDurationMs?: number
  rangeStartMs: number
  wordCount: number
  sourceVideoUrl: string | null
  editorWords: EditorWord[]
  compositionId: string
  fullCompositionId?: string | null
  compositionRevision: number
  compositionKind?: 'FULL' | 'CLIP'
  clipId?: string | null
  clipStartMs?: number | null
  clipEndMs?: number | null
  surroundingContextIds?: string[]
  document: ScriptDocumentV1 | null
  compositions?: { id: string; kind: 'FULL' | 'CLIP'; clipId: string | null; title: string }[]
  clips: { id: string; title: string; startMs?: number; endMs?: number }[]
  status: string
}

function defaultDocument(words: EditorWord[]): ScriptDocumentV1 {
  const ids = words.map((w) => w.id)
  return { v: 1, keptWordIds: ids, deletedWordIds: [], wordOrder: ids }
}

function previewAspectClass(aspect: ScriptAspect): string {
  if (aspect === '1:1') return 'aspect-square'
  if (aspect === '4:5') return 'aspect-[4/5]'
  if (aspect === '16:9') return 'aspect-video'
  return 'aspect-[9/16]'
}

export function ScriptEditorShell({ data }: { data: ScriptBootstrapView }) {
  const initialDoc = data.document ?? defaultDocument(data.editorWords)
  const {
    document: serverDocument,
    saveState,
    deleteWords,
    restoreWords,
    applyOp,
    undo,
    redo,
    replaceFromServer,
    canUndo,
    canRedo,
  } = useScriptComposition({
    compositionId: data.compositionId,
    revision: data.compositionRevision,
    document: initialDoc,
  })
  const [previewDoc, setPreviewDoc] = useState<ScriptDocumentV1 | null>(null)
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [versionOpen, setVersionOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showResolvedComments, setShowResolvedComments] = useState(false)
  const [commentScope, setCommentScope] = useState<'clip' | 'full'>('clip')
  const [commentDraft, setCommentDraft] = useState('')
  const [commentMentionIds, setCommentMentionIds] = useState<string[]>([])
  const [composerMinimized, setComposerMinimized] = useState(false)
  const [slashMenu, setSlashMenu] = useState<{ x: number; y: number } | null>(null)
  const [showRulerMarkers, setShowRulerMarkers] = useState(true)
  const [showRulerComments, setShowRulerComments] = useState(true)
  const commentsApi = useCompositionComments(data.compositionId, {
    scope: commentScope,
    fullCompositionId: data.fullCompositionId ?? null,
  })
  const document = previewDoc ?? serverDocument
  const readOnlyPreview = previewDoc != null
  const tabLock = useCompositionTabLock(data.compositionId)
  const editingLocked = readOnlyPreview || tabLock.readOnly

  const safeApplyOp = useCallback(
    (op: ScriptCompositionOp) => {
      if (editingLocked) return
      applyOp(op)
    },
    [editingLocked, applyOp],
  )
  const safeDeleteWords = useCallback(
    (wordIds: string[]) => {
      if (editingLocked) return
      deleteWords(wordIds)
    },
    [editingLocked, deleteWords],
  )
  const safeRestoreWords = useCallback(
    (wordIds: string[]) => {
      if (editingLocked) return
      restoreWords(wordIds)
    },
    [editingLocked, restoreWords],
  )

  const videoRef = useRef<HTMLVideoElement>(null)
  const studioFx = document.audioFx?.studioSound
  const studioPreviewGen = useGeneration(
    studioFx?.enabled && studioFx.assetId ? studioFx.assetId : null,
  )
  const transcriptRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef(loadScriptEditorLayout())
  const [scriptWidthPct, setScriptWidthPct] = useState(layoutRef.current.scriptWidthPct)
  const [timelineExpanded, setTimelineExpanded] = useState(layoutRef.current.timelineExpanded)
  const [timelineView, setTimelineView] = useState<'timeline' | 'storyboard'>('timeline')
  const [timelineHeightPx, setTimelineHeightPx] = useState(layoutRef.current.timelineHeightPx)
  const [playheadMs, setPlayheadMs] = useState(data.rangeStartMs)
  const [playing, setPlaying] = useState(false)
  const [selAnchor, setSelAnchor] = useState<number | null>(null)
  const [selEnd, setSelEnd] = useState<number | null>(null)
  const [timelineFocused, setTimelineFocused] = useState(false)
  const [pxPerMs, setPxPerMs] = useState(0.08)
  const [scrollLeftPx, setScrollLeftPx] = useState(0)
  const dragSelectRef = useRef(false)
  const outputPlayAnchorRef = useRef<{ t: number; out0: number } | null>(null)
  const playheadMsRef = useRef(playheadMs)
  playheadMsRef.current = playheadMs
  const previewBoxRef = useRef<HTMLDivElement>(null)
  const [previewBoxH, setPreviewBoxH] = useState(480)
  const [sideOpen, setSideOpen] = useState(true)
  const [sideTab, setSideTab] = useState<ScriptSideTab>('properties')
  const [fillerReviewOpen, setFillerReviewOpen] = useState(false)
  const [fillerCursor, setFillerCursor] = useState(0)
  const [fillerFilter, setFillerFilter] = useState<FillerFilter>('all')
  const [fillerSelectionOnly, setFillerSelectionOnly] = useState(false)
  const [fillerAvoidHarsh, setFillerAvoidHarsh] = useState(true)
  const [fillerAction, setFillerAction] = useState<FillerReviewAction>('delete')
  const [fillerSearchMode, setFillerSearchMode] = useState<FillerSearchMode>('filler')
  const [fillerSearchQuery, setFillerSearchQuery] = useState('')
  const [findReplaceText, setFindReplaceText] = useState('')
  const [speakerRename, setSpeakerRename] = useState<{ speakerId: string; rect: DOMRect; initialName: string } | null>(
    null,
  )
  const [clarityOpen, setClarityOpen] = useState(false)
  const fillerFindIndexRef = useRef(0)
  const [fillerSearchOptions, setFillerSearchOptions] = useState<FillerSearchOptions>({
    autoAdvance: true,
    previewResults: false,
    matchWholeWords: false,
    matchCase: false,
    wrapAround: true,
    onlyCurrentComposition: true,
  })
  const [reviewMode, setReviewMode] = useState<'filler' | 'gap'>('filler')
  const [editToolsTab, setEditToolsTab] = useState<EditToolsTab>('filler')
  const [gapCursor, setGapCursor] = useState(0)
  const [gapMode, setGapMode] = useState<GapFilterMode>('more_than')
  const [minGapSec, setMinGapSec] = useState(1)
  const [maxGapSec, setMaxGapSec] = useState(3)
  const [targetGapSec, setTargetGapSec] = useState(0.3)
  const [gapSelectionOnly, setGapSelectionOnly] = useState(false)
  const [teleprompterOpen, setTeleprompterOpen] = useState(false)
  const editorRec = useEditorRecorder(data.projectId)
  const [draftCrop, setDraftCrop] = useState<ReframeCropRect | null>(null)
  const [hoverRestoreWordId, setHoverRestoreWordId] = useState<string | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [followPlayhead, setFollowPlayhead] = useState(true)
  const [selectionToolbarRect, setSelectionToolbarRect] = useState<DOMRect | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [actionBarOpen, setActionBarOpen] = useState(false)
  const isClipComposition = data.compositionKind === 'CLIP'
  const compositions = data.compositions ?? []
  const compositionTitle = useMemo(() => {
    const row = compositions.find((c) => c.id === data.compositionId)
    if (row?.title) return row.title
    return isClipComposition ? 'Clip composition' : 'Full video'
  }, [compositions, data.compositionId, isClipComposition])
  const [showSurrounding, setShowSurrounding] = useState(false)
  const [hoverIncludeWordId, setHoverIncludeWordId] = useState<string | null>(null)
  const [editorPrefs, setEditorPrefs] = useState<ScriptEditorUserPreferences | null>(null)
  const { setTheme } = useTheme()

  const wordsById = useMemo(() => new Map(data.editorWords.map((w) => [w.id, w])), [data.editorWords])
  const keptSet = useMemo(() => new Set(document.keptWordIds), [document.keptWordIds])
  const contextWordSet = useMemo(
    () => new Set(data.surroundingContextIds ?? []),
    [data.surroundingContextIds],
  )
  const settings = useMemo(
    () => resolveScriptSettings(document.settings, editorPrefs),
    [document.settings, editorPrefs],
  )
  const showDeletedWords = settings.showDeletedWords !== false
  const edl = useMemo(() => deriveEdl(document, wordsById, { padMs: 0 }), [document, wordsById])
  const deletedSet = useMemo(() => new Set(document.deletedWordIds), [document.deletedWordIds])
  const ignoredSet = useMemo(() => new Set(document.ignoredWordIds ?? []), [document.ignoredWordIds])
  const transcriptHiddenSet = useMemo(
    () => new Set(document.transcriptHiddenWordIds ?? []),
    [document.transcriptHiddenWordIds],
  )
  const orderedWords = useMemo(() => {
    const order = document.wordOrder ?? [...document.keptWordIds, ...document.deletedWordIds]
    return order.map((id) => wordsById.get(id)).filter((w): w is EditorWord => Boolean(w))
  }, [document, wordsById])

  const chips = useMemo(() => buildWordChips(document, orderedWords, edl, deletedSet), [document, orderedWords, edl, deletedSet])
  const blocks = useMemo(
    () => groupSpeakerBlocks(orderedWords, 1200, document.speakerLabels),
    [orderedWords, document.speakerLabels],
  )
  const activeIndex = useMemo(() => findActiveWordIndex(orderedWords, playheadMs), [orderedWords, playheadMs])

  const outDur = outputDurationMs(edl) || data.durationMs
  const timelineOutputMs = useMemo(() => {
    const edlEnd = edl.reduce(
      (m, s) => (s.kind === 'source' ? Math.max(m, s.outOutMs) : Math.max(m, s.outInMs + s.durMs)),
      0,
    )
    return Math.max(1, outDur, edlEnd)
  }, [edl, outDur])
  const lastSrcRel = useMemo(
    () => orderedWords.reduce((m, w) => Math.max(m, w.t1Ms), data.rangeStartMs) - data.rangeStartMs,
    [orderedWords, data.rangeStartMs],
  )
  const sourceSpanMs = Math.max(1, data.mediaDurationMs ?? 0, data.durationMs, lastSrcRel)
  const playheadOutMs = useMemo(
    () => sourceMsToOutputTime(playheadMs, edl) ?? Math.max(0, playheadMs - data.rangeStartMs),
    [playheadMs, edl, data.rangeStartMs],
  )
  const outputMs = playheadOutMs
  const cutRegions = useMemo(
    () => outputCutRegions(orderedWords, deletedSet, edl, data.rangeStartMs),
    [orderedWords, deletedSet, edl, data.rangeStartMs],
  )

  const commentedWordIds = useMemo(() => {
    const ids = new Set<string>()
    for (const t of commentsApi.threads) {
      if (t.resolvedAt) continue
      const i0 = t.anchorWordStart ? orderedWords.findIndex((w) => w.id === t.anchorWordStart) : -1
      const i1 = t.anchorWordEnd ? orderedWords.findIndex((w) => w.id === t.anchorWordEnd) : i0
      if (i0 >= 0 && i1 >= 0) {
        const lo = Math.min(i0, i1)
        const hi = Math.max(i0, i1)
        for (let i = lo; i <= hi; i++) ids.add(orderedWords[i].id)
      } else if (t.anchorWordStart) ids.add(t.anchorWordStart)
    }
    return ids
  }, [commentsApi.threads, orderedWords])

  const markersAfterIdx = useMemo(
    () => markersByAfterWordIndex(document, chips, orderedWords, edl),
    [document, chips, orderedWords, edl],
  )

  const markerAfterWordIndex = useMemo(() => {
    const map = new Map<string, number>()
    for (const [idx, list] of markersAfterIdx.entries()) {
      for (const m of list) map.set(m.id, idx)
    }
    return map
  }, [markersAfterIdx])

  const outMsAfterWordIndex = useCallback(
    (wordIdx: number) => {
      if (wordIdx < 0) return 0
      const chip = chips.find((c) => c.wordId === orderedWords[wordIdx]?.id)
      return chip?.outEndMs ?? outputMs
    },
    [chips, orderedWords, outputMs],
  )

  const moveMarkerAfterWord = useCallback(
    (markerId: string, deltaWords: number) => {
      const cur = markerAfterWordIndex.get(markerId) ?? 0
      const next = Math.max(-1, Math.min(orderedWords.length - 1, cur + deltaWords))
      applyOp({ type: 'update_marker', id: markerId, patch: { outMs: outMsAfterWordIndex(next) } })
    },
    [applyOp, markerAfterWordIndex, orderedWords.length, outMsAfterWordIndex],
  )

  const snapMarkerOutMs = useCallback(
    (raw: number) => {
      let best = Math.max(0, raw)
      let bestDist = Infinity
      for (const c of chips) {
        const d = Math.abs(c.outEndMs - raw)
        if (d < bestDist) {
          bestDist = d
          best = c.outEndMs
        }
      }
      return best
    },
    [chips],
  )

  const timelineClipSpans = useMemo(() => {
    if (data.compositionKind !== 'FULL' || !data.clips.length) return undefined
    return data.clips.map((c) => ({
      id: c.id,
      label: c.title,
      outStartMs: sourceMsToOutputTime(c.startMs ?? data.rangeStartMs, edl) ?? 0,
      outEndMs: sourceMsToOutputTime(c.endMs ?? data.rangeStartMs, edl) ?? outDur,
    }))
  }, [data.clips, data.compositionKind, data.rangeStartMs, edl, outDur])

  const markerListClips = useMemo(
    () =>
      timelineClipSpans?.map((c) => ({
        id: c.id,
        title: c.label,
        outStartMs: c.outStartMs,
        outEndMs: c.outEndMs,
      })),
    [timelineClipSpans],
  )

  useEffect(() => {
    void clipsFetch<ScriptEditorUserPreferences>('/api/clips/editor-preferences')
      .then((p) => {
        setEditorPrefs(p)
        if (p.showRulerMarkers != null) setShowRulerMarkers(p.showRulerMarkers)
        if (p.showRulerComments != null) setShowRulerComments(p.showRulerComments)
        if (p.theme) setTheme(p.theme)
      })
      .catch(() => {})
  }, [setTheme])

  const patchTimelineViewPrefs = useCallback((patch: { showRulerMarkers?: boolean; showRulerComments?: boolean }) => {
    if (patch.showRulerMarkers != null) setShowRulerMarkers(patch.showRulerMarkers)
    if (patch.showRulerComments != null) setShowRulerComments(patch.showRulerComments)
    void clipsFetch('/api/clips/editor-preferences', { method: 'PATCH', body: JSON.stringify(patch) }).catch(() => {})
  }, [])

  const submitCommentFromSelection = useCallback(async () => {
    if (selAnchor == null || selEnd == null) {
      setCommentsOpen(true)
      return
    }
    const lo = Math.min(selAnchor, selEnd)
    const hi = Math.max(selAnchor, selEnd)
    const range = outputRangeForWordIndices(chips, orderedWords, lo, hi)
    const quote = orderedWords
      .slice(lo, hi + 1)
      .map((w) => w.text)
      .join(' ')
      .slice(0, 500)
    const body = commentDraft.trim() || 'Comment'
    await commentsApi.createThread({
      body,
      startOutMs: range?.outLo ?? outputMs,
      endOutMs: range?.outHi ?? outputMs,
      anchorWordStart: orderedWords[lo]?.id,
      anchorWordEnd: orderedWords[hi]?.id,
      quoteText: quote,
      mentionedUserIds: commentMentionIds.length ? commentMentionIds : undefined,
    })
    setCommentDraft('')
    setCommentsOpen(true)
  }, [selAnchor, selEnd, chips, orderedWords, commentDraft, commentsApi, outputMs])

  const addMarkerAtPlayhead = useCallback(() => {
    applyOp({
      type: 'add_marker',
      outMs: outputMs,
      label: `Marker ${(document.markers?.length ?? 0) + 1}`,
      exportAsChapter: true,
    })
  }, [applyOp, document.markers?.length, outputMs])

  const persistLayout = useCallback(() => {
    saveScriptEditorLayout({
      scriptWidthPct,
      timelineExpanded,
      timelineHeightPx,
    })
  }, [scriptWidthPct, timelineExpanded, timelineHeightPx])

  useEffect(() => {
    persistLayout()
  }, [persistLayout])

  const syncFromVideo = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (playing && edlUsesOutputClock(edl)) return
    let srcMs = sourceTimeMsFromVideo(v.currentTime, data.rangeStartMs)
    if (!isSourceMsInEdl(srcMs, edl)) {
      const jump = nextKeptSourceMs(srcMs, edl)
      if (jump != null) {
        v.currentTime = videoTimeSecFromSourceMs(jump, data.rangeStartMs)
        srcMs = jump
      }
    }
    setPlayheadMs(srcMs)
    setPlaying(!v.paused)
  }, [data.rangeStartMs, edl, playing])

  useEffect(() => {
    if (!playing || !edlUsesOutputClock(edl)) return
    const v = videoRef.current
    if (!v) return
    if (!outputPlayAnchorRef.current) {
      const out0 =
        sourceMsToOutputTime(playheadMsRef.current, edl) ??
        Math.max(0, playheadMsRef.current - data.rangeStartMs)
      outputPlayAnchorRef.current = { t: performance.now(), out0 }
    }
    const anchor = outputPlayAnchorRef.current
    let raf = 0
    const tick = () => {
      const out = clampOutputMs(anchor.out0 + (performance.now() - anchor.t), edl)
      if (out >= outDur - 8) {
        v.pause()
        setPlaying(false)
        outputPlayAnchorRef.current = null
        return
      }
      const src = sourceMsAtOutput(out, edl, playheadMsRef.current)
      v.currentTime = videoTimeSecFromSourceMs(src, data.rangeStartMs)
      setPlayheadMs(src)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, edl, outDur, data.rangeStartMs])

  const seekToSourceMs = useCallback(
    (ms: number) => {
      const v = videoRef.current
      if (!v) return
      const t = videoTimeSecFromSourceMs(ms, data.rangeStartMs)
      v.currentTime = t
      setPlayheadMs(ms)
    },
    [data.rangeStartMs],
  )

  const seekToOutputMs = useCallback(
    (out: number) => {
      const src = outputTimeToSourceMs(out, edl)
      if (src != null) seekToSourceMs(src)
    },
    [edl, seekToSourceMs],
  )

  const wordIndex = useCallback((id: string) => orderedWords.findIndex((w) => w.id === id), [orderedWords])

  const selectedIds = useMemo(() => {
    if (selAnchor == null || selEnd == null) return new Set<string>()
    const lo = Math.min(selAnchor, selEnd)
    const hi = Math.max(selAnchor, selEnd)
    const ids = new Set<string>()
    for (let i = lo; i <= hi; i++) {
      const w = orderedWords[i]
      if (!w) continue
      if (!showDeletedWords && deletedSet.has(w.id)) continue
      ids.add(w.id)
    }
    return ids
  }, [selAnchor, selEnd, orderedWords, deletedSet, showDeletedWords])

  const selectedDeletedIds = useMemo(() => {
    const ids: string[] = []
    for (const id of selectedIds) {
      if (deletedSet.has(id)) ids.push(id)
    }
    return ids
  }, [selectedIds, deletedSet])

  const selectedKeptIds = useMemo(() => {
    const ids: string[] = []
    for (const id of selectedIds) {
      if (!deletedSet.has(id)) ids.push(id)
    }
    return ids
  }, [selectedIds, deletedSet])

  const restoreIgnoredForWord = useCallback(
    (wordId: string) => {
      if (!ignoredSet.has(wordId)) return
      safeApplyOp({ type: 'restore_ignored', wordIds: [wordId] })
      toast.success('Restored word')
    },
    [ignoredSet, applyOp],
  )

  const restoreCutForWord = useCallback(
    (wordId: string) => {
      const idx = orderedWords.findIndex((w) => w.id === wordId)
      if (idx < 0 || !deletedSet.has(wordId)) return
      const ids: string[] = []
      for (let i = idx; i >= 0; i--) {
        const w = orderedWords[i]
        if (!w || !deletedSet.has(w.id)) break
        ids.unshift(w.id)
      }
      for (let i = idx + 1; i < orderedWords.length; i++) {
        const w = orderedWords[i]
        if (!w || !deletedSet.has(w.id)) break
        ids.push(w.id)
      }
      restoreWords(ids)
      toast.success('Restored cut')
    },
    [orderedWords, deletedSet, restoreWords],
  )

  const selectedIgnoredIds = useMemo(() => {
    const ids: string[] = []
    for (const id of selectedIds) {
      if (ignoredSet.has(id)) ids.push(id)
    }
    return ids
  }, [selectedIds, ignoredSet])

  const onRestoreSelection = useCallback(() => {
    if (selectedDeletedIds.length) {
      restoreWords(selectedDeletedIds)
      setSelAnchor(null)
      setSelEnd(null)
      toast.success('Restored selection')
      return
    }
    if (selectedIgnoredIds.length) {
      safeApplyOp({ type: 'restore_ignored', wordIds: selectedIgnoredIds })
      setSelAnchor(null)
      setSelEnd(null)
      toast.success('Restored ignored words')
    }
  }, [selectedDeletedIds, selectedIgnoredIds, restoreWords, applyOp])

  const onIgnoreSelection = useCallback(() => {
    if (!selectedKeptIds.length) return
    safeApplyOp({ type: 'ignore_words', wordIds: selectedKeptIds.filter((id) => !ignoredSet.has(id)) })
    setSelAnchor(null)
    setSelEnd(null)
  }, [selectedKeptIds, ignoredSet, applyOp])

  const fillerHits = useMemo(
    () =>
      listFillerHits(orderedWords, deletedSet, {
        filter: fillerFilter,
        selectionOnly: fillerSelectionOnly,
        selectedIds: selectedIds,
        avoidHarshCuts: fillerAvoidHarsh,
        ignoredSet,
      }),
    [orderedWords, deletedSet, fillerFilter, fillerSelectionOnly, selectedIds, fillerAvoidHarsh, ignoredSet],
  )

  const findHits = useMemo(
    () =>
      transcriptFindHits(orderedWords, deletedSet, fillerSearchQuery, document.wordTextOverrides, {
        matchCase: fillerSearchOptions.matchCase,
        matchWholeWords: fillerSearchOptions.matchWholeWords,
      }),
    [
      orderedWords,
      deletedSet,
      fillerSearchQuery,
      document.wordTextOverrides,
      fillerSearchOptions.matchCase,
      fillerSearchOptions.matchWholeWords,
    ],
  )

  const activeFillerHit = fillerHits[fillerCursor] ?? null
  const activeFindHit = findHits[fillerCursor] ?? null

  const gapHits = useMemo(
    () =>
      listGapHits(orderedWords, deletedSet, {
        mode: gapMode,
        minGapMs: Math.round(minGapSec * 1000),
        maxGapMs: Math.round(maxGapSec * 1000),
        selectionOnly: gapSelectionOnly || (reviewMode === 'gap' && fillerSelectionOnly),
        selectedIds: selectedIds,
        document,
      }),
    [
      orderedWords,
      deletedSet,
      gapMode,
      minGapSec,
      maxGapSec,
      gapSelectionOnly,
      fillerSelectionOnly,
      reviewMode,
      selectedIds,
      document,
    ],
  )

  const activeGapHit = gapHits[gapCursor] ?? null
  const inFindMode = fillerReviewOpen && fillerSearchMode === 'find' && reviewMode === 'filler'
  const reviewTotal = reviewMode === 'gap' ? gapHits.length : inFindMode ? findHits.length : fillerHits.length
  const reviewCursor = reviewMode === 'gap' ? gapCursor : fillerCursor

  const keptWords = useMemo(
    () => orderedWords.filter((w) => !deletedSet.has(w.id) && !ignoredSet.has(w.id)),
    [orderedWords, deletedSet, ignoredSet],
  )

  const captionWords = useMemo(
    () => keptWords.filter((w) => !transcriptHiddenSet.has(w.id)),
    [keptWords, transcriptHiddenSet],
  )

  const baseCrop = useMemo(
    () => defaultCropForAspect(settings.aspect ?? '9:16'),
    [settings.aspect],
  )

  const sourceMsAtPlayhead = useMemo(() => {
    const rel = sourceMsAtOutput(outputMs, edl, playheadMs - data.rangeStartMs)
    return data.rangeStartMs + rel
  }, [data.rangeStartMs, edl, outputMs, playheadMs])

  const liveCrop = useMemo(() => {
    if (draftCrop) return draftCrop
    if (settings.reframeMode === 'center_crop') return { ...baseCrop, cx: 50, cy: 50 }
    return cropAtSourceMs(document.reframeKeyframes, sourceMsAtPlayhead, baseCrop)
  }, [draftCrop, settings.reframeMode, document.reframeKeyframes, sourceMsAtPlayhead, baseCrop])

  const videoCropStyle = useMemo(() => cropToVideoStyle(liveCrop), [liveCrop])

  const patchSettings = useCallback(
    (patch: Partial<ScriptEditorSettings>) => {
      safeApplyOp({ type: 'patch_settings', patch })
    },
    [applyOp],
  )

  useEffect(() => {
    if (inFindMode) {
      if (fillerCursor >= findHits.length) setFillerCursor(Math.max(0, findHits.length - 1))
    } else if (fillerCursor >= fillerHits.length) setFillerCursor(Math.max(0, fillerHits.length - 1))
  }, [fillerCursor, fillerHits.length, findHits.length, inFindMode])

  useEffect(() => {
    setFillerCursor(0)
    fillerFindIndexRef.current = 0
  }, [fillerSearchQuery, fillerSearchMode])

  useEffect(() => {
    if (gapCursor >= gapHits.length) setGapCursor(Math.max(0, gapHits.length - 1))
  }, [gapCursor, gapHits.length])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const pct = settings.volumePct ?? 100
    v.volume = Math.min(2, Math.max(0, pct / 100))
  }, [settings.volumePct])

  useEffect(() => {
    const el = previewBoxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setPreviewBoxH(el.clientHeight))
    ro.observe(el)
    setPreviewBoxH(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  const openFillerTools = useCallback(() => {
    setSideOpen(true)
    setSideTab('edit')
    setEditToolsTab('filler')
    setReviewMode('filler')
    setFillerSearchMode('filler')
    setFillerReviewOpen(true)
  }, [])

  const openGapTools = useCallback(() => {
    setSideOpen(true)
    setSideTab('edit')
    setEditToolsTab('gaps')
    setReviewMode('gap')
    setFillerSearchMode('gaps')
    setFillerReviewOpen(true)
  }, [])

  const applyFillerActionToHits = useCallback(
    (action: FillerReviewAction, hits: { word: EditorWord }[]) => {
      if (!hits.length) return
      const wordIds = hits.map((h) => h.word.id)
      let savedMs = 0
      if (action === 'delete' || action === 'replace_with_gap') {
        savedMs = hits.reduce((s, h) => s + (h.word.t1Ms - h.word.t0Ms), 0)
      }
      if (action === 'replace_with_gap') {
        const gapAtOutMs: Record<string, number> = {}
        let maxDur = 1
        for (const h of hits) {
          const out = sourceMsToOutputTime(h.word.t0Ms, edl)
          if (out != null) gapAtOutMs[h.word.id] = out
          maxDur = Math.max(maxDur, h.word.t1Ms - h.word.t0Ms)
        }
        safeApplyOp({
          type: 'word_batch_action',
          action: 'replace_with_gap',
          wordIds,
          gapAtOutMs,
          gapDurMs: Math.max(1, Math.round(maxDur)),
        })
      } else {
        safeApplyOp({ type: 'word_batch_action', action, wordIds })
      }
      toast.success(`Applied to ${wordIds.length} word(s)${savedMs ? ` (−${(savedMs / 1000).toFixed(1)} s)` : ''}. Undo`)
    },
    [applyOp, edl],
  )

  const onRemoveOneFiller = useCallback(() => {
    if (reviewMode === 'gap') {
      const hit = gapHits[gapCursor]
      if (!hit) return
      const targetMs = Math.round(targetGapSec * 1000)
      safeApplyOp({
        type: 'shorten_gap_before',
        wordId: hit.word.id,
        prevWordId: hit.prevWord.id,
        gapMs: hit.gapMs,
        targetGapMs: targetMs,
      })
      const saved = Math.max(0, hit.gapMs - targetMs)
      toast.success(`Shortened gap (−${(saved / 1000).toFixed(1)} s). Undo`)
      if (fillerSearchOptions.autoAdvance) setGapCursor((c) => Math.min(c, Math.max(0, gapHits.length - 2)))
      return
    }
    const hit = fillerHits[fillerCursor]
    if (!hit) return
    applyFillerActionToHits(fillerAction, [hit])
    if (fillerSearchOptions.autoAdvance) setFillerCursor((c) => Math.min(c, Math.max(0, fillerHits.length - 2)))
  }, [
    reviewMode,
    gapHits,
    gapCursor,
    targetGapSec,
    applyOp,
    fillerSearchOptions.autoAdvance,
    fillerHits,
    fillerCursor,
    fillerAction,
    applyFillerActionToHits,
  ])

  const onRemoveAllFillers = useCallback(() => {
    if (reviewMode === 'gap') {
      const targetMs = Math.round(targetGapSec * 1000)
      const items = gapHits.map((h) => ({
        wordId: h.word.id,
        prevWordId: h.prevWord.id,
        gapMs: h.gapMs,
        targetGapMs: targetMs,
      }))
      const saved = gapHits.reduce((s, h) => s + Math.max(0, h.gapMs - targetMs), 0)
      safeApplyOp({ type: 'shorten_gaps_batch', items })
      toast.success(`Shortened ${items.length} gap(s) (−${(saved / 1000).toFixed(1)} s). Undo`)
      setFillerReviewOpen(false)
      return
    }
    applyFillerActionToHits(fillerAction, fillerHits)
    setFillerReviewOpen(false)
  }, [reviewMode, gapHits, targetGapSec, applyOp, fillerAction, fillerHits, applyFillerActionToHits])

  const replaceInToken = useCallback(
    (text: string, query: string, replacement: string) => {
      const q = query.trim()
      if (!q) return text
      if (fillerSearchOptions.matchWholeWords) {
        const re = new RegExp(
          `\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
          fillerSearchOptions.matchCase ? '' : 'i',
        )
        return text.replace(re, replacement)
      }
      const idx = fillerSearchOptions.matchCase
        ? text.indexOf(q)
        : text.toLowerCase().indexOf(q.toLowerCase())
      if (idx < 0) return text
      return text.slice(0, idx) + replacement + text.slice(idx + q.length)
    },
    [fillerSearchOptions.matchCase, fillerSearchOptions.matchWholeWords],
  )

  const goToFindHit = useCallback(
    (hit: { word: EditorWord; index: number }) => {
      setSelAnchor(hit.index)
      setSelEnd(hit.index)
      const out = sourceMsToOutputTime(hit.word.t0Ms, edl)
      if (out != null) seekToOutputMs(out)
    },
    [edl, seekToOutputMs],
  )

  const onReplaceOneFind = useCallback(() => {
    const hit = findHits[fillerCursor]
    const q = fillerSearchQuery.trim()
    if (!hit || !q) return
    const current = document.wordTextOverrides?.[hit.word.id] ?? hit.word.text
    const next = replaceInToken(current, q, findReplaceText)
    safeApplyOp({
      type: 'patch_word_text_overrides',
      overrides: { [hit.word.id]: next },
      mode: 'merge',
    })
    toast.success('Replaced · Undo')
    if (fillerSearchOptions.autoAdvance && findHits.length > 1) {
      const nextIdx = (fillerCursor + 1) % findHits.length
      setFillerCursor(nextIdx)
      goToFindHit(findHits[nextIdx]!)
    }
  }, [
    findHits,
    fillerCursor,
    fillerSearchQuery,
    document.wordTextOverrides,
    replaceInToken,
    findReplaceText,
    safeApplyOp,
    fillerSearchOptions.autoAdvance,
    goToFindHit,
  ])

  const onReplaceAllFind = useCallback(() => {
    const q = fillerSearchQuery.trim()
    if (!q || !findHits.length) return
    const overrides: Record<string, string> = {}
    for (const h of findHits) {
      const current = document.wordTextOverrides?.[h.word.id] ?? h.word.text
      overrides[h.word.id] = replaceInToken(current, q, findReplaceText)
    }
    safeApplyOp({ type: 'patch_word_text_overrides', overrides, mode: 'merge' })
    toast.success(`Replaced in ${findHits.length} word(s) · Undo`)
  }, [findHits, fillerSearchQuery, document.wordTextOverrides, replaceInToken, findReplaceText, safeApplyOp])

  const onSelectGapHit = useCallback(
    (hit: GapHit) => {
      setGapCursor(gapHits.findIndex((h) => h.word.id === hit.word.id))
      setSelAnchor(hit.index)
      setSelEnd(hit.index)
      seekToSourceMs(Math.max(data.rangeStartMs, hit.word.t0Ms - 1000))
    },
    [data.rangeStartMs, gapHits, seekToSourceMs],
  )

  const commitReframeKeyframe = useCallback(() => {
    const crop = draftCrop ?? liveCrop
    safeApplyOp({ type: 'set_reframe_keyframe', srcMs: Math.round(playheadMs), crop })
    setDraftCrop(null)
    patchSettings({ reframeMode: 'manual' })
  }, [safeApplyOp, draftCrop, liveCrop, patchSettings, playheadMs])

  const onSelectFillerHit = useCallback(
    (hit: { index: number; word: EditorWord }) => {
      setFillerCursor(fillerHits.findIndex((h) => h.word.id === hit.word.id))
      setSelAnchor(hit.index)
      setSelEnd(hit.index)
      seekToSourceMs(Math.max(data.rangeStartMs, hit.word.t0Ms - 1000))
    },
    [data.rangeStartMs, fillerHits, seekToSourceMs],
  )

  const onWordPointerDown = (idx: number, w: EditorWord, shift: boolean) => {
    dragSelectRef.current = true
    if (shift && selAnchor != null) setSelEnd(idx)
    else {
      setSelAnchor(idx)
      setSelEnd(idx)
    }
    seekToSourceMs(w.t0Ms)
  }

  const onWordPointerEnter = (idx: number) => {
    if (!dragSelectRef.current) return
    setSelEnd(idx)
  }

  useEffect(() => {
    const endDrag = () => {
      dragSelectRef.current = false
    }
    window.addEventListener('mouseup', endDrag)
    window.addEventListener('pointerup', endDrag)
    return () => {
      window.removeEventListener('mouseup', endDrag)
      window.removeEventListener('pointerup', endDrag)
    }
  }, [])

  useEffect(() => {
    const container = transcriptRef.current
    if (!container) return
    const onScroll = () => {
      if (playing) setFollowPlayhead(false)
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [playing])

  useEffect(() => {
    if (selAnchor == null || selEnd == null) {
      setSelectionToolbarRect(null)
      return
    }
    const lo = Math.min(selAnchor, selEnd)
    const hi = Math.max(selAnchor, selEnd)
    const first = transcriptRef.current?.querySelector(`[data-word-idx="${lo}"]`)
    const last = transcriptRef.current?.querySelector(`[data-word-idx="${hi}"]`)
    if (first instanceof HTMLElement && last instanceof HTMLElement) {
      const r1 = first.getBoundingClientRect()
      const r2 = last.getBoundingClientRect()
      setSelectionToolbarRect(
        new DOMRect(
          Math.min(r1.left, r2.left),
          Math.min(r1.top, r2.top),
          Math.max(r1.right, r2.right) - Math.min(r1.left, r2.left),
          Math.max(r1.bottom, r2.bottom) - Math.min(r1.top, r2.top),
        ),
      )
    } else {
      setSelectionToolbarRect(null)
    }
  }, [selAnchor, selEnd, orderedWords, playheadMs])

  const onDeleteSelection = useCallback(() => {
    if (selectedDeletedIds.length && !selectedKeptIds.length) {
      onRestoreSelection()
      return
    }
    const ids = selectedKeptIds.length ? [...selectedKeptIds] : []
    if (!ids.length && selAnchor != null) {
      const w = orderedWords[selAnchor]
      if (w) {
        if (deletedSet.has(w.id)) {
          restoreCutForWord(w.id)
          setSelAnchor(null)
          setSelEnd(null)
          return
        }
        ids.push(w.id)
      }
    }
    if (ids.length) {
      safeDeleteWords(ids)
      setSelAnchor(null)
      setSelEnd(null)
    }
  }, [
    selectedDeletedIds,
    selectedKeptIds,
    selAnchor,
    orderedWords,
    deletedSet,
    deleteWords,
    onRestoreSelection,
    restoreCutForWord,
  ])

  const onReplaceSelectionWithGap = useCallback(() => {
    if (selAnchor == null || selEnd == null) return
    const lo = Math.min(selAnchor, selEnd)
    const hi = Math.max(selAnchor, selEnd)
    const range = outputRangeForWordIndices(chips, orderedWords, lo, hi)
    if (!range) return
    const durMs = Math.max(1, Math.round(range.outHi - range.outLo))
    const wordIds: string[] = []
    for (let i = lo; i <= hi; i++) {
      const w = orderedWords[i]
      if (w && !deletedSet.has(w.id)) wordIds.push(w.id)
    }
    if (!wordIds.length) return
    safeApplyOp({ type: 'replace_with_gap', wordIds, atOutMs: Math.round(range.outLo), durMs })
    setSelAnchor(null)
    setSelEnd(null)
  }, [selAnchor, selEnd, chips, orderedWords, deletedSet, applyOp])

  const onSplitAtPlayhead = useCallback(() => {
    safeApplyOp({ type: 'add_split', outMs: Math.round(outputMs) })
  }, [applyOp, outputMs])

  const onZoom = useCallback(
    (factor: number, anchorOutMs: number) => {
      setPxPerMs((prev) => {
        const next = Math.min(0.5, Math.max(0.005, prev * factor))
        const anchorPx = anchorOutMs * prev
        const newAnchorPx = anchorOutMs * next
        setScrollLeftPx((s) => Math.max(0, s + (anchorPx - newAnchorPx)))
        return next
      })
    },
    [],
  )

  const onFit = useCallback(() => {
    const scroller = globalThis.document.querySelector('[data-timeline-scroller]') as HTMLElement | null
    if (!scroller) return
    const viewW = scroller.clientWidth
    if (viewW < 48) return
    const laneLabelW = 56
    setPxPerMs(Math.max(0.005, (viewW - laneLabelW) / Math.max(1, timelineOutputMs)))
    setScrollLeftPx(0)
  }, [timelineOutputMs])

  useEffect(() => {
    if (!timelineExpanded) return
    const id = requestAnimationFrame(() => onFit())
    return () => cancelAnimationFrame(id)
  }, [timelineExpanded, timelineOutputMs, onFit])

  const seekToSourceRelativeMs = useCallback(
    (srcRelMs: number) => {
      seekToSourceMs(data.rangeStartMs + Math.max(0, Math.min(sourceSpanMs, srcRelMs)))
    },
    [data.rangeStartMs, seekToSourceMs, sourceSpanMs],
  )

  const onTrimClipEdge = useCallback(
    (clipKey: string, edge: 'start' | 'end', deltaOutMs: number) => {
      if (Math.abs(deltaOutMs) < 20) return
      const clip = clipKey.match(/^src-(\d+)-(\d+)$/)
      if (!clip) return
      const outStart = Number(clip[1])
      const outEnd = Number(clip[2])
      const targetOut = edge === 'end' ? outEnd + deltaOutMs : outStart + deltaOutMs
      const ids: string[] = []
      if (edge === 'end' && deltaOutMs < 0) {
        for (const c of chips) {
          if (c.outStartMs >= targetOut && c.outStartMs <= outEnd) ids.push(c.wordId)
        }
        if (ids.length) safeDeleteWords(ids)
      } else if (edge === 'end' && deltaOutMs > 0) {
        for (const w of orderedWords) {
          if (deletedSet.has(w.id)) continue
          const out = sourceMsToOutputTime(w.t1Ms, edl)
          if (out != null && out > outEnd && out <= targetOut) ids.push(w.id)
        }
        if (ids.length) safeApplyOp({ type: 'restore_words', wordIds: ids })
      }
    },
    [chips, deleteWords, orderedWords, deletedSet, edl, applyOp],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault()
        setTimelineExpanded((v) => !v)
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        setTimelineExpanded((v) => !v)
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        onZoom(1.15, outputMs)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault()
        onZoom(1 / 1.15, outputMs)
      }

      if (e.key === 'Escape') {
        if (commentsOpen && (commentDraft.trim() || selAnchor != null) && !composerMinimized) {
          e.preventDefault()
          setComposerMinimized(true)
          return
        }
        if (composerMinimized) {
          e.preventDefault()
          setComposerMinimized(false)
          return
        }
        if (!followPlayhead) {
          e.preventDefault()
          setFollowPlayhead(true)
          return
        }
      }

      if (e.key === ' ' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        const v = videoRef.current
        if (v) {
          if (e.shiftKey) {
            seekToOutputMs(outputMs)
            if (v.paused) {
              if (edlUsesOutputClock(edl)) {
                outputPlayAnchorRef.current = { t: performance.now(), out0: outputMs }
              }
              void v.play()
            }
          } else if (v.paused) {
            if (edlUsesOutputClock(edl)) {
              outputPlayAnchorRef.current = { t: performance.now(), out0: outputMs }
            }
            void v.play()
          } else {
            outputPlayAnchorRef.current = null
            v.pause()
          }
        }
        return
      }

      if (e.key === 'Home') {
        e.preventDefault()
        seekToOutputMs(0)
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault()
        setTimelineExpanded(false)
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setSelAnchor(0)
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setReviewMode('filler')
        setFillerSearchMode('find')
        setFillerReviewOpen(true)
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g' && !e.shiftKey) {
        e.preventDefault()
        if (!findHits.length) return
        const next = (fillerCursor + 1) % findHits.length
        setFillerCursor(next)
        goToFindHit(findHits[next]!)
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        if (!findHits.length) return
        const prev = (fillerCursor - 1 + findHits.length) % findHits.length
        setFillerCursor(prev)
        goToFindHit(findHits[prev]!)
        return
      }

      if (e.altKey && e.metaKey && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        setSideTab('properties')
        setSideOpen(true)
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === '.' || e.code === 'Period')) {
        e.preventDefault()
        const next = nextSceneOutMs(document, orderedWords, edl, outputMs)
        if (next != null) seekToOutputMs(next)
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === ',') {
        e.preventDefault()
        const prev = prevSceneOutMs(document, orderedWords, edl, outputMs)
        if (prev != null) seekToOutputMs(prev)
      }

      if (e.key === '#' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement | null)?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault()
          safeApplyOp({
            type: 'add_marker',
            outMs: Math.round(outputMs),
            id: `mrk_${crypto.randomUUID().replace(/-/g, '')}`,
            label: `Marker ${(document.markers?.length ?? 0) + 1}`,
          })
          toast.success('Marker at playhead')
        }
      }

      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement | null)?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault()
          const idx = selAnchor ?? activeIndex
          const w = idx >= 0 ? orderedWords[idx] : undefined
          if (w) {
            safeApplyOp({
              type: 'add_scene_at_word',
              wordId: w.id,
              sceneId: `scn_${crypto.randomUUID().replace(/-/g, '')}`,
            })
            toast.success('Scene added at playhead')
          }
        }
      }

      if (e.key === 's' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        onSplitAtPlayhead()
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault()
        addMarkerAtPlayhead()
      }

      if ((e.metaKey || e.ctrlKey) && e.altKey && e.code === 'KeyM') {
        e.preventDefault()
        setCommentsOpen(true)
        void submitCommentFromSelection()
      }

      if (e.shiftKey && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault()
        onReplaceSelectionWithGap()
        return
      }

      if (e.shiftKey && e.key === 'Enter') {
        e.preventDefault()
        onRestoreSelection()
        return
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        onDeleteSelection()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z' && e.shiftKey))
      ) {
        e.preventDefault()
        redo()
      }

      if (timelineFocused && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        const step = e.key === 'ArrowLeft' ? -33 : 33
        seekToOutputMs(Math.max(0, Math.min(outDur, outputMs + step)))
      }

      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        setShortcutsOpen(true)
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setActionBarOpen(true)
      }

      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const step = 2000
        if (e.key === 'j' || e.key === 'J') {
          e.preventDefault()
          seekToOutputMs(Math.max(0, outputMs - step))
        }
        if (e.key === 'k' || e.key === 'K') {
          e.preventDefault()
          const v = videoRef.current
          if (v) {
            outputPlayAnchorRef.current = null
            v.pause()
          }
        }
        if (e.key === 'l' || e.key === 'L') {
          e.preventDefault()
          seekToOutputMs(Math.min(outDur, outputMs + step))
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.altKey && (e.key === '.' || e.code === 'Period')) {
        e.preventDefault()
        const next = nextMarkerOutMs(document.markers, outputMs)
        if (next != null) seekToOutputMs(next)
      }
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === ',') {
        e.preventDefault()
        const prev = prevMarkerOutMs(document.markers, outputMs)
        if (prev != null) seekToOutputMs(prev)
      }

      if (e.altKey && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        setSideTab('project')
        setSideOpen(true)
      }
      if (e.altKey && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        setSideTab('media')
        setSideOpen(true)
      }
      if (e.altKey && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setSideTab('layouts')
        setSideOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    onDeleteSelection,
    onRestoreSelection,
    onReplaceSelectionWithGap,
    onSplitAtPlayhead,
    onZoom,
    outputMs,
    outDur,
    redo,
    undo,
    timelineFocused,
    seekToOutputMs,
    followPlayhead,
    setShortcutsOpen,
    selAnchor,
    activeIndex,
    orderedWords,
    safeApplyOp,
    document.markers,
    outputMs,
    addMarkerAtPlayhead,
    commentsOpen,
    commentDraft,
    selAnchor,
    composerMinimized,
    submitCommentFromSelection,
    edl,
    outputMs,
    document.markers,
    setActionBarOpen,
    document,
    document.wordTextOverrides,
    fillerSearchQuery,
    orderedWords,
    edl,
    setReviewMode,
    setFillerSearchMode,
    setFillerReviewOpen,
    setSideTab,
    setSideOpen,
    setTimelineExpanded,
  ])

  const saveProjectScroll = useCallback(() => {
    try {
      sessionStorage.setItem(`clips-proj-scroll-${data.projectId}`, String(window.scrollY))
    } catch {
      /* ignore */
    }
  }, [data.projectId])

  const isContextWord = useCallback(
    (wordId: string) => isClipComposition && contextWordSet.has(wordId) && !keptSet.has(wordId),
    [isClipComposition, contextWordSet, keptSet],
  )

  const includeContextWord = useCallback(
    (wordId: string) => {
      safeApplyOp({ type: 'include_context_words', wordIds: [wordId] })
    },
    [applyOp],
  )

  useEffect(() => {
    const el = transcriptRef.current?.querySelector(`[data-word-idx="${activeIndex}"]`) ?? null
    if (playing && followPlayhead) scrollWordToFollowPlayhead(transcriptRef.current, el)
    else scrollWordIntoTranscriptPane(transcriptRef.current, el)
  }, [activeIndex, playing, followPlayhead])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      if (edlUsesOutputClock(edl)) {
        outputPlayAnchorRef.current = { t: performance.now(), out0: outputMs }
      }
      void v.play()
    } else {
      outputPlayAnchorRef.current = null
      v.pause()
    }
  }

  const scriptActions = useMemo((): ScriptAction[] => {
    return [
      {
        id: 'play',
        label: 'Play / pause',
        keywords: 'space transport',
        run: () => togglePlay(),
      },
      {
        id: 'studio',
        label: 'Studio Sound',
        keywords: 'audio enhance isolation',
        run: () => {
          setSideTab('properties')
          setSideOpen(true)
          safeApplyOp({
            type: 'patch_audio_fx',
            audioFx: {
              ...document.audioFx,
              studioSound: {
                enabled: true,
                mix: document.audioFx?.studioSound?.mix ?? 0.8,
                assetId: document.audioFx?.studioSound?.assetId ?? null,
              },
            },
          })
        },
      },
      {
        id: 'fillers',
        label: 'Remove filler words',
        keywords: 'clean um uh',
        run: () => {
          setSideTab('edit')
          setEditToolsTab('filler')
          setFillerReviewOpen(true)
        },
      },
      {
        id: 'gaps',
        label: 'Shorten word gaps',
        keywords: 'silence pause',
        run: () => {
          setSideTab('edit')
          setEditToolsTab('gaps')
          openGapTools()
        },
      },
      {
        id: 'retakes',
        label: 'Find retakes',
        keywords: 'duplicate false start',
        run: () => {
          setSideTab('edit')
          setEditToolsTab('retakes')
        },
      },
      {
        id: 'marker',
        label: 'Add marker at playhead',
        keywords: 'chapter',
        run: () => addMarkerAtPlayhead(),
      },
      {
        id: 'shortcuts',
        label: 'Keyboard shortcuts',
        keywords: 'help',
        run: () => setShortcutsOpen(true),
      },
    ]
  }, [document.audioFx, safeApplyOp, openGapTools, addMarkerAtPlayhead, edl, outputMs])

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startPct = scriptWidthPct
    let latestPct = startPct
    const onMove = (ev: MouseEvent) => {
      const shell = (e.target as HTMLElement).closest('[data-script-shell]') as HTMLElement | null
      if (!shell) return
      const rect = shell.getBoundingClientRect()
      const delta = ev.clientX - startX
      const next = startPct + (delta / rect.width) * 100
      latestPct = Math.min(72, Math.max(28, next))
      setScriptWidthPct(latestPct)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      saveScriptEditorLayout({ scriptWidthPct: latestPct, timelineExpanded, timelineHeightPx })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const onTimelineResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = timelineHeightPx
    let latest = startH
    const onMove = (ev: MouseEvent) => {
      latest = Math.min(480, Math.max(160, startH - (ev.clientY - startY)))
      setTimelineHeightPx(latest)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      saveScriptEditorLayout({ scriptWidthPct, timelineExpanded, timelineHeightPx: latest })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const splitAfterIdx = useMemo(() => {
    const markers = new Map<number, true>()
    for (const ms of document.splitAtOutMs ?? []) {
      const idx = splitMarkerAfterWordIndex(document, orderedWords, edl, ms)
      if (idx != null) markers.set(idx, true)
    }
    return markers
  }, [document, orderedWords, edl])

  const durationLabel = formatScriptTimecode(outDur)
  const currentLabel = formatScriptTimecode(outputMs)

  return (
    <div data-script-shell className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-background">
      <header className="relative flex h-12 shrink-0 items-center gap-3 border-b border-border px-3">
        <Button
          size="sm"
          variant="ghost"
          data-testid="script-back-to-project"
          onClick={saveProjectScroll}
          render={<Link href={`/app/clips/${data.projectId}`} />}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to project
        </Button>
        <Button size="sm" variant="ghost" disabled={!canUndo || editingLocked} onClick={() => undo()}>
          <Undo2 className="size-4" aria-hidden />
          Undo
        </Button>
        <Button size="sm" variant="ghost" disabled={!canRedo || editingLocked} onClick={() => redo()}>
          <Redo2 className="size-4" aria-hidden />
          Redo
        </Button>
        <Button size="sm" variant="ghost" onClick={onSplitAtPlayhead} title="Split (S)">
          <Scissors className="size-4" aria-hidden />
          Split
        </Button>
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 hidden -translate-x-1/2 md:block">
          <div className="pointer-events-auto flex max-w-[min(100vw-24rem,360px)] flex-col items-center gap-0.5">
            <span className="truncate text-[11px] text-muted-foreground">{data.title}</span>
            <ScriptCompositionSwitcher
              projectId={data.projectId}
              compositions={compositions}
              activeCompositionId={data.compositionId}
              activeTitle={compositionTitle}
              isClip={isClipComposition}
            />
          </div>
        </div>
        <div className="min-w-0 flex-1 truncate text-sm font-medium md:invisible">
          {data.title}
        </div>
        {isClipComposition && (
          <div className="flex items-center gap-2" data-testid="show-surrounding-transcript">
            <Switch id="surrounding-transcript" checked={showSurrounding} onCheckedChange={setShowSurrounding} />
            <Label htmlFor="surrounding-transcript" className="text-xs text-muted-foreground">
              Show surrounding transcript
            </Label>
          </div>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="hidden sm:inline-flex"
          data-testid="script-action-bar-trigger"
          onClick={() => setActionBarOpen(true)}
        >
          Actions ⌘K
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          title="Shortcuts (⌘/)"
          data-testid="script-shortcuts-help"
          onClick={() => setShortcutsOpen(true)}
        >
          <HelpCircle className="size-4" />
        </Button>
        {fillerHits.length > 0 && (
          <button
            type="button"
            onClick={openFillerTools}
            className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-800 dark:text-sky-200 hover:bg-sky-500/20"
            title="Review-bar hits (same filter as filler tools)"
            data-testid="script-filler-count-badge"
          >
            Fillers {fillerHits.length}
          </button>
        )}
        <span className="text-xs text-muted-foreground">
          {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save failed' : 'Saved'}
        </span>
        <Button
          type="button"
          size="sm"
          variant={commentsOpen ? 'secondary' : 'ghost'}
          onClick={() => setCommentsOpen((o) => !o)}
          title="Comments (⌘⌥M)"
        >
          <MessageSquare className="size-4" aria-hidden />
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setShareOpen(true)} title="Share">
          <Share2 className="size-4" aria-hidden />
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setSettingsOpen(true)} title="Settings">
          <Settings className="size-4" aria-hidden />
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setVersionOpen((o) => !o)}>
          Versions
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90"
          onClick={() => setExportOpen(true)}
        >
          Export
        </Button>
      </header>

      {tabLock.foreignTab && (
        <div
          className="flex items-center justify-between gap-2 border-b border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs"
          data-testid="script-tab-lock-banner"
        >
          <span>Open in another tab — edits here are read-only until you take over.</span>
          <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => tabLock.claimEditingHere()}>
            Edit here
          </Button>
        </div>
      )}

      {fillerReviewOpen && (
        <ScriptFillerReviewBar
          mode={reviewMode}
          searchMode={fillerSearchMode}
          onSearchModeChange={(m) => {
            setFillerSearchMode(m)
            if (m === 'gaps') {
              setReviewMode('gap')
              setEditToolsTab('gaps')
            } else {
              setReviewMode('filler')
              setEditToolsTab('filler')
            }
          }}
          searchQuery={fillerSearchQuery}
          onSearchQueryChange={setFillerSearchQuery}
          searchOptions={fillerSearchOptions}
          onSearchOptionsChange={(patch) => setFillerSearchOptions((o) => ({ ...o, ...patch }))}
          total={reviewTotal}
          cursor={reviewCursor}
          filter={fillerFilter}
          action={fillerAction}
          onActionChange={setFillerAction}
          onFilterChange={(f) => {
            setFillerFilter(f)
            setFillerCursor(0)
          }}
          selectionOnly={reviewMode === 'gap' ? gapSelectionOnly : fillerSelectionOnly}
          onSelectionOnlyChange={(v) => {
            if (reviewMode === 'gap') setGapSelectionOnly(v)
            else setFillerSelectionOnly(v)
          }}
          avoidHarshCuts={fillerAvoidHarsh}
          onAvoidHarshCutsChange={setFillerAvoidHarsh}
          targetGapSec={targetGapSec}
          onTargetGapSecChange={setTargetGapSec}
          onPrev={() => {
            if (reviewMode === 'gap') {
              setGapCursor((c) => (gapHits.length ? (c - 1 + gapHits.length) % gapHits.length : 0))
            } else if (inFindMode) {
              setFillerCursor((c) => {
                const next = findHits.length ? (c - 1 + findHits.length) % findHits.length : 0
                const hit = findHits[next]
                if (hit) goToFindHit(hit)
                return next
              })
            } else {
              setFillerCursor((c) => (fillerHits.length ? (c - 1 + fillerHits.length) % fillerHits.length : 0))
            }
          }}
          onNext={() => {
            if (reviewMode === 'gap') {
              setGapCursor((c) => (gapHits.length ? (c + 1) % gapHits.length : 0))
            } else if (inFindMode) {
              setFillerCursor((c) => {
                const next = findHits.length ? (c + 1) % findHits.length : 0
                const hit = findHits[next]
                if (hit) goToFindHit(hit)
                return next
              })
            } else {
              setFillerCursor((c) => (fillerHits.length ? (c + 1) % fillerHits.length : 0))
            }
          }}
          replaceText={findReplaceText}
          onReplaceTextChange={setFindReplaceText}
          onReplaceOne={onReplaceOneFind}
          onReplaceAll={onReplaceAllFind}
          onFindNext={() => {
            if (!findHits.length) return
            setFillerCursor((c) => {
              const next = (c + 1) % findHits.length
              goToFindHit(findHits[next]!)
              return next
            })
          }}
          onFindPrev={() => {
            if (!findHits.length) return
            setFillerCursor((c) => {
              const next = (c - 1 + findHits.length) % findHits.length
              goToFindHit(findHits[next]!)
              return next
            })
          }}
          onRemoveOne={onRemoveOneFiller}
          onRemoveAll={onRemoveAllFillers}
          onRemoveAllLexicon={() => {
            const hits = listFillerHits(orderedWords, deletedSet, {
              filter: 'lexicon',
              selectionOnly: fillerSelectionOnly,
              selectedIds,
              avoidHarshCuts: fillerAvoidHarsh,
            })
            applyFillerActionToHits(fillerAction, hits)
          }}
          onRemoveAllRepeat={() => {
            const hits = listFillerHits(orderedWords, deletedSet, {
              filter: 'repeat',
              selectionOnly: fillerSelectionOnly,
              selectedIds,
              avoidHarshCuts: fillerAvoidHarsh,
            })
            applyFillerActionToHits(fillerAction, hits)
          }}
          onClose={() => setFillerReviewOpen(false)}
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <section
            className="flex h-full min-h-0 min-w-0 flex-col border-b border-border lg:border-b-0 lg:border-r"
            style={{ flex: `0 0 ${scriptWidthPct}%` }}
          >
            <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
              Delete cuts · Shift+Enter restore · Shift+Delete gap · S split · Right-click cut
            </div>
            <div
              ref={transcriptRef}
              className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 select-none"
              onFocus={() => setTimelineFocused(false)}
            >
              {!followPlayhead && playing && (
                <button
                  type="button"
                  className="sticky top-2 z-30 mb-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium shadow-sm hover:bg-muted"
                  onClick={() => setFollowPlayhead(true)}
                >
                  ↓ Follow playhead
                </button>
              )}
              <ScriptSelectionToolbar
                anchorRect={selectionToolbarRect}
                canDelete={selectedKeptIds.length > 0}
                canIgnore={selectedKeptIds.some((id) => !ignoredSet.has(id))}
                canRestore={selectedDeletedIds.length > 0 || selectedIgnoredIds.length > 0}
                canReplaceGap={selectedKeptIds.length > 0 && selAnchor != null && selEnd != null}
                onDelete={onDeleteSelection}
                onIgnore={onIgnoreSelection}
                onRestore={onRestoreSelection}
                onReplaceGap={onReplaceSelectionWithGap}
              />
              <div className="mx-auto max-w-[72ch] space-y-4 text-[17px] leading-relaxed">
                {blocks.map((block) => (
                  <div key={`${block.speakerId}-${block.startMs}`}>
                    <div className="mb-1 flex items-center gap-2 text-sm">
                      <span className="size-2 rounded-full" style={{ backgroundColor: block.color }} aria-hidden />
                      <button
                        type="button"
                        className="font-medium hover:underline"
                        onClick={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          setSpeakerRename({
                            speakerId: block.speakerId,
                            rect,
                            initialName: block.speakerLabel,
                          })
                        }}
                      >
                        {block.speakerLabel}
                      </button>
                      <span className="text-muted-foreground">{formatScriptTimecode(block.startMs - data.rangeStartMs)}</span>
                    </div>
                    <p>
                      {block.words.map((w) => {
                        const idx = wordIndex(w.id)
                        const deleted = deletedSet.has(w.id)
                        const contextOnly = isContextWord(w.id)
                        if (contextOnly && !showSurrounding) return null
                        if (deleted && !showDeletedWords) return null
                        const active = idx === activeIndex
                        const ignored = ignoredSet.has(w.id)
                        const hiddenTranscript = transcriptHiddenSet.has(w.id)
                        const selected = selectedIds.has(w.id)
                        const showSplit = splitAfterIdx.has(idx)
                        const prevWord = idx > 0 ? orderedWords[idx - 1] : null
                        const gapMs =
                          prevWord && !deleted && !deletedSet.has(prevWord.id)
                            ? gapMsBetween(prevWord, w, document)
                            : 0
                        const sceneHere = (document.scenes ?? []).find((s) => s.startWordId === w.id)
                        return (
                          <span key={w.id} className="inline">
                            {sceneHere && !deleted && (
                              <span
                                data-testid="script-scene-break"
                                className="mr-1 inline-block rounded bg-violet-500/20 px-1 text-[10px] font-semibold uppercase tracking-wide text-violet-300"
                                title={sceneHere.label ?? 'Scene'}
                              >
                                {sceneHere.label ?? 'Scene'}
                              </span>
                            )}
                            {gapMs >= 400 && !deleted && prevWord && (
                              <ScriptGapChipMenu
                                gapMs={gapMs}
                                targetGapSec={targetGapSec}
                                onShorten={() => {
                                  safeApplyOp({
                                    type: 'shorten_gap_before',
                                    wordId: w.id,
                                    prevWordId: prevWord.id,
                                    gapMs,
                                    targetGapMs: Math.round(targetGapSec * 1000),
                                  })
                                }}
                                onRemove={() => {
                                  safeApplyOp({
                                    type: 'shorten_gap_before',
                                    wordId: w.id,
                                    prevWordId: prevWord.id,
                                    gapMs,
                                    targetGapMs: 0,
                                  })
                                }}
                                onKeep={() => undefined}
                              />
                            )}
                            <span className="relative inline">
                            <button
                              type="button"
                              data-word-idx={idx}
                              onMouseDown={(e) => {
                                if (contextOnly) return
                                e.preventDefault()
                                onWordPointerDown(idx, w, e.shiftKey)
                              }}
                              onMouseEnter={() => {
                                if (contextOnly) {
                                  setHoverIncludeWordId(w.id)
                                  return
                                }
                                onWordPointerEnter(idx)
                                if (deleted || ignored) setHoverRestoreWordId(w.id)
                              }}
                              onMouseLeave={() => {
                                if (hoverIncludeWordId === w.id) setHoverIncludeWordId(null)
                                if (hoverRestoreWordId === w.id) setHoverRestoreWordId(null)
                              }}
                              onDoubleClick={(e) => {
                                e.preventDefault()
                                if (deleted) restoreCutForWord(w.id)
                                else if (ignored) restoreIgnoredForWord(w.id)
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault()
                                setSelAnchor(idx)
                                setSelEnd(idx)
                                setCtxMenu({ x: e.clientX, y: e.clientY })
                              }}
                              className={cn(
                                'mr-1 inline rounded-sm px-0.5 transition-colors',
                                w.isFiller && !deleted && !ignored && 'text-muted-foreground underline decoration-dotted decoration-sky-500/70',
                                deleted && 'text-muted-foreground/60 line-through decoration-destructive/50',
                                ignored && !deleted && 'text-muted-foreground/70 line-through decoration-dotted',
                                hiddenTranscript && !deleted && 'text-muted-foreground/50 italic',
                                contextOnly &&
                                  'cursor-default border-b border-dashed border-primary/40 text-muted-foreground/50',
                                active && !deleted && !contextOnly && 'bg-primary/20',
                                activeFillerHit?.word.id === w.id && 'ring-1 ring-sky-500/60',
                                activeFindHit?.word.id === w.id && inFindMode && 'ring-1 ring-orange-500/70',
                                inFindMode &&
                                  findHits.some((h) => h.word.id === w.id) &&
                                  'bg-yellow-200/30 dark:bg-yellow-500/20',
                                activeGapHit?.word.id === w.id && 'ring-1 ring-amber-500/60',
                                selected && 'bg-sky-500/25',
                                commentedWordIds.has(w.id) && 'bg-primary/15 underline decoration-primary/60',
                                deleted && 'cursor-pointer hover:bg-destructive/10',
                                !active && !deleted && 'hover:bg-muted/60',
                              )}
                            >
                              {hiddenTranscript ? '·' : document.wordTextOverrides?.[w.id] ?? w.text}
                            </button>
                            {contextOnly && hoverIncludeWordId === w.id && (
                              <button
                                type="button"
                                data-testid="include-context-word"
                                className="absolute -top-6 left-0 z-10 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-primary shadow-sm hover:bg-muted"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => includeContextWord(w.id)}
                              >
                                Include
                              </button>
                            )}
                            {(deleted || ignored) && hoverRestoreWordId === w.id && (
                              <button
                                type="button"
                                className="absolute -top-6 left-0 z-10 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-primary shadow-sm hover:bg-muted"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  if (deleted) restoreCutForWord(w.id)
                                  else restoreIgnoredForWord(w.id)
                                }}
                              >
                                Restore
                              </button>
                            )}
                            </span>
                            {markersAfterIdx.get(idx)?.map((m) => (
                              <span key={m.id} className="block w-full">
                                <ScriptMarkerHeading
                                  markerId={m.id}
                                  label={m.label ?? 'Marker'}
                                  onRename={(label) => applyOp({ type: 'update_marker', id: m.id, patch: { label } })}
                                  onRemove={() => applyOp({ type: 'delete_marker', id: m.id })}
                                  onGoTo={() => seekToOutputMs(m.outMs)}
                                  onDragReposition={(delta) => moveMarkerAfterWord(m.id, delta)}
                                />
                              </span>
                            ))}
                            {showSplit && (
                              <span className="mx-0.5 text-primary" title="Edit boundary">
                                ¦
                              </span>
                            )}
                          </span>
                        )
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <ScriptTranscriptContextMenu
              open={ctxMenu != null}
              x={ctxMenu?.x ?? 0}
              y={ctxMenu?.y ?? 0}
              canRestore={selectedDeletedIds.length > 0 || selectedIgnoredIds.length > 0}
              canIgnore={selectedKeptIds.some((id) => !ignoredSet.has(id) && !deletedSet.has(id))}
              canSymmetricTrimGap={(() => {
                if (selAnchor == null) return false
                const w = orderedWords[selAnchor]
                const prev = selAnchor > 0 ? orderedWords[selAnchor - 1] : null
                if (!w || !prev || deletedSet.has(w.id) || deletedSet.has(prev.id)) return false
                const gapMs = w.t0Ms - prev.t1Ms
                return gapMs >= 400
              })()}
              onRestore={onRestoreSelection}
              onIgnore={onIgnoreSelection}
              onSymmetricTrimGap={() => {
                if (selAnchor == null || selAnchor < 1) return
                const w = orderedWords[selAnchor]
                const prev = orderedWords[selAnchor - 1]
                if (!w || !prev) return
                const gapMs = w.t0Ms - prev.t1Ms
                const targetMs = Math.round(targetGapSec * 1000)
                safeApplyOp({
                  type: 'shorten_gap_before',
                  wordId: w.id,
                  prevWordId: prev.id,
                  gapMs,
                  targetGapMs: targetMs,
                })
                toast.success(`Symmetric trim gap → ${targetGapSec}s. Undo`)
              }}
              onClose={() => setCtxMenu(null)}
            />
          </section>

          <div
            role="separator"
            aria-orientation="vertical"
            className="hidden w-2 shrink-0 cursor-col-resize bg-border/40 hover:bg-primary/30 lg:block"
            onMouseDown={onResizeStart}
          />

          <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 overflow-hidden bg-muted/30 p-4">
              {data.sourceVideoUrl ? (
                <ScriptPreviewCanvas aspect={settings.aspect ?? '9:16'} boxRef={previewBoxRef}>
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <video
                      ref={videoRef}
                      className="pointer-events-auto absolute max-w-none object-cover"
                      style={videoCropStyle}
                      src={data.sourceVideoUrl}
                      controls={false}
                      preload="metadata"
                      playsInline
                      crossOrigin="anonymous"
                      onTimeUpdate={syncFromVideo}
                      onPlay={() => setPlaying(true)}
                      onPause={() => setPlaying(false)}
                      onClick={togglePlay}
                    />
                  </div>
                  <ScriptReframeCropOverlay
                    crop={liveCrop}
                    enabled={settings.reframeMode === 'manual'}
                    onCropChange={(c) => setDraftCrop(c)}
                    onCommit={commitReframeKeyframe}
                  />
                  <ScriptCaptionOverlay
                    keptWords={captionWords}
                    rangeStartMs={data.rangeStartMs}
                    currentTimeSec={playheadMs / 1000}
                    settings={settings}
                    boxHeightPx={previewBoxH}
                    outputDurationSec={outDur / 1000}
                  />
                  <PreviewPillBar settings={settings} onPatch={patchSettings} />
                  <StudioSoundPreview
                    videoRef={videoRef}
                    isolatedUrl={studioPreviewGen.downloadUrl}
                    mix={studioFx?.mix ?? 0.8}
                    enabled={Boolean(studioFx?.enabled && studioPreviewGen.status === 'READY')}
                  />
                  <ScriptVuMeter videoRef={videoRef} />
                </ScriptPreviewCanvas>
              ) : (
                <p className="m-auto text-sm text-muted-foreground">Source video unavailable.</p>
              )}
            </div>
          </section>

          {sideOpen && (
            <aside
              className={cn(
                'h-full min-h-0 w-[min(100%,320px)] shrink-0 flex-col overflow-hidden border-l border-border bg-background',
                commentsOpen
                  ? 'fixed inset-y-0 right-0 z-40 flex w-full max-w-sm shadow-xl lg:static lg:max-w-none lg:shadow-none'
                  : 'hidden lg:flex',
              )}
            >
              <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
                {commentsOpen
                  ? 'Comments'
                  : sideTab === 'project'
                    ? 'Project'
                    : sideTab === 'properties'
                      ? 'Properties'
                      : sideTab === 'layouts'
                        ? 'Layouts'
                        : sideTab === 'elements'
                          ? 'Elements'
                          : sideTab === 'captions'
                            ? 'Captions'
                            : sideTab === 'media'
                              ? 'Media'
                              : 'Edit tools'}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {commentsOpen && (
                  <ScriptCommentsPanel
                    threads={commentsApi.threads}
                    loading={commentsApi.loading}
                    playheadOutMs={outputMs}
                    showResolved={showResolvedComments}
                    onToggleShowResolved={() => setShowResolvedComments((v) => !v)}
                    onSeek={seekToOutputMs}
                    onReply={(threadId, body) => commentsApi.reply(threadId, body)}
                    onResolve={(threadId, resolved) => commentsApi.setResolved(threadId, resolved)}
                    onDeleteThread={(threadId) => commentsApi.deleteThread(threadId)}
                    onEditComment={(threadId, commentId, body) => commentsApi.editComment(threadId, commentId, body)}
                    projectId={data.projectId}
                    clipScope={data.compositionKind === 'CLIP'}
                    commentScope={commentScope}
                    onCommentScopeChange={setCommentScope}
                    draftComposer={
                      composerMinimized && (commentDraft || selAnchor != null)
                        ? (
                            <CommentComposerPill
                              preview={commentDraft}
                              onExpand={() => setComposerMinimized(false)}
                            />
                          )
                        : commentDraft || selAnchor != null
                          ? (
                              <div className="mb-2 rounded-lg border border-border bg-muted/40 p-2">
                                <CommentMentionTextarea
                                  className="min-h-[64px] w-full resize-none bg-transparent text-[13px] outline-none"
                                  placeholder="Add a comment… @ for mentions"
                                  value={commentDraft}
                                  onChange={(v) => {
                                    setCommentDraft(v)
                                    setComposerMinimized(false)
                                  }}
                                  onMentionIds={setCommentMentionIds}
                                />
                                <div className="mt-2 flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setCommentDraft('')
                                      setComposerMinimized(false)
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button type="button" size="sm" onClick={() => void submitCommentFromSelection()}>
                                    Comment
                                  </Button>
                                </div>
                              </div>
                            )
                          : undefined
                    }
                  />
                )}
                {!commentsOpen && sideTab === 'project' && (
                  <ScriptProjectPanel
                    projectId={data.projectId}
                    projectTitle={data.title}
                    compositions={compositions}
                    activeCompositionId={data.compositionId}
                    clips={data.clips}
                  />
                )}
                {!commentsOpen && sideTab === 'properties' && (
                  <>
                    <ScriptPropertiesPanel
                      settings={settings}
                      rangeStartMs={data.rangeStartMs}
                      playheadMs={playheadMs}
                      reframeKeyframes={document.reframeKeyframes ?? []}
                      onPatch={patchSettings}
                      onAddReframeKeyframe={commitReframeKeyframe}
                      onDeleteReframeKeyframe={(srcMs) => {
                        const next = (document.reframeKeyframes ?? []).filter((k) => k.srcMs !== srcMs)
                        safeApplyOp({ type: 'patch_reframe_keyframes', reframeKeyframes: next })
                      }}
                      onSeekReframeKeyframe={(srcMs) => seekToSourceMs(srcMs)}
                    />
                    <ScriptAudioPanel
                      compositionId={data.compositionId}
                      document={document}
                      outputDurationMs={outDur}
                      playheadOutMs={outputMs}
                      onPatchAudio={(audio: ClipEditsAudio | null) => safeApplyOp({ type: 'patch_audio', audio })}
                      onPatchAudioFx={(audioFx) => safeApplyOp({ type: 'patch_audio_fx', audioFx })}
                    />
                  </>
                )}
                {!commentsOpen && sideTab === 'layouts' && (
                  <>
                    <ScriptMulticamPanel
                      document={document}
                      sceneCount={document.scenes?.length ?? 0}
                      onPatchSettings={(patch) => safeApplyOp({ type: 'patch_settings', patch })}
                      onAutoMulticam={() => {
                        const scenes = buildAutoMulticamScenes(orderedWords, {
                          minHoldMs: document.settings?.multicam?.minHoldMs ?? 2000,
                          wideEveryMs: document.settings?.multicam?.wideEveryMs ?? 45_000,
                        })
                        safeApplyOp({ type: 'replace_scenes', scenes })
                        toast.success(`Added ${scenes.length} multicam scenes`)
                      }}
                    />
                    <ScriptLayoutsPanel settings={settings} onPatch={patchSettings} />
                  </>
                )}
                {!commentsOpen && sideTab === 'elements' && (
                  <ScriptElementsPanel
                    document={document}
                    activeWordId={selAnchor != null ? orderedWords[selAnchor]?.id ?? null : null}
                    onPatchOverlays={(overlays) => safeApplyOp({ type: 'patch_overlays', overlays })}
                  />
                )}
                {!commentsOpen && sideTab === 'captions' && <ScriptCaptionsPanel settings={settings} onPatch={patchSettings} />}
                {!commentsOpen && sideTab === 'media' && (
                  <ScriptMediaPanel
                    compositionId={data.compositionId}
                    document={document}
                    outputDurationMs={outDur}
                    playheadOutMs={outputMs}
                    onPatchBroll={(next) => safeApplyOp({ type: 'patch_broll', broll: next })}
                  />
                )}
                {!commentsOpen && sideTab === 'edit' && (
                  <ScriptEditToolsPanel
                    tab={editToolsTab}
                    onTabChange={setEditToolsTab}
                    fillerHits={fillerHits}
                    activeFillerHitId={activeFillerHit?.word.id ?? null}
                    gapHits={gapHits}
                    activeGapHitId={activeGapHit?.word.id ?? null}
                    gapMode={gapMode}
                    onGapModeChange={setGapMode}
                    minGapSec={minGapSec}
                    maxGapSec={maxGapSec}
                    onMinGapSecChange={setMinGapSec}
                    onMaxGapSecChange={setMaxGapSec}
                    targetGapSec={targetGapSec}
                    onTargetGapSecChange={setTargetGapSec}
                    rangeStartMs={data.rangeStartMs}
                    onSelectFillerHit={onSelectFillerHit}
                    onSelectGapHit={onSelectGapHit}
                    onOpenFillerReview={() => {
                      setReviewMode('filler')
                      setFillerReviewOpen(true)
                    }}
                    onOpenGapReview={openGapTools}
                    onShortenOne={onRemoveOneFiller}
                    onShortenAll={onRemoveAllFillers}
                    compositionId={data.compositionId}
                    onDeleteRetakeWords={(wordIds) => safeDeleteWords(wordIds)}
                    onAiTool={(action) => {
                      if (action === 'edit_for_clarity') {
                        setSideTab('edit')
                        setClarityOpen(true)
                        return
                      }
                      if (action === 'studio_sound') {
                        setSideTab('properties')
                        setSideOpen(true)
                        safeApplyOp({
                          type: 'patch_audio_fx',
                          audioFx: {
                            ...document.audioFx,
                            studioSound: {
                              enabled: true,
                              mix: document.audioFx?.studioSound?.mix ?? 0.8,
                              assetId: document.audioFx?.studioSound?.assetId ?? null,
                            },
                          },
                        })
                        return
                      }
                      if (action === 'remove_fillers') {
                        setSideTab('edit')
                        setEditToolsTab('filler')
                        setReviewMode('filler')
                        setFillerReviewOpen(true)
                        return
                      }
                      if (action === 'shorten_gaps') {
                        setSideTab('edit')
                        setEditToolsTab('gaps')
                        openGapTools()
                        return
                      }
                      if (action === 'find_retakes') {
                        setSideTab('edit')
                        setEditToolsTab('retakes')
                      }
                    }}
                    onAiChapters={(chapters) => {
                      for (const ch of chapters) {
                        safeApplyOp({
                          type: 'add_marker',
                          outMs: ch.outMs,
                          id: `mrk_${crypto.randomUUID().replace(/-/g, '')}`,
                          label: ch.label,
                        })
                      }
                    }}
                  />
                )}
                {!commentsOpen && sideTab === 'edit' && clarityOpen && (
                  <ScriptClarityPanel
                    compositionId={data.compositionId}
                    onApply={(edits) => {
                      const overrides: Record<string, string> = {}
                      for (const e of edits) overrides[e.wordId] = e.text
                      safeApplyOp({ type: 'patch_word_text_overrides', overrides, mode: 'merge' })
                      setClarityOpen(false)
                    }}
                  />
                )}
              </div>
            </aside>
          )}

          <ScriptEditorRail
            active={sideTab}
            open={sideOpen}
            onToggle={(tab) => {
              if (sideOpen && sideTab === tab) setSideOpen(false)
              else {
                setSideTab(tab)
                setSideOpen(true)
              }
            }}
          />

          {versionOpen && (
            <ScriptVersionHistoryPanel
              open={versionOpen}
              onClose={() => setVersionOpen(false)}
              compositionId={data.compositionId}
              previewVersionId={previewVersionId}
              onPreview={(id, doc) => {
                setPreviewVersionId(id)
                setPreviewDoc(doc)
              }}
              onRestoreDocument={(doc, rev) => {
                replaceFromServer(doc, rev)
                setPreviewDoc(null)
                setPreviewVersionId(null)
              }}
              onExitPreview={() => {
                setPreviewDoc(null)
                setPreviewVersionId(null)
              }}
            />
          )}
        </div>

        <ScriptExportPopover
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          compositionId={data.compositionId}
          title={data.title}
          durationMs={outDur}
          aspect={settings.aspect ?? '9:16'}
          compositionDoc={document}
          projectStatus={data.status}
        />

        <ScriptProjectAccessModal open={shareOpen} onClose={() => setShareOpen(false)} compositionId={data.compositionId} />
        <ScriptEditorSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        {speakerRename && (
          <SpeakerRenamePopover
            anchor={speakerRename.rect}
            initialName={speakerRename.initialName}
            onSave={(name) => {
              safeApplyOp({
                type: 'patch_speaker_labels',
                labels: { [speakerRename.speakerId]: name },
              })
              toast.success('Speaker renamed')
            }}
            onClose={() => setSpeakerRename(null)}
          />
        )}

        <EditorRecorderBar
          armed={editorRec.armed}
          recording={editorRec.recording}
          countdown={editorRec.countdown}
          recSeconds={editorRec.recSeconds}
          cameras={editorRec.cameras}
          mics={editorRec.mics}
          cameraId={editorRec.cameraId}
          micId={editorRec.micId}
          onCameraId={editorRec.setCameraId}
          onMicId={editorRec.setMicId}
          countdownEnabled={editorRec.countdownEnabled}
          onCountdownEnabled={editorRec.setCountdownEnabled}
          onStart={() => void editorRec.startRecording()}
          onStop={() => void editorRec.stopRecording()}
          onPause={() => undefined}
          onDisarm={editorRec.disarm}
          onTeleprompter={() => setTeleprompterOpen(true)}
        />
        <TeleprompterPanel
          open={teleprompterOpen}
          onClose={() => setTeleprompterOpen(false)}
          scriptText={orderedWords.map((w) => w.text).join(' ')}
          playing={editorRec.recording}
          onTogglePlay={() => undefined}
        />
        {editorRec.uploadRows.length > 0 && (
          <div className="pointer-events-none absolute bottom-4 left-4 z-30">
            <RoomsUploadCard rows={editorRec.uploadRows} />
          </div>
        )}
        <div
          className="flex shrink-0 items-center justify-center gap-4 border-t border-border px-3 py-2 text-sm"
          onFocus={() => setTimelineFocused(true)}
          tabIndex={0}
        >
          {!editorRec.armed && (
            <>
              <Button type="button" size="icon-sm" variant="outline" onClick={togglePlay} disabled={!data.sourceVideoUrl}>
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 bg-lane-record text-white hover:bg-lane-record/90"
                onClick={() => editorRec.setArmed(true)}
              >
                Record
              </Button>
            </>
          )}
          <span className="tabular-nums text-muted-foreground" title="Output timeline (after cuts)">
            {currentLabel} / {durationLabel}
          </span>
        </div>

        {timelineExpanded && timelineView === 'storyboard' ? (
          <div className="flex min-h-0 flex-col border-t border-border" style={{ height: timelineHeightPx }} data-testid="script-storyboard-panel">
            <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border/60 px-2">
              <Button
                type="button"
                size="icon-sm"
                variant="secondary"
                data-testid="timeline-view-storyboard"
                title="Storyboard view"
                onClick={() => setTimelineView('storyboard')}
              >
                <LayoutGrid className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                data-testid="timeline-view-timeline"
                title="Timeline view"
                onClick={() => setTimelineView('timeline')}
              >
                <Rows3 className="size-4" />
              </Button>
            </div>
            <ScriptStoryboardPanel
              document={document}
              orderedWords={orderedWords}
              onSelectScene={(sceneId) => {
                const s = document.scenes?.find((x) => x.id === sceneId)
                const w = s?.startWordId ? wordsById.get(s.startWordId) : undefined
                if (w) seekToSourceMs(w.t0Ms)
              }}
              onReorder={(sceneIds) => safeApplyOp({ type: 'reorder_scenes', sceneIds })}
            />
          </div>
        ) : (
        <TimelinePanel
          expanded={timelineExpanded}
          heightPx={timelineHeightPx}
          timelineView={timelineView}
          onTimelineViewChange={setTimelineView}
          document={document}
          edl={edl}
          orderedWords={orderedWords}
          deletedSet={deletedSet}
          rangeStartMs={data.rangeStartMs}
          sourceDurationMs={timelineOutputMs}
          playheadSourceMs={playheadOutMs}
          cutRegions={cutRegions}
          showDeletedWords={showDeletedWords}
          videoUrl={data.sourceVideoUrl}
          selectedWordIds={selectedIds}
          selAnchor={selAnchor}
          selEnd={selEnd}
          pxPerMs={pxPerMs}
          scrollLeftPx={scrollLeftPx}
          onToggleExpanded={() => setTimelineExpanded((v) => !v)}
          onResizeStart={onTimelineResizeStart}
          onZoom={onZoom}
          onFit={onFit}
          onScrollLeft={setScrollLeftPx}
          onSeekOutput={seekToOutputMs}
          onSelectIndices={(lo, hi) => {
            setSelAnchor(lo)
            setSelEnd(hi)
          }}
          onPadDragEnd={(wordId, padMs) => safeApplyOp({ type: 'set_pad_before', wordId, padMs })}
          onTrimClipEdge={onTrimClipEdge}
          playheadOutMs={outputMs}
          outputDurationMs={outDur}
          onMoveMarker={(id, outMs) =>
            applyOp({ type: 'update_marker', id, patch: { outMs: snapMarkerOutMs(outMs) } })
          }
          commentThreads={commentsApi.threads}
          showRulerMarkers={showRulerMarkers}
          showRulerComments={showRulerComments}
          clipSpans={timelineClipSpans}
          previewVideoRef={videoRef}
          markerToolbarExtra={
            <>
              <ScriptTimelineViewMenu
                showRulerMarkers={showRulerMarkers}
                showRulerComments={showRulerComments}
                onChange={patchTimelineViewPrefs}
              />
              <ScriptMarkerListPopover
                document={document}
                playheadOutMs={outputMs}
                durationMs={outDur}
                onSeek={seekToOutputMs}
                clips={markerListClips}
              />
            </>
          }
        />
        )}
      <ScriptSlashMenu
        open={slashMenu != null}
        x={slashMenu?.x ?? 0}
        y={slashMenu?.y ?? 0}
        onClose={() => setSlashMenu(null)}
        onAddMarker={() => {
          addMarkerAtPlayhead()
          setSlashMenu(null)
        }}
      />
      </div>
      <ScriptShortcutsSheet open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <ScriptActionBar open={actionBarOpen} onOpenChange={setActionBarOpen} actions={scriptActions} />
    </div>
  )
}
