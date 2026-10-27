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
import { toast } from 'sonner'
import { ArrowLeft, Pause, Play, Redo2, Scissors, Undo2 } from 'lucide-react'
import {
  ScriptFillerReviewBar,
  type FillerReviewAction,
} from '@/components/script-editor/script-filler-review-bar'
import { ScriptReframeCropOverlay } from '@/components/script-editor/preview/script-reframe-layer'
import { ScriptEditorRail, type ScriptSideTab } from '@/components/script-editor/script-editor-rail'
import { ScriptCaptionsPanel } from '@/components/script-editor/side/script-captions-panel'
import { ScriptPropertiesPanel } from '@/components/script-editor/side/script-properties-panel'
import { ScriptEditToolsPanel } from '@/components/script-editor/side/script-edit-tools-panel'
import { PreviewPillBar } from '@/components/script-editor/preview/preview-pill-bar'
import { ScriptCaptionOverlay } from '@/components/script-editor/preview/script-caption-overlay'
import { resolveScriptSettings } from '@/lib/clips/script-editor/default-settings'
import { formatGapChip, listFillerHits, type FillerFilter } from '@/lib/clips/script-editor/filler-hits'
import { listGapHits, type GapFilterMode, type GapHit } from '@/lib/clips/script-editor/gap-hits'
import {
  cropAtSourceMs,
  cropToVideoStyle,
  defaultCropForAspect,
} from '@/lib/clips/script-editor/reframe-keyframes'
import type { ReframeCropRect, ScriptAspect, ScriptEditorSettings } from '@/lib/clips/script-edl/types'
import type { EditToolsTab } from '@/components/script-editor/side/script-edit-tools-panel'
import { sourceCutRegions } from '@/lib/clips/script-editor/cut-regions'
import { ScriptTranscriptContextMenu } from '@/components/script-editor/script-transcript-context-menu'

