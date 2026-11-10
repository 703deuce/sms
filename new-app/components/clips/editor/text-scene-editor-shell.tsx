'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ArrowLeft, Clapperboard, Download, FileText, GripVertical, Loader2, Maximize2, MessageSquare, MoreHorizontal, Palette, Pause, Play, Redo2, RefreshCw, Search, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ClipperSurfaceErrorBoundary } from '@/components/clips/clipper-surface-error-boundary'
import { TranscriptPanel, type TranscriptSelection } from '@/components/clips/editor/transcript-panel'
import { PreviewStage } from '@/components/clips/editor/preview-stage'
import { ExportDialog } from '@/components/clips/editor/export-dialog'
import { LayoutQuickPicker } from '@/components/clips/editor/layout-quick-picker'
import { PreviewChipRow } from '@/components/clips/editor/preview-chip-row'
import { CaptionsPanel } from '@/components/clips/editor/captions-panel'
import { BrandPanel } from '@/components/clips/editor/brand-panel'
import { CanvasBackgroundChip } from '@/components/clips/editor/canvas-background'
import { MediaThumb } from '@/components/clips/editor/media-panel'
import { useProjectMedia } from '@/components/clips/editor/use-project-media'
import { PreviewTransportStrip } from '@/components/clips/editor/preview-transport-strip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EditorChatRail, type EditorChatScope } from '@/components/clips/editor/editor-chat-rail'
import { useEditorState } from '@/components/clips/editor/use-editor-state'
import { useEditorWords } from '@/components/clips/editor/use-editor-words'
import { useFilmstripFrames } from '@/components/clips/editor/timeline/use-filmstrip-frames'
import type { EditorClipShell } from '@/components/clips/editor/editor-clip-shell'
import { editorMediaLoadFallbacks } from '@/lib/server/clips/editor-clip-media'
import { editorIconBtn, editorIconBtnActive } from '@/lib/clips/editor/editor-chrome-tokens'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import { outputToSource, sourceToOutputSnapped, timebaseFor } from '@/lib/clips/editor/clip-timeline'
import { videoTimeFromSourceMs } from '@/lib/clips/editor-playback'
import { canonicalEditsJson, wordDisplayText } from '@/lib/clips/edits'
import { loadSourceWords, type SourceWord } from '@/lib/clips/source-words'
import { paragraphStarts } from '@/lib/clips/editor/transcript-edit'
import { sourceWordsForClipEditing } from '@/lib/clips/editor/clip-editor-word-scope'
import { snapTranscriptSelectionMs } from '@/lib/clips/editor/make-clip-from-transcript'
import { captionPresetPatch } from '@/lib/clips/editor/starter-templates'
import { applyBrandTemplateToEdits } from '@/lib/clips/apply-brand'
import type { BrandTemplateSettings } from '@/lib/clips/brand'
import { deriveClipFromEditor, clipsFetch } from '@/lib/clips-api'
import { routes } from '@/lib/routes'
import { normalizeMarkers, markerAt } from '@/lib/clips/editor/markers'
import { moveSelection } from '@/lib/clips/editor/reorder'
import { layoutModeAtSourceMs, setLayoutModeForSegmentAt, splitLayoutSegmentAt } from '@/lib/clips/layout-segments'
import { buildTemplateCatalog, type CatalogItem } from '@/lib/clips/templates/catalog'
import { CatalogTplThumb } from '@/lib/clips/templates/catalog-thumb'
import { PREVIEW_ZOOM_STEPS, type PreviewZoom } from '@/lib/clips/editor/preview-view'
import { getPreviewRate, PREVIEW_RATES, setPreviewRate, subscribePreviewRate } from '@/lib/clips/editor/preview-rate'
import { EXPORT_ASPECT_PRESETS } from '@/lib/clips/export-aspect'

type Props = Parameters<typeof EditorClipShell>[0] & { initialChatOpen?: boolean }
type Scene = { start: number; end: number; label: string; id: string }
type BrandRow = { id: string; name: string; settings: BrandTemplateSettings; logoKey?: string | null; introVideoKey?: string | null; outroVideoKey?: string | null; isDefault?: boolean; captionFont?: string | null }

function clock(ms: number) {
  const total = Math.floor(Math.max(0, ms) / 1000)
  return (total >= 3600 ? String(Math.floor(total / 3600)).padStart(2, '0') + ':' : '') +
    String(Math.floor(total / 60) % 60).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0')
}

function buildScenes(words: SourceWord[], edits: Props['initialEdits']): Scene[] {
  const active = sourceWordsForClipEditing(words, edits).filter((w) => w.e * 1000 >= edits.trim.in && w.s * 1000 <= edits.trim.out)
  const starts = new Set<number>([edits.trim.in])
  const preview = editorPreviewEdits(edits, words)
  if (edits.markers?.length) {
    const tb = timebaseFor(preview)
    for (const marker of edits.markers) {
      const ms = outputToSource(tb, marker.ms)
      if (ms > edits.trim.in && ms < edits.trim.out) starts.add(ms)
    }
  } else {
    const breaks = paragraphStarts(active, (w) => wordDisplayText(w, edits.wordFixes))
    for (let i = 0; i < active.length; i++) {
      const word = active[i]!
      const previous = active[i - 1]
      const speakerChanged = Boolean(previous && previous.spk !== word.spk && previous.spk != null && word.spk != null)
      if ((breaks.has(word.i) || speakerChanged) && word.s * 1000 < edits.trim.out) starts.add(Math.max(edits.trim.in, Math.round(word.s * 1000)))
    }
  }
  const ordered = [...starts].sort((a, b) => a - b)
  const sourceScenes = ordered.map((start, index) => {
    const end = ordered[index + 1] ?? edits.trim.out
    const phrase = active.filter((w) => w.s * 1000 >= start && w.s * 1000 < end).slice(0, 7)
      .map((w) => wordDisplayText(w, edits.wordFixes)).join(' ').trim()
    return { start, end, id: 'scene-' + Math.round(start) + '-' + Math.round(end), label: phrase || 'Scene ' + (index + 1) }
  }).filter((s) => s.end > s.start)
  const tb = timebaseFor(preview)
  return sourceScenes.sort((a, b) => sourceToOutputSnapped(tb, a.start) - sourceToOutputSnapped(tb, b.start))
}

function savedBrandCatalogItem(brand: BrandRow): CatalogItem {
  const primary = brand.settings.primaryColor ?? '#111827'
  return {
    kind: 'brand_starter',
    id: 'saved:' + brand.id,
    name: brand.name + (brand.isDefault ? ' · default' : ''),
    tab: 'brand',
    mock: { palette: [primary, '#f8fafc'], captionFont: brand.captionFont ?? 'Inter', savedBrandId: brand.id },
  }
}