export type ScriptBootstrapView = {
  projectId: string
  title: string
  durationMs: number
  rangeStartMs: number
  wordCount: number
  sourceVideoUrl: string | null
  editorWords: EditorWord[]
  compositionId: string
  compositionRevision: number
  document: ScriptDocumentV1 | null
  clips: { id: string; title: string }[]
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
  const { document, saveState, deleteWords, restoreWords, applyOp, undo, redo, canUndo, canRedo } =
    useScriptComposition({
      compositionId: data.compositionId,
      revision: data.compositionRevision,
      document: initialDoc,
    })

  const videoRef = useRef<HTMLVideoElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef(loadScriptEditorLayout())
  const [scriptWidthPct, setScriptWidthPct] = useState(layoutRef.current.scriptWidthPct)
  const [timelineExpanded, setTimelineExpanded] = useState(layoutRef.current.timelineExpanded)
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
  const [fillerAutoAdvance, setFillerAutoAdvance] = useState(true)
  const [reviewMode, setReviewMode] = useState<'filler' | 'gap'>('filler')
  const [editToolsTab, setEditToolsTab] = useState<EditToolsTab>('filler')
  const [gapCursor, setGapCursor] = useState(0)
  const [gapMode, setGapMode] = useState<GapFilterMode>('more_than')
  const [minGapSec, setMinGapSec] = useState(1)
  const [maxGapSec, setMaxGapSec] = useState(3)
  const [targetGapSec, setTargetGapSec] = useState(0.3)
  const [gapSelectionOnly, setGapSelectionOnly] = useState(false)
  const [draftCrop, setDraftCrop] = useState<ReframeCropRect | null>(null)
  const [hoverRestoreWordId, setHoverRestoreWordId] = useState<string | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [followPlayhead, setFollowPlayhead] = useState(true)
  const [selectionToolbarRect, setSelectionToolbarRect] = useState<DOMRect | null>(null)

  const wordsById = useMemo(() => new Map(data.editorWords.map((w) => [w.id, w])), [data.editorWords])
  const settings = useMemo(() => resolveScriptSettings(document.settings), [document.settings])
  const showDeletedWords = settings.showDeletedWords !== false
  const edl = useMemo(() => deriveEdl(document, wordsById, { padMs: 0 }), [document, wordsById])
  const deletedSet = useMemo(() => new Set(document.deletedWordIds), [document.deletedWordIds])
  const ignoredSet = useMemo(() => new Set(document.ignoredWordIds ?? []), [document.ignoredWordIds])
  const transcriptHiddenSet = useMemo(
    () => new Set(document.transcriptHiddenWordIds ?? []),
    [document.transcriptHiddenWordIds],
  )
  const fillerCount = useMemo(
    () => data.editorWords.filter((w) => w.isFiller && !deletedSet.has(w.id)).length,
    [data.editorWords, deletedSet],
  )

  const orderedWords = useMemo(() => {
    const order = document.wordOrder ?? [...document.keptWordIds, ...document.deletedWordIds]
    return order.map((id) => wordsById.get(id)).filter((w): w is EditorWord => Boolean(w))
  }, [document, wordsById])

  const chips = useMemo(() => buildWordChips(document, orderedWords, edl, deletedSet), [document, orderedWords, edl, deletedSet])
  const blocks = useMemo(() => groupSpeakerBlocks(orderedWords), [orderedWords])
  const activeIndex = useMemo(() => findActiveWordIndex(orderedWords, playheadMs), [orderedWords, playheadMs])

  const outDur = outputDurationMs(edl) || data.durationMs
  const sourceSpanMs = Math.max(data.durationMs, outDur)
  const playheadSourceMs = Math.max(0, playheadMs - data.rangeStartMs)
  const outputMs = sourceMsToOutputTime(playheadMs, edl) ?? playheadSourceMs
  const cutRegions = useMemo(
    () => sourceCutRegions(orderedWords, deletedSet, data.rangeStartMs),
    [orderedWords, deletedSet, data.rangeStartMs],
  )

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
      applyOp({ type: 'restore_ignored', wordIds: selectedIgnoredIds })
      setSelAnchor(null)
      setSelEnd(null)
      toast.success('Restored ignored words')
    }
  }, [selectedDeletedIds, selectedIgnoredIds, restoreWords, applyOp])

  const onIgnoreSelection = useCallback(() => {
    if (!selectedKeptIds.length) return
    applyOp({ type: 'ignore_words', wordIds: selectedKeptIds.filter((id) => !ignoredSet.has(id)) })
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
      }),
    [orderedWords, deletedSet, fillerFilter, fillerSelectionOnly, selectedIds, fillerAvoidHarsh],
  )

  const activeFillerHit = fillerHits[fillerCursor] ?? null

  const gapHits = useMemo(
    () =>
      listGapHits(orderedWords, deletedSet, {
        mode: gapMode,
        minGapMs: Math.round(minGapSec * 1000),
        maxGapMs: Math.round(maxGapSec * 1000),
        selectionOnly: gapSelectionOnly || (reviewMode === 'gap' && fillerSelectionOnly),
        selectedIds: selectedIds,
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
    ],
  )

  const activeGapHit = gapHits[gapCursor] ?? null
  const reviewTotal = reviewMode === 'gap' ? gapHits.length : fillerHits.length
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

  const liveCrop = useMemo(() => {
    if (draftCrop) return draftCrop
    if (settings.reframeMode === 'center_crop') return { ...baseCrop, cx: 50, cy: 50 }
    return cropAtSourceMs(document.reframeKeyframes, playheadMs, baseCrop)
  }, [draftCrop, settings.reframeMode, document.reframeKeyframes, playheadMs, baseCrop])

  const videoCropStyle = useMemo(() => cropToVideoStyle(liveCrop), [liveCrop])

  const patchSettings = useCallback(
    (patch: Partial<ScriptEditorSettings>) => {
      applyOp({ type: 'patch_settings', patch })
    },
    [applyOp],
  )

  useEffect(() => {
    if (fillerCursor >= fillerHits.length) setFillerCursor(Math.max(0, fillerHits.length - 1))
  }, [fillerCursor, fillerHits.length])

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
    setFillerReviewOpen(true)
  }, [])

  const openGapTools = useCallback(() => {
    setSideOpen(true)
    setSideTab('edit')
    setEditToolsTab('gaps')
    setReviewMode('gap')
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
        applyOp({
          type: 'word_batch_action',
          action: 'replace_with_gap',
          wordIds,
          gapAtOutMs,
          gapDurMs: Math.max(1, Math.round(maxDur)),
        })
      } else {
        applyOp({ type: 'word_batch_action', action, wordIds })
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
      applyOp({
        type: 'shorten_gap_before',
        wordId: hit.word.id,
        prevWordId: hit.prevWord.id,
        gapMs: hit.gapMs,
        targetGapMs: targetMs,
      })
      const saved = Math.max(0, hit.gapMs - targetMs)
      toast.success(`Shortened gap (−${(saved / 1000).toFixed(1)} s). Undo`)
      if (fillerAutoAdvance) setGapCursor((c) => Math.min(c, Math.max(0, gapHits.length - 2)))
      return
    }
    const hit = fillerHits[fillerCursor]
    if (!hit) return
    applyFillerActionToHits(fillerAction, [hit])
    if (fillerAutoAdvance) setFillerCursor((c) => Math.min(c, Math.max(0, fillerHits.length - 2)))
  }, [
    reviewMode,
    gapHits,
    gapCursor,
    targetGapSec,
    applyOp,
    fillerAutoAdvance,
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
      applyOp({ type: 'shorten_gaps_batch', items })
      toast.success(`Shortened ${items.length} gap(s) (−${(saved / 1000).toFixed(1)} s). Undo`)
      setFillerReviewOpen(false)
      return
    }
    applyFillerActionToHits(fillerAction, fillerHits)
    setFillerReviewOpen(false)
  }, [reviewMode, gapHits, targetGapSec, applyOp, fillerAction, fillerHits, applyFillerActionToHits])

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
    applyOp({ type: 'set_reframe_keyframe', srcMs: Math.round(playheadMs), crop })
    setDraftCrop(null)
    patchSettings({ reframeMode: 'manual' })
  }, [applyOp, draftCrop, liveCrop, patchSettings, playheadMs])

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
      deleteWords(ids)
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
    applyOp({ type: 'replace_with_gap', wordIds, atOutMs: Math.round(range.outLo), durMs })
    setSelAnchor(null)
    setSelEnd(null)
  }, [selAnchor, selEnd, chips, orderedWords, deletedSet, applyOp])

  const onSplitAtPlayhead = useCallback(() => {
    applyOp({ type: 'add_split', outMs: Math.round(outputMs) })
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
    const shell = globalThis.document.querySelector('[data-script-shell]') as HTMLElement | null
    const viewW = shell ? shell.clientWidth - 80 : 800
    setPxPerMs(Math.max(0.005, viewW / Math.max(1, sourceSpanMs)))
    setScrollLeftPx(0)
  }, [sourceSpanMs])

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
        if (ids.length) deleteWords(ids)
      } else if (edge === 'end' && deltaOutMs > 0) {
        for (const w of orderedWords) {
          if (deletedSet.has(w.id)) continue
          const out = sourceMsToOutputTime(w.t1Ms, edl)
          if (out != null && out > outEnd && out <= targetOut) ids.push(w.id)
        }
        if (ids.length) applyOp({ type: 'restore_words', wordIds: ids })
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

      if (e.key === 'Escape' && !followPlayhead) {
        e.preventDefault()
        setFollowPlayhead(true)
        return
      }

      if (e.key === 's' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        onSplitAtPlayhead()
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
  ])

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
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3">
        <Button size="sm" variant="ghost" render={<Link href={`/app/clips/${data.projectId}`} />}>
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Button>
        <Button size="sm" variant="ghost" disabled={!canUndo} onClick={() => undo()}>
          <Undo2 className="size-4" aria-hidden />
          Undo
        </Button>
        <Button size="sm" variant="ghost" disabled={!canRedo} onClick={() => redo()}>
          <Redo2 className="size-4" aria-hidden />
          Redo
        </Button>
        <Button size="sm" variant="ghost" onClick={onSplitAtPlayhead} title="Split (S)">
          <Scissors className="size-4" aria-hidden />
          Split
        </Button>
        <div className="min-w-0 flex-1 truncate text-sm font-medium">{data.title}</div>
        {fillerCount > 0 && (
          <button
            type="button"
            onClick={openFillerTools}
            className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-800 dark:text-sky-200 hover:bg-sky-500/20"
            title="Open filler tools"
          >
            Fillers {fillerCount}
          </button>
        )}
        <span className="text-xs text-muted-foreground">
          {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save failed' : 'Saved'}
        </span>
      </header>

      {fillerReviewOpen && (
        <ScriptFillerReviewBar
          mode={reviewMode}
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
          autoAdvance={fillerAutoAdvance}
          onAutoAdvanceChange={setFillerAutoAdvance}
          onPrev={() => {
            if (reviewMode === 'gap') {
              setGapCursor((c) => (gapHits.length ? (c - 1 + gapHits.length) % gapHits.length : 0))
            } else {
              setFillerCursor((c) => (fillerHits.length ? (c - 1 + fillerHits.length) % fillerHits.length : 0))
            }
          }}
          onNext={() => {
            if (reviewMode === 'gap') {
              setGapCursor((c) => (gapHits.length ? (c + 1) % gapHits.length : 0))
            } else {
              setFillerCursor((c) => (fillerHits.length ? (c + 1) % fillerHits.length : 0))
            }
          }}
          onRemoveOne={onRemoveOneFiller}
          onRemoveAll={onRemoveAllFillers}
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
                      <span className="font-medium">{block.speakerLabel}</span>
                      <span className="text-muted-foreground">{formatScriptTimecode(block.startMs - data.rangeStartMs)}</span>
                    </div>
                    <p>
                      {block.words.map((w) => {
                        const idx = wordIndex(w.id)
                        const deleted = deletedSet.has(w.id)
                        if (deleted && !showDeletedWords) return null
                        const active = idx === activeIndex
                        const ignored = ignoredSet.has(w.id)
                        const hiddenTranscript = transcriptHiddenSet.has(w.id)
                        const selected = selectedIds.has(w.id)
                        const showSplit = splitAfterIdx.has(idx)
                        return (
                          <span key={w.id} className="inline">
                            {w.gapBeforeMs != null && w.gapBeforeMs >= 1000 && !deleted && (
                              <span
                                className="mr-1 inline rounded bg-muted px-1 text-[11px] text-muted-foreground"
                                title={`${(w.gapBeforeMs / 1000).toFixed(1)}s pause`}
                              >
                                {formatGapChip(w.gapBeforeMs)}
                              </span>
                            )}
                            <span className="relative inline">
                            <button
                              type="button"
                              data-word-idx={idx}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                onWordPointerDown(idx, w, e.shiftKey)
                              }}
                              onMouseEnter={() => {
                                onWordPointerEnter(idx)
                                if (deleted) setHoverRestoreWordId(w.id)
                              }}
                              onMouseLeave={() => {
                                if (hoverRestoreWordId === w.id) setHoverRestoreWordId(null)
                              }}
                              onDoubleClick={(e) => {
                                if (!deleted) return
                                e.preventDefault()
                                restoreCutForWord(w.id)
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
                                active && !deleted && 'bg-primary/20',
                                activeFillerHit?.word.id === w.id && 'ring-1 ring-sky-500/60',
                                activeGapHit?.word.id === w.id && 'ring-1 ring-amber-500/60',
                                selected && 'bg-sky-500/25',
                                deleted && 'cursor-pointer hover:bg-destructive/10',
                                !active && !deleted && 'hover:bg-muted/60',
                              )}
                            >
                              {hiddenTranscript ? '·' : w.text}
                            </button>
                            {deleted && hoverRestoreWordId === w.id && (
                              <button
                                type="button"
                                className="absolute -top-6 left-0 z-10 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-primary shadow-sm hover:bg-muted"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => restoreCutForWord(w.id)}
                              >
                                Restore
                              </button>
                            )}
                            </span>
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
              onRestore={onRestoreSelection}
              onIgnore={onIgnoreSelection}
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
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted/30 p-4">
              {data.sourceVideoUrl ? (
                <div
                  ref={previewBoxRef}
                  className={cn(
                    'relative max-h-full w-auto max-w-full overflow-hidden rounded-xl bg-black shadow-md ring-1 ring-white/10',
                    previewAspectClass(settings.aspect ?? '9:16'),
                  )}
                >
                  <video
                    ref={videoRef}
                    className="h-full w-full object-cover"
                    style={videoCropStyle}
                    src={data.sourceVideoUrl}
                    controls={false}
                    preload="metadata"
                    playsInline
                    onTimeUpdate={syncFromVideo}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onClick={togglePlay}
                  />
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
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Source video unavailable.</p>
              )}
            </div>
          </section>

          {sideOpen && (
            <aside className="hidden h-full min-h-0 w-[min(100%,320px)] shrink-0 flex-col overflow-hidden border-l border-border bg-background lg:flex">
              <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
                {sideTab === 'properties' ? 'Properties' : sideTab === 'captions' ? 'Captions' : 'Edit tools'}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {sideTab === 'properties' && (
                  <ScriptPropertiesPanel settings={settings} onPatch={patchSettings} />
                )}
                {sideTab === 'captions' && <ScriptCaptionsPanel settings={settings} onPatch={patchSettings} />}
                {sideTab === 'edit' && (
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
        </div>

        <div
          className="flex shrink-0 items-center justify-center gap-4 border-t border-border px-3 py-2 text-sm"
          onFocus={() => setTimelineFocused(true)}
          tabIndex={0}
        >
          <Button type="button" size="icon-sm" variant="outline" onClick={togglePlay} disabled={!data.sourceVideoUrl}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <span className="tabular-nums text-muted-foreground" title="Output timeline (after cuts)">
            {currentLabel} / {durationLabel}
          </span>
        </div>

        <TimelinePanel
          expanded={timelineExpanded}
          heightPx={timelineHeightPx}
          document={document}
          orderedWords={orderedWords}
          deletedSet={deletedSet}
          rangeStartMs={data.rangeStartMs}
          sourceDurationMs={sourceSpanMs}
          playheadSourceMs={playheadSourceMs}
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
          onSeekOutput={seekToSourceRelativeMs}
          onSelectIndices={(lo, hi) => {
            setSelAnchor(lo)
            setSelEnd(hi)
          }}
          onPadDragEnd={(wordId, padMs) => applyOp({ type: 'set_pad_before', wordId, padMs })}
          onTrimClipEdge={onTrimClipEdge}
        />
      </div>
    </div>
  )
}