/** A separate view of the same clip, EDL, history, and autosave; no timeline is mounted. */
export function TextSceneEditorShell(props: Props) {
  const { clipId, projectId, bounds } = props
  const normalizedWords = useMemo(() => loadSourceWords(props.words), [props.words])
  const [media, setMedia] = useState(props.primaryMedia)
  const [exportOpen, setExportOpen] = useState(false)
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [layoutScope, setLayoutScope] = useState<'scene' | 'clip'>('scene')
  const [documentTab, setDocumentTab] = useState<'transcript' | 'subtitles'>('transcript')
  const [styleTab, setStyleTab] = useState<'templates' | 'logos' | 'subtitles' | 'text' | 'images'>('subtitles')
  const [styleAudition, setStyleAudition] = useState<Props['initialEdits'] | null>(null)
  const [previewZoom, setPreviewZoom] = useState<PreviewZoom>('fit')
  const [dragSceneId, setDragSceneId] = useState<string | null>(null)
  const [dropSceneId, setDropSceneId] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(Boolean(props.initialChatOpen))
  const [chatMounted, setChatMounted] = useState(Boolean(props.initialChatOpen))
  const [chatScope, setChatScope] = useState<EditorChatScope>({ kind: 'whole' })
  const [chatAudition, setChatAudition] = useState<Props['initialEdits'] | null>(null)
  const [title] = useState(props.initialTitle)
  const [playing, setPlaying] = useState(false)
  const [playhead, setPlayhead] = useState(props.initialEdits.trim.in)
  const [derived, setDerived] = useState<{ id: string; durationMs: number } | null>(null)
  const [brands, setBrands] = useState<BrandRow[]>([])
  const [brandsLoading, setBrandsLoading] = useState(true)
  const [brandsError, setBrandsError] = useState<string | null>(null)
  const selectionRef = useRef<TranscriptSelection | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const previewFrameRef = useRef<HTMLDivElement | null>(null)
  const imageUploadRef = useRef<HTMLInputElement | null>(null)
  const tried = useRef(new Set<string>())
  const fallbacks = useMemo(() => editorMediaLoadFallbacks(props.primaryMedia, props.mediaUrls, {
    sourceSegStartMs: props.sourceSegStartMs, sourceSegEndMs: props.sourceSegEndMs,
    clipStartMs: props.clipStartMs, clipEndMs: props.clipEndMs,
  }), [props.primaryMedia, props.mediaUrls, props.sourceSegStartMs, props.sourceSegEndMs, props.clipStartMs, props.clipEndMs])
  const videoUrl = media?.url ?? props.mediaUrls.proxy ?? props.mediaUrls.segment ?? props.mediaUrls.source ?? props.mediaUrls.preview
  const posterUrl = props.posterUrl
  const mediaOffsetMs = media?.offsetMs ?? 0
  const projectMedia = useProjectMedia(projectId)
  const previewRate = useSyncExternalStore(subscribePreviewRate, getPreviewRate, () => 1)
  const captionCatalog = useMemo(() => buildTemplateCatalog().filter((item) => item.tab === 'captions'), [])
  const { edits, setEdits, undo, redo, canUndo, canRedo, saveState, flushSave, applyProducerPatch, applyCleanupCut,
    setWordFix, applyWordFixesBatch, restoreWord, restoreCutRange, setTrim, setLayoutMode,
    syncWordsForCuts } = useEditorState(clipId, bounds, props.initialEdits, {
      serverUpdatedAt: props.serverUpdatedAt, editsSaveVersion: props.editsSaveVersion, words: normalizedWords,
      editorSaveSeq: typeof (props.aiMeta as { __editorSaveSeq?: number } | null)?.__editorSaveSeq === 'number'
        ? (props.aiMeta as { __editorSaveSeq: number }).__editorSaveSeq : 0,
    })
  const { words, wordsLoading, loadingReason, reloadWords } = useEditorWords(clipId, normalizedWords, bounds, edits.trim)
  useEffect(() => { console.info('[editor:text] save-state', { projectId, clipId, status: saveState }) }, [projectId, clipId, saveState])
  useEffect(() => { syncWordsForCuts(words) }, [words, syncWordsForCuts])
  useEffect(() => {
    console.info('[editor:text] route-entry', { projectId, clipId })
    console.info('[editor:text] edits-hydrate', { projectId, clipId, version: props.editsSaveVersion })
  }, [projectId, clipId, props.editsSaveVersion])
  const loadBrands = useCallback(async () => {
    setBrandsLoading(true)
    setBrandsError(null)
    try {
      const data = await clipsFetch<{ items: BrandRow[] }>('/api/clips/brand/templates')
      setBrands(data.items ?? [])
      console.info('[editor:text-gaps] brand-load', { projectId, clipId, count: data.items?.length ?? 0 })
    } catch {
      setBrandsError('Brand kits unavailable')
      console.error('[editor:text-gaps] brand-load-failed', { projectId, clipId })
    } finally {
      setBrandsLoading(false)
    }
  }, [projectId, clipId])
  useEffect(() => { void loadBrands() }, [loadBrands])
  useEffect(() => {
    console.info('[editor:text-gaps] save', { projectId, clipId, status: saveState })
  }, [projectId, clipId, saveState])

  const previewEdits = useMemo(() => editorPreviewEdits(chatAudition ?? styleAudition ?? edits, words), [chatAudition, styleAudition, edits, words])
  const latestEditsRef = useRef(edits)
  latestEditsRef.current = edits
  const openChat = useCallback(async () => {
    if (chatOpen) {
      setChatOpen(false)
      setChatAudition(null)
      console.info('[editor:chat-mode] close', { projectId, clipId })
      return
    }
    try {
      await flushSave()
      setChatMounted(true)
      setChatOpen(true)
      console.info('[editor:chat-mode] open', { projectId, clipId })
    } catch {
      toast.error('Save edits before opening AI chat')
      console.error('[editor:chat-mode] open-blocked-save', { projectId, clipId })
    }
  }, [chatOpen, clipId, projectId, flushSave])
  const useChatSelection = useCallback(() => {
    const selection = selectionRef.current
    if (!selection || selection.endMs <= selection.startMs) {
      toast.message('Select words in the transcript first')
      return
    }
    setChatScope({ kind: 'range', startMs: selection.startMs, endMs: selection.endMs, label: 'Selected transcript' })
    console.info('[editor:chat-mode] selection-context', { projectId, clipId, startMs: selection.startMs, endMs: selection.endMs })
  }, [projectId, clipId])
  const acceptChatProposal = useCallback(async (next: Props['initialEdits'], before: Props['initialEdits'], count: number) => {
    const beforeHash = canonicalEditsJson(before)
    if (canonicalEditsJson(latestEditsRef.current) !== beforeHash) throw new Error('Local edits changed. Discard and replan.')
    await flushSave()
    const latest = await clipsFetch<{ edits: Props['initialEdits'] }>(`/api/clips/clips/${encodeURIComponent(clipId)}`)
    if (canonicalEditsJson(latest.edits) !== beforeHash || canonicalEditsJson(latestEditsRef.current) !== beforeHash) {
      throw new Error('The clip changed on the server. Discard this proposal and replan.')
    }
    if (count <= 0 || canonicalEditsJson(next) === beforeHash) throw new Error('No editable changes to accept.')
    applyProducerPatch(next, before, count, 'Chat Producer')
    console.info('[editor:chat-mode] accept-to-shared-edit', { projectId, clipId, count })
  }, [clipId, projectId, flushSave, applyProducerPatch])
  const scenes = useMemo(() => buildScenes(words, edits), [words, edits])
  const sceneKey = scenes.map((s) => s.start).join(',')
  useEffect(() => console.info('[editor:text] scene-list-built', { projectId, clipId, count: scenes.length }), [projectId, clipId, sceneKey, scenes.length])
  const frameExtractor = useFilmstripFrames(videoUrl)
  const framesAt = useMemo(() => scenes.map((scene) => Math.max(0, scene.start - mediaOffsetMs + 100)), [scenes, mediaOffsetMs])
  const frameKey = framesAt.join(',')
  const thumbStartedRef = useRef(0)
  useEffect(() => {
    if (!frameExtractor || !framesAt.length) return
    thumbStartedRef.current = Date.now()
    console.info('[editor:text] thumbnail-backfill-started', { projectId, clipId, count: framesAt.length, hasMedia: Boolean(videoUrl) })
    frameExtractor.want(framesAt, 1000)
  }, [frameExtractor, frameKey, projectId, clipId, videoUrl])
  const readyThumbnails = frameExtractor ? framesAt.filter((t) => Boolean(frameExtractor.get(t, 1000))).length : 0
  const thumbDoneRef = useRef('')
  useEffect(() => {
    if (!frameExtractor || !framesAt.length || (!frameExtractor.failed && readyThumbnails < framesAt.length)) return
    const key = clipId + ':' + frameKey + ':' + (frameExtractor.failed ? 'failed' : 'ready')
    if (thumbDoneRef.current === key) return
    thumbDoneRef.current = key
    console.info('[editor:text] thumbnail-backfill-finished', {
      projectId, clipId, count: readyThumbnails, failed: frameExtractor.failed, elapsedMs: Date.now() - thumbStartedRef.current,
    })
  }, [frameExtractor, frameKey, framesAt.length, readyThumbnails, projectId, clipId])
  const onMediaError = useCallback(() => {
    if (media?.url) tried.current.add(media.url)
    const next = fallbacks.find((candidate) => !tried.current.has(candidate.url))
    if (next) {
      tried.current.add(next.url)
      setMedia(next)
    } else {
      console.error('[editor:text] media-fallback-exhausted', { projectId, clipId })
    }
  }, [media?.url, fallbacks, projectId, clipId])
  const seekSource = useCallback((ms: number) => {
    const sourceMs = Math.max(edits.trim.in, Math.min(edits.trim.out, ms))
    setPlayhead(sourceMs)
    if (videoRef.current) videoRef.current.currentTime = videoTimeFromSourceMs(sourceMs, mediaOffsetMs)
  }, [edits.trim.in, edits.trim.out, mediaOffsetMs])
  const openTemplates = async () => {
    console.info('[editor:templates-mode] text-entry', { projectId, clipId })
    try { await flushSave() } catch {
      toast.error('Save edits before switching editors')
      return
    }
    window.location.assign(routes.templateMode(projectId, clipId, props.clipperStudio ? { from: 'studio' } : undefined))
  }
  const openStoryBlocks = async () => {
    console.log('[editor:story-mode] text-handoff', { projectId, clipId })
    try { await flushSave() } catch {
      toast.error('Save edits before switching editors')
      return
    }
    window.location.assign(routes.story(projectId, clipId, props.clipperStudio ? { from: 'studio' } : undefined))
  }
  const openClipEditor = async () => {
    console.info('[editor:text] open-in-clip-editor', { projectId, clipId })
    try { await flushSave() } catch {
      toast.error('Save edits before switching editors')
      return
    }
    console.info('[editor:compact-mode] open-from-text-editor', { projectId, clipId, target: props.clipperStudio ? 'studio' : 'edit' })
    window.location.assign(props.clipperStudio ? routes.studio(projectId, clipId) : routes.edit(projectId, clipId))
  }
  const openGenerateMode = async () => {
    console.info('[editor:generate-mode] text-handoff-start', { projectId, clipId, atMs: Math.round(playhead) })
    try {
      await flushSave()
      console.info('[editor:generate-mode] text-handoff-saved', { projectId, clipId })
      window.location.assign(routes.generate(projectId, clipId, {
        atMs: String(Math.round(playhead)),
        ...(props.clipperStudio ? { from: 'studio' } : {}),
      }))
    } catch {
      console.error('[editor:generate-mode] text-handoff-save-failed', { projectId, clipId })
      toast.error('Save edits before switching editors.')
    }
  }

  const createClip = useCallback(async (start: number, end: number, clipTitle?: string) => {
    console.info('[editor:text] create-clip-started', { projectId, clipId, startMs: start, endMs: end })
    try {
      await flushSave()
      const snapped = snapTranscriptSelectionMs(start, end, words, edits.trim.in, edits.trim.out)
      const created = await deriveClipFromEditor(clipId, { trimIn: snapped.trimIn, trimOut: snapped.trimOut, title: clipTitle || snapped.title })
      if (created.projectId !== projectId) throw new Error('Clip was not created in this project')
      setDerived({ id: created.clipId, durationMs: snapped.trimOut - snapped.trimIn })
      console.info('[editor:text] create-clip-finished', { projectId, clipId, newClipId: created.clipId })
      toast.success('Clip added to this project')
    } catch (error) {
      console.error('[editor:text] create-clip-failed', { projectId, clipId, name: error instanceof Error ? error.name : 'UnknownError' })
      toast.error(error instanceof Error ? error.message : 'Could not create clip')
    }
  }, [clipId, projectId, words, edits.trim.in, edits.trim.out, flushSave])
  const highlightSelection = useCallback((indices: number[]) => {
    if (!indices.length) return
    const current = edits.captions.emphasis ?? []
    const allSelected = indices.every((i) => current.includes(i))
    const next = allSelected ? current.filter((i) => !indices.includes(i)) : [...new Set([...current, ...indices])]
    setEdits({ ...edits, captions: { ...edits.captions, enabled: true, keywordHighlight: true, emphasis: next } })
    console.info('[editor:text] emphasis-selection', { projectId, clipId, words: indices.length, enabled: !allSelected })
  }, [edits, setEdits, projectId, clipId])
  const activeScene = Math.max(0, scenes.findIndex((s) => playhead >= s.start && playhead < s.end))
  const selectedScene = scenes[activeScene] ?? null
  const sceneWordSpans = useMemo(
    () => words.map((word) => ({ startMs: Math.round(word.s * 1000), endMs: Math.round(word.e * 1000) })),
    [words],
  )
  const sceneHasCuts = Boolean(selectedScene && edits.cutRanges.some(([start, end]) => start < selectedScene.end && end > selectedScene.start))
  const activeSceneLayout = selectedScene
    ? layoutModeAtSourceMs(edits, Math.max(selectedScene.start, Math.min(selectedScene.end - 1, (selectedScene.start + selectedScene.end) / 2)))
    : edits.layout.mode
  const imageItems = projectMedia.items.filter((item) => item.mediaType === 'image')

  const addSceneBoundary = (scene: Scene, side: 'before' | 'after') => {
    const selection = selectionRef.current
    if (!selection || selection.endMs <= selection.startMs) {
      toast.message('Select words inside this scene first')
      return
    }
    const boundarySourceMs = side === 'before' ? selection.startMs : selection.endMs
    if (boundarySourceMs <= scene.start + 200 || boundarySourceMs >= scene.end - 200) {
      toast.message('Selection boundary must be inside this scene')
      return
    }
    const preview = editorPreviewEdits(edits, words)
    const tb = timebaseFor(preview)
    const seeded = edits.markers?.length
      ? [...edits.markers]
      : scenes.slice(1).map((row, index) => ({
          id: 'scene_seed_' + index + '_' + Math.round(row.start),
          ms: sourceToOutputSnapped(tb, row.start),
          color: 'blue' as const,
        }))
    const outputMs = sourceToOutputSnapped(tb, boundarySourceMs)
    if (markerAt(seeded, outputMs)) {
      toast.message('A scene boundary already exists here')
      return
    }
    const id = 'scene_' + Date.now().toString(36) + '_' + Math.round(outputMs)
    const markers = normalizeMarkers([...seeded, { id, ms: outputMs, color: 'blue' as const }])
    setEdits({ ...edits, markers })
    seekSource(boundarySourceMs)
    console.info('[editor:text-gaps] boundary', {
      projectId,
      clipId,
      sceneId: scene.id,
      side,
      boundarySourceMs: Math.round(boundarySourceMs),
      markerCount: markers?.length ?? 0,
      history: 1,
    })
  }

  const moveSceneOne = (scene: Scene, dir: 'up' | 'down') => {
    const nextOrder = moveSelection(edits, [scene.start, scene.end], dir, sceneWordSpans)
    if (!nextOrder) {
      toast.message(dir === 'up' ? 'This scene is already first' : 'This scene is already last')
      return
    }
    setEdits({ ...edits, sectionOrder: nextOrder })
    seekSource(scene.start)
    console.info('[editor:text-gaps] reorder', {
      projectId,
      clipId,
      sceneId: scene.id,
      direction: dir,
      blocks: nextOrder.length,
      history: 1,
    })
  }

  const moveSceneTo = (scene: Scene, targetIndex: number) => {
    const fromIndex = scenes.findIndex((row) => row.id === scene.id)
    if (fromIndex < 0 || targetIndex < 0 || targetIndex >= scenes.length || targetIndex === fromIndex) return
    const dir: 'up' | 'down' = targetIndex < fromIndex ? 'up' : 'down'
    let working = edits
    let moved = 0
    const steps = Math.abs(targetIndex - fromIndex)
    for (let index = 0; index < steps; index += 1) {
      const nextOrder = moveSelection(working, [scene.start, scene.end], dir, sceneWordSpans)
      if (!nextOrder) break
      working = { ...working, sectionOrder: nextOrder }
      moved += 1
    }
    if (!moved) return
    setEdits(working)
    seekSource(scene.start)
    console.info('[editor:text-gaps] reorder-drop', {
      projectId,
      clipId,
      sceneId: scene.id,
      fromIndex,
      targetIndex,
      moved,
      history: 1,
    })
  }

  const applyLayoutPick = (mode: Parameters<typeof setLayoutMode>[0], facecam?: Parameters<typeof setLayoutMode>[1]) => {
    if (layoutScope === 'clip') {
      setLayoutMode(mode, facecam)
      console.info('[editor:text-gaps] layout', { projectId, clipId, scope: 'whole-clip', mode, history: 1 })
      return
    }
    if (!selectedScene || selectedScene.end - selectedScene.start < 400 || sceneHasCuts) {
      toast.message('This scene does not have one contiguous source range')
      return
    }
    let next = splitLayoutSegmentAt(edits, selectedScene.start)
    next = splitLayoutSegmentAt(next, selectedScene.end)
    const atMs = Math.max(selectedScene.start, Math.min(selectedScene.end - 1, (selectedScene.start + selectedScene.end) / 2))
    next = setLayoutModeForSegmentAt(next, atMs, mode)
    if (facecam) next = { ...next, layout: { ...next.layout, facecam } }
    setEdits(next)
    console.info('[editor:text-gaps] layout', {
      projectId,
      clipId,
      scope: 'scene',
      sceneId: selectedScene.id,
      startMs: Math.round(selectedScene.start),
      endMs: Math.round(selectedScene.end),
      mode,
      history: 1,
    })
  }

  const previewCaptionStyle = (item: CatalogItem | null) => {
    if (!item) {
      setStyleAudition(null)
      return
    }
    setStyleAudition(captionPresetPatch(edits, item.id))
    console.info('[editor:text-gaps] style-preview', { projectId, clipId, styleId: item.id })
  }

  const applyCaptionStyle = (item: CatalogItem) => {
    setEdits(captionPresetPatch(edits, item.id))
    setStyleAudition(null)
    console.info('[editor:text-gaps] style-apply', { projectId, clipId, styleId: item.id, history: 1 })
  }

  const previewBrand = (brand: BrandRow | null) => {
    if (!brand) {
      setStyleAudition(null)
      return
    }
    try {
      setStyleAudition(applyBrandTemplateToEdits(edits, brand))
      console.info('[editor:text-gaps] brand-preview', { projectId, clipId, brandId: brand.id })
    } catch {
      setStyleAudition(null)
    }
  }

  const applyBrand = (brand: BrandRow) => {
    try {
      setEdits(applyBrandTemplateToEdits(edits, brand))
      setStyleAudition(null)
      console.info('[editor:text-gaps] brand-apply', { projectId, clipId, brandId: brand.id, history: 1 })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Brand kit unavailable')
    }
  }

  const isPending = wordsLoading || (!words.length && props.projectStatus !== 'ready' && props.projectStatus !== 'READY')
  return (
    <ClipperSurfaceErrorBoundary surface="Text editor">
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground" data-testid="text-scene-editor">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4">
          <Button variant="ghost" size="icon" aria-label="Back to project" render={<Link href={routes.project(projectId)} />}><ArrowLeft className="size-4" /></Button>
          <div className="min-w-0">
            <p className="truncate text-[11px] text-muted-foreground">{props.projectTitle}</p>
            <h1 className="max-w-[300px] truncate text-sm font-semibold">{title}</h1>
          </div>
          <Button size="sm" variant="ghost" render={<Link href={routes.project(projectId)} />} className="hidden sm:inline-flex">All clips</Button>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground" aria-live="polite">{saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Save failed' : 'Saving…'}</span>
          {saveState === 'error' && <Button size="sm" variant="outline" onClick={() => void flushSave().catch(() => toast.error('Save retry failed'))}>Retry save</Button>}
          <Button variant="ghost" size="icon" disabled={!canUndo} aria-label="Undo" onClick={() => { undo(); console.info('[editor:text] undo', { projectId, clipId }) }}><Undo2 className="size-4" /></Button>
          <Button variant="ghost" size="icon" disabled={!canRedo} aria-label="Redo" onClick={() => { redo(); console.info('[editor:text] redo', { projectId, clipId }) }}><Redo2 className="size-4" /></Button>
          <Button size="sm" variant={chatOpen ? 'secondary' : 'outline'} aria-expanded={chatOpen} aria-controls="editor-chat-mode" onClick={() => void openChat()}><MessageSquare className="mr-1 size-4" />Chat / Producer</Button>
          <Button size="sm" variant="outline" onClick={() => { setExportOpen(true); console.info('[editor:text] export-opened', { projectId, clipId }) }}><Download className="mr-1 size-4" />Export</Button>
          <Button size="sm" variant="outline" onClick={() => void openStoryBlocks()}>Story blocks</Button>
          <Button size="sm" variant="outline" onClick={() => void openTemplates()}><Palette className="mr-1 size-4" />Templates</Button>
          <Button size="sm" variant="outline" onClick={() => void openGenerateMode()}>Change this shot</Button>
          <Button size="sm" onClick={() => void openClipEditor()}><Clapperboard className="mr-1 size-4" />Open in clip editor</Button>
        </header>
        <div className="flex min-h-0 flex-1">
          <nav className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-border bg-card/60 py-4" aria-label="Text editing tools">
            <button type="button" className={editorIconBtn + ' ' + editorIconBtnActive} aria-label="Scenes" aria-current="page" title="Scenes"><FileText className="size-5" /></button>
            <button type="button" className={editorIconBtn} title="Search words" aria-label="Find in transcript" onClick={() => window.dispatchEvent(new Event('transovo:find-transcript'))}><Search className="size-5" /></button>
          </nav>
          <aside className="flex w-48 shrink-0 flex-col border-r border-border bg-card/40 xl:w-56" aria-label="Scenes">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4"><h2 className="text-sm font-semibold">Scenes</h2><span className="text-xs text-muted-foreground">{scenes.length}</span></div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              {scenes.map((scene, index) => {
                const frameMs = Math.max(0, scene.start - mediaOffsetMs + 100)
                const frame = frameExtractor?.get(frameMs, 1000)
                const active = activeScene === index
                const dropping = dropSceneId === scene.id && dragSceneId !== scene.id
                return (
                  <div
                    key={scene.id}
                    draggable
                    onDragStart={(event) => {
                      setDragSceneId(scene.id)
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', scene.id)
                      console.info('[editor:text-gaps] reorder-drag-start', { projectId, clipId, sceneId: scene.id, index })
                    }}
                    onDragOver={(event) => {
                      if (!dragSceneId || dragSceneId === scene.id) return
                      event.preventDefault()
                      setDropSceneId(scene.id)
                    }}
                    onDragLeave={() => { if (dropSceneId === scene.id) setDropSceneId(null) }}
                    onDrop={(event) => {
                      event.preventDefault()
                      const sourceId = dragSceneId || event.dataTransfer.getData('text/plain')
                      const source = scenes.find((row) => row.id === sourceId)
                      if (source) moveSceneTo(source, index)
                      setDragSceneId(null)
                      setDropSceneId(null)
                    }}
                    onDragEnd={() => { setDragSceneId(null); setDropSceneId(null) }}
                    className={'overflow-hidden rounded-xl border bg-card shadow-sm transition-all ' +
                      (active ? 'border-primary ring-2 ring-primary/15 ' : 'border-border ') +
                      (dropping ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : '')}
                    data-testid="text-scene-card"
                    data-scene-id={scene.id}
                  >
                    {dropping ? <div className="border-b border-primary/40 bg-primary/10 px-2 py-1 text-center text-[10px] font-medium text-primary">Drop scene here</div> : null}
                    <button type="button" className="block w-full text-left" onClick={() => {
                      seekSource(scene.start)
                      console.info('[editor:text] scene-selected', { projectId, clipId, scene: index, startMs: scene.start })
                    }}>
                      <div className="flex items-center justify-between gap-2 px-2.5 pt-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Scene {index + 1}</span>
                        <span className="flex items-center gap-1 text-[10px] tabular-nums text-muted-foreground">
                          {active ? <span className="size-1.5 rounded-full bg-primary" aria-label="Active scene" /> : null}
                          {clock(scene.end - scene.start)}
                        </span>
                      </div>
                      <div className="relative mx-2.5 mt-1.5 aspect-video overflow-hidden rounded-md bg-muted">
                        {frame ? <img src={frame} alt={'Frame from scene ' + (index + 1)} className="h-full w-full object-cover" /> :
                          frameExtractor?.failed && videoUrl ?
                            <video src={videoUrl + '#t=' + Math.max(0, frameMs / 1000).toFixed(2)} preload="metadata" muted playsInline className="h-full w-full object-cover" aria-label={'Scene ' + (index + 1) + ' frame'} /> :
                            posterUrl ? <img src={posterUrl} alt="Video poster while scene frame loads" className="h-full w-full object-cover opacity-70" /> :
                              <div className="flex h-full items-center justify-center text-xs text-muted-foreground"><Loader2 className="mr-1 size-4 animate-spin" />Preparing frame</div>}
                      </div>
                      <p className="px-2.5 py-2 text-xs leading-snug">{scene.label}</p>
                    </button>
                    <div className="flex items-center justify-between border-t border-border px-1.5 py-1">
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground" title="Drag to reorder. Use the menu for keyboard-accessible Move up/down.">
                        <GripVertical className="size-3.5" />Drag
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={'Scene ' + (index + 1) + ' actions'}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => addSceneBoundary(scene, 'before')}>Insert before</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => addSceneBoundary(scene, 'after')}>Insert after</DropdownMenuItem>
                          <DropdownMenuItem disabled={index === 0} onClick={() => moveSceneOne(scene, 'up')}>Move up</DropdownMenuItem>
                          <DropdownMenuItem disabled={index === scenes.length - 1} onClick={() => moveSceneOne(scene, 'down')}>Move down</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}
              {!scenes.length && <p className="px-2 py-5 text-center text-xs text-muted-foreground">Scenes appear with the transcript.</p>}
            </div>
          </aside>
          <main className="flex min-h-0 min-w-[300px] flex-[1.15] flex-col bg-card" aria-label="Transcript document">
            <div className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
              <div className="flex rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label="Transcript editing mode" data-testid="text-document-tabs">
                <Button type="button" size="sm" variant={documentTab === 'transcript' ? 'secondary' : 'ghost'} aria-pressed={documentTab === 'transcript'} onClick={() => { setDocumentTab('transcript'); console.info('[editor:text-gaps] document-tab', { projectId, clipId, tab: 'transcript' }) }}>Transcript</Button>
                <Button type="button" size="sm" variant={documentTab === 'subtitles' ? 'secondary' : 'ghost'} aria-pressed={documentTab === 'subtitles'} onClick={() => { setDocumentTab('subtitles'); console.info('[editor:text-gaps] document-tab', { projectId, clipId, tab: 'subtitles' }) }}>Edit subtitles</Button>
              </div>
              <Button size="sm" variant="ghost" aria-label="Search transcript" onClick={() => {
                setDocumentTab('transcript')
                window.setTimeout(() => window.dispatchEvent(new Event('transovo:find-transcript')), 0)
              }}><Search className="mr-1 size-4" />Search</Button>
            </div>
            {documentTab === 'subtitles' ? (
              <div className="min-h-0 flex-1 overflow-y-auto" data-testid="text-scene-subtitles">
                <CaptionsPanel clipId={clipId} edits={edits} words={words}
                  onWordFix={(index, value, meta) => setWordFix(index, value, meta)}
                  onChange={(captions) => setEdits({ ...edits, captions })}
                  onEdits={setEdits} compactProperties />
              </div>
            ) : isPending && !words.length ? <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"><Loader2 className="size-6 animate-spin text-primary" /><p className="text-sm font-medium">Transcribing recording</p><p className="text-xs text-muted-foreground">Words and scenes will appear when the transcript is ready.</p><Button size="sm" variant="outline" onClick={() => void reloadWords().catch(() => toast.error('Transcript refresh failed'))}><RefreshCw className="mr-1 size-4" />Refresh transcript</Button></div> :
              !words.length ? <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"><FileText className="size-7 text-muted-foreground" /><p className="text-sm font-medium">No spoken words found yet</p><p className="text-xs text-muted-foreground">You can retry loading the transcript or open this clip in the regular editor.</p><Button variant="outline" size="sm" onClick={() => void reloadWords().catch(() => toast.error('Transcript refresh failed'))}><RefreshCw className="mr-1 size-4" />Retry</Button></div> :
                <TranscriptPanel
                  words={words} wordsLoading={wordsLoading} wordsLoadingReason={loadingReason} shots={props.cropShots}
                  edits={edits} clipStartMs={bounds.clipStartMs} clipEndMs={bounds.clipEndMs} selectionRef={selectionRef}
                  onSeek={seekSource} onAddCut={(range) => {
                    console.info('[editor:text] sentence-delete', { projectId, clipId, range })
                    applyCleanupCut(range)
                  }}
                  onWordFix={(index, text, meta) => { console.info('[editor:text] transcript-word-updated', { projectId, clipId, wordIndex: index }); setWordFix(index, text, meta) }} applyWordFixesBatch={(fixes, meta) => { console.info('[editor:text] transcript-words-updated', { projectId, clipId, count: Object.keys(fixes).length }); applyWordFixesBatch(fixes, meta) }} onRestoreWord={restoreWord}
                  onRestoreCutRange={restoreCutRange} onExtendTrim={(ms) => setTrim({ in: Math.min(ms, edits.trim.in), out: Math.max(ms, edits.trim.out) })}
                  onSaveAsNewClip={createClip} onEmphasisSelection={highlightSelection} textSceneMode
                  playheadSourceMs={playhead} onSetEdits={setEdits} compactToolbar largeScript
                />}
          </main>
          <section className="flex min-w-[280px] flex-[1] flex-col border-l border-border bg-background" aria-label="Video preview">
            <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
              <span className="text-xs font-semibold">Preview</span>
              <div className="flex items-center gap-2">
                {selectedScene ? <span className="hidden text-[10px] tabular-nums text-muted-foreground xl:inline">{clock(selectedScene.start - edits.trim.in)}–{clock(selectedScene.end - edits.trim.in)}</span> : null}
                <Button size="sm" variant="outline" disabled={!selectedScene || sceneHasCuts}
                  title={sceneHasCuts ? 'Scene layout is disabled because this scene contains a cut.' : 'Change layout for this scene only'}
                  onClick={() => { setLayoutScope('scene'); setLayoutOpen(true); console.info('[editor:text-gaps] layout-open', { projectId, clipId, scope: 'scene', sceneId: selectedScene?.id ?? null }) }}>
                  This scene · {String(activeSceneLayout).replace(/_/g, ' ')}
                </Button>
              </div>
            </div>
            <div ref={previewFrameRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted/15 p-3">
              {videoUrl ? <PreviewStage clipId={clipId} videoUrl={videoUrl} posterUrl={posterUrl}
                edits={previewEdits} words={words} cropTrack={props.cropTrack} brollMedia={props.brollMedia}
                media={media} videoRef={videoRef} onEditorMediaError={onMediaError}
                previewZoom={previewZoom} onPreviewZoomChange={setPreviewZoom}
                onTick={(tick) => { setPlayhead(tick.sourceMs); setPlaying(tick.playing) }}
              /> : <div className="space-y-2 text-center"><p className="text-sm">Video is unavailable</p><Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry preview</Button></div>}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2" data-testid="text-preview-layout-footer">
              <label className="flex items-center gap-1 text-xs">Ratio
                <select className="h-7 rounded border border-border bg-background px-1 text-xs" value={edits.aspectRatio ?? '9:16'} onChange={(event) => {
                  const aspect = event.target.value as NonNullable<typeof edits.aspectRatio>
                  setEdits({ ...edits, aspectRatio: aspect })
                  console.info('[editor:text-gaps] aspect', { projectId, clipId, aspect })
                }} aria-label="Aspect ratio">
                  {EXPORT_ASPECT_PRESETS.map((aspect) => <option key={aspect} value={aspect}>{aspect}</option>)}
                </select>
              </label>
              <CanvasBackgroundChip edits={edits} onCommit={(next) => {
                  setEdits(next)
                  console.info('[editor:text-gaps] background', { projectId, clipId, type: next.canvasBg?.type ?? 'legacy', history: 1 })
                }} media={projectMedia} visible={true} compositeLocked={media?.kind === 'composite'} projectId={projectId} clipId={clipId} />
              <Button size="sm" variant="outline" onClick={() => { setLayoutOpen((value) => !value); console.info('[editor:text-gaps] layout-open', { projectId, clipId, scope: layoutScope }) }} aria-expanded={layoutOpen}>Layouts</Button>
            </div>
            {layoutOpen ? <div className="max-h-60 overflow-y-auto border-t border-border bg-card p-3" data-testid="text-scene-layout-picker">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex gap-1" role="group" aria-label="Layout scope">
                  <Button size="sm" variant={layoutScope === 'scene' ? 'secondary' : 'outline'} disabled={!selectedScene || sceneHasCuts} onClick={() => setLayoutScope('scene')} aria-pressed={layoutScope === 'scene'}>This scene</Button>
                  <Button size="sm" variant={layoutScope === 'clip' ? 'secondary' : 'outline'} onClick={() => setLayoutScope('clip')} aria-pressed={layoutScope === 'clip'}>Whole clip</Button>
                </div>
                {layoutScope === 'scene' && selectedScene ? <span className="text-[10px] tabular-nums text-muted-foreground">{clock(selectedScene.end - selectedScene.start)}</span> : null}
              </div>
              {layoutScope === 'scene' && sceneHasCuts ? <p className="mb-2 text-xs text-muted-foreground">This scene has a cut, so a source-contiguous scene layout cannot be applied safely.</p> : null}
              <LayoutQuickPicker value={layoutScope === 'scene' ? activeSceneLayout : edits.layout.mode} edits={edits} facecamLayout={props.facecamLayout} reframeV2Enabled={props.reframeV2Enabled} onPick={applyLayoutPick} onAspectChange={(aspect) => { setEdits({ ...edits, aspectRatio: aspect }); console.info('[editor:text-gaps] aspect', { projectId, clipId, aspect }) }} />
            </div> : null}
            <PreviewTransportStrip compact recordSlot={null} viewSummary={previewZoom === 'fit' ? 'Fit' : previewZoom + '%'}
              viewMenuBody={<div className="flex flex-wrap gap-1" data-testid="text-scene-zoom-menu">
                <Button size="sm" variant={previewZoom === 'fit' ? 'secondary' : 'ghost'} onClick={() => setPreviewZoom('fit')}>Fit</Button>
                {PREVIEW_ZOOM_STEPS.map((zoom) => <Button key={zoom} size="sm" variant={previewZoom === zoom ? 'secondary' : 'ghost'} onClick={() => setPreviewZoom(zoom)}>{zoom}%</Button>)}
              </div>}
              transportSlot={<div className="flex items-center gap-2 text-xs" data-testid="text-scene-preview-transport">
                <span className="font-mono tabular-nums">{clock(playhead - edits.trim.in)}</span>
                <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label={playing ? 'Pause' : 'Play'} onClick={() => {
                  const video = videoRef.current
                  if (!video) return
                  if (video.paused) void video.play().catch(() => toast.error('Preview playback unavailable'))
                  else video.pause()
                }}>{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</Button>
                <span className="font-mono tabular-nums">{clock(edits.trim.out - edits.trim.in)}</span>
                <select className="h-7 rounded border border-border bg-background px-1 text-xs" aria-label="Preview playback speed" value={previewRate} onChange={(event) => setPreviewRate(Number(event.target.value))}>
                  {PREVIEW_RATES.map((rate) => <option key={rate} value={rate}>{rate}x</option>)}
                </select>
              </div>}
              fullscreenSlot={<Button variant="ghost" size="icon" className="size-7" aria-label="Full screen preview" title="Full screen preview" onClick={() => {
                void previewFrameRef.current?.requestFullscreen().catch(() => toast.error('Full screen preview unavailable'))
                console.info('[editor:text-gaps] preview-fullscreen', { projectId, clipId })
              }}><Maximize2 className="size-4" /></Button>} />
            <div className="border-t border-border px-3 py-2">
              <PreviewChipRow>
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs">Original</span>
                <button type="button" className={'rounded-full border px-2.5 py-1 text-xs ' + (edits.captions.enabled !== false ? 'border-primary/30 bg-primary/10' : 'border-border')} onClick={() => setEdits({ ...edits, captions: { ...edits.captions, enabled: edits.captions.enabled === false } })}>Subtitles</button>
                {props.brollMedia.length ? <span className="rounded-full border border-border px-2.5 py-1 text-xs">Attached media</span> : null}
              </PreviewChipRow>
            </div>
            <div className="max-h-[42vh] overflow-y-auto border-t border-border bg-card/60 p-3" data-testid="text-style-brand-panel">
              <div className="mb-3 flex flex-wrap gap-1" role="tablist" aria-label="Brand and style">
                {([['templates','Templates'],['logos','Logos'],['subtitles','Subtitles'],['text','Text styles'],['images','Images']] as const).map(([id,label]) => (
                  <Button key={id} type="button" size="sm" variant={styleTab === id ? 'secondary' : 'ghost'} aria-pressed={styleTab === id} onClick={() => { setStyleTab(id); setStyleAudition(null); console.info('[editor:text-gaps] style-tab', { projectId, clipId, tab: id }) }}>{label}</Button>
                ))}
              </div>
              {styleTab === 'templates' ? <div className="space-y-3">
                <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold">Saved brand templates</p><Button size="sm" variant="outline" onClick={() => void openTemplates()}>Browse templates</Button></div>
                {brandsLoading ? <p className="text-xs text-muted-foreground">Loading saved brands…</p> :
                  brandsError ? <div className="rounded-lg border border-destructive/30 p-2"><p className="text-xs text-destructive">Saved brands could not load.</p><Button size="sm" variant="outline" className="mt-2" onClick={() => void loadBrands()}>Retry</Button></div> :
                  brands.length ? <div className="grid grid-cols-2 gap-2">{brands.map((brand) => {
                    const item = savedBrandCatalogItem(brand)
                    const active = (edits.brand as { templateId?: string } | undefined)?.templateId === brand.id
                    return <div key={brand.id} className={'overflow-hidden rounded-lg border ' + (active ? 'border-primary ring-2 ring-primary/20' : 'border-border')} onMouseEnter={() => previewBrand(brand)} onMouseLeave={() => previewBrand(null)}>
                      <button type="button" className="block w-full text-left" onFocus={() => previewBrand(brand)} onBlur={() => previewBrand(null)}><CatalogTplThumb item={item} /><span className="block truncate px-2 py-1 text-[11px] font-medium">{brand.name}</span></button>
                      <Button type="button" size="sm" variant={active ? 'secondary' : 'outline'} className="m-1 h-7 text-xs" onFocus={() => previewBrand(brand)} onBlur={() => previewBrand(null)} onClick={() => applyBrand(brand)}>{active ? 'Applied' : 'Apply'}</Button>
                    </div>
                  })}</div> : <p className="text-xs text-muted-foreground">No saved brand templates yet.</p>}
              </div> : null}
              {styleTab === 'logos' ? <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Choose the saved brand/logo kit and keep intro/outro settings on the same shared edit.</p>
                <BrandPanel edits={edits} onEdits={(next) => { setEdits(next); setStyleAudition(null); console.info('[editor:text-gaps] brand-controls', { projectId, clipId, history: 1 }) }} />
              </div> : null}
              {styleTab === 'subtitles' ? <div className="space-y-3">
                <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold">Caption styles</p><Button size="sm" variant="outline" onClick={() => setDocumentTab('subtitles')}>Edit typography</Button></div>
                <div className="grid grid-cols-2 gap-2">{captionCatalog.map((item) => {
                  const active = edits.captions.presetId === item.id
                  return <div key={item.id} className={'overflow-hidden rounded-lg border ' + (active ? 'border-primary ring-2 ring-primary/20' : 'border-border')} onMouseEnter={() => previewCaptionStyle(item)} onMouseLeave={() => previewCaptionStyle(null)}>
                    <button type="button" className="block w-full text-left" onFocus={() => previewCaptionStyle(item)} onBlur={() => previewCaptionStyle(null)}><CatalogTplThumb item={item} /><span className="block truncate px-2 py-1 text-[11px] font-medium">{item.name}</span></button>
                    <Button type="button" size="sm" variant={active ? 'secondary' : 'outline'} className="m-1 h-7 text-xs" onFocus={() => previewCaptionStyle(item)} onBlur={() => previewCaptionStyle(null)} onClick={() => applyCaptionStyle(item)}>{active ? 'Applied' : 'Apply'}</Button>
                  </div>
                })}</div>
                <CaptionsPanel clipId={clipId} edits={edits} words={words} onWordFix={(index, value, meta) => setWordFix(index, value, meta)} onChange={(captions) => setEdits({ ...edits, captions })} onEdits={setEdits} compactProperties />
              </div> : null}
              {styleTab === 'text' ? <div className="space-y-2"><p className="text-xs text-muted-foreground">Text styles stay on the existing Templates surface so this view does not invent a second text-item inspector.</p><Button size="sm" variant="outline" onClick={() => void openTemplates()}>Browse text styles</Button></div> : null}
              {styleTab === 'images' ? <div className="space-y-3">
                <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold">Project images</p><Button size="sm" variant="outline" onClick={() => imageUploadRef.current?.click()}>Add images</Button></div>
                <input ref={imageUploadRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => {
                  const files = event.target.files ? [...event.target.files] : []
                  if (files.length) {
                    console.info('[editor:text-gaps] image-add', { projectId, clipId, count: files.length })
                    void projectMedia.uploadFiles(files)
                  }
                  event.target.value = ''
                }} />
                {projectMedia.error ? <div className="rounded-lg border border-destructive/30 p-2"><p className="text-xs text-destructive">Images could not load.</p><Button size="sm" variant="outline" className="mt-2" onClick={() => void projectMedia.refresh()}>Retry</Button></div> :
                  projectMedia.loading ? <p className="text-xs text-muted-foreground">Loading images…</p> :
                  imageItems.length ? <div className="grid grid-cols-2 gap-2">{imageItems.map((item) => <div key={item.id} className="rounded-lg border border-border p-1"><MediaThumb item={item} className="h-20 w-full" /><p className="mt-1 truncate text-[10px] text-muted-foreground">{item.label}</p></div>)}</div> :
                  <p className="text-xs text-muted-foreground">No project images yet.</p>}
              </div> : null}
              {derived && <Link href={routes.edit(projectId, derived.id)} className="mt-3 block text-xs font-medium text-primary underline">Open newly created clip <span className="ml-1 rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px]">{clock(derived.durationMs)}</span></Link>}
            </div>
          </section>
          {chatMounted && <>
            {chatOpen && <button type="button" className="fixed inset-0 z-40 bg-black/40 2xl:hidden" aria-label="Close AI chat drawer" onClick={() => { setChatOpen(false); setChatAudition(null); console.info('[editor:chat-mode] drawer-closed', { projectId, clipId }) }} />}
            <div id="editor-chat-mode" role="dialog" aria-modal={chatOpen ? true : undefined} aria-label="Edit with AI" className={chatOpen ? 'fixed inset-y-0 right-0 z-50 w-[min(420px,100vw)] shadow-xl 2xl:static 2xl:z-auto 2xl:w-[360px] 2xl:shrink-0 2xl:shadow-none' : 'hidden'}>
              <EditorChatRail
                open={chatOpen} clipId={clipId} projectId={projectId} bounds={bounds} edits={edits} saveState={saveState} scope={chatScope} canUndo={canUndo}
                onClose={() => { setChatOpen(false); setChatAudition(null) }}
                onUseSelection={useChatSelection}
                onUseScene={() => {
                  const scene = scenes[activeScene]
                  if (!scene) { toast.message('No scene is available'); return }
                  setChatScope({ kind: 'scene', startMs: scene.start, endMs: scene.end, label: 'Scene ' + (activeScene + 1) })
                  console.info('[editor:chat-mode] scene-context', { projectId, clipId, sceneIndex: activeScene, startMs: scene.start, endMs: scene.end })
                }}
                onClearScope={() => { setChatScope({ kind: 'whole' }); console.info('[editor:chat-mode] whole-context', { projectId, clipId }) }}
                onSeek={seekSource} onAudition={setChatAudition}
                onBeforeSend={async () => { await flushSave() }}
                onAccept={acceptChatProposal} onUndo={undo} onRetrySave={flushSave}
              />
            </div>
          </>}
        </div>
        <ExportDialog clipId={clipId} title={title} edits={edits} words={words} open={exportOpen}
          onClose={() => setExportOpen(false)} onBeforeExport={flushSave} onEdits={setEdits}
          onAspectChange={(aspect) => setEdits({ ...edits, aspectRatio: aspect })} layoutMode={edits.layout.mode}
          onLayoutModeChange={setLayoutMode} facecamLayout={props.facecamLayout} reframeV2Enabled={props.reframeV2Enabled}
          posterUrl={posterUrl} aiMeta={props.aiMeta} fullVideo={props.fullVideo}
        />
      </div>
    </ClipperSurfaceErrorBoundary>
  )
}
