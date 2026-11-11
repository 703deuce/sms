'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, AudioLines, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clapperboard, FileText, GripVertical, ImageIcon, Layers3, LayoutGrid, Loader2, Palette, Pencil, Plus, RefreshCw, Scissors, Search, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ClipperSurfaceErrorBoundary } from '@/components/clips/clipper-surface-error-boundary'
import type { EditorClipShell } from '@/components/clips/editor/editor-clip-shell'
import { PreviewStage, seekToOutputMs } from '@/components/clips/editor/preview-stage'
import { PlayerControls } from '@/components/clips/editor/player-controls'
import { LayersPanel } from '@/components/clips/editor/layers-panel'
import { LayoutPanel } from '@/components/clips/editor/layout-panel'
import { BrandPanel } from '@/components/clips/editor/brand-panel'
import { CaptionsPanel } from '@/components/clips/editor/captions-panel'
import { ExportDialog } from '@/components/clips/editor/export-dialog'
import { LayoutQuickPicker } from '@/components/clips/editor/layout-quick-picker'
import { StockBrollPicker } from '@/components/clips/editor/stock-broll-picker'
import { useEditorState } from '@/components/clips/editor/use-editor-state'
import { useEditorWords } from '@/components/clips/editor/use-editor-words'
import { useFilmstripFrames } from '@/components/clips/editor/timeline/use-filmstrip-frames'
import { editorMediaLoadFallbacks } from '@/lib/server/clips/editor-clip-media'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import { displayDurationMs, displayPositionMs, editMsAtDisplayMs, wordDisplayText, type ClipEditsV2 } from '@/lib/clips/edits'
import { outputToSource, outputToSourceEnd, sourceToOutput, timebaseFor, videoLaneSegments, type Timebase } from '@/lib/clips/editor/clip-timeline'
import { deleteRange, moveVideoSegment } from '@/lib/clips/editor/timeline-edit-ops'
import { videoTimeFromSourceMs } from '@/lib/clips/editor-playback'
import { normalizeMarkers, MAX_MARKERS } from '@/lib/clips/editor/markers'
import { loadSourceWords, type SourceWord } from '@/lib/clips/source-words'
import { paragraphStarts } from '@/lib/clips/editor/transcript-edit'
import { sourceWordsForClipEditing } from '@/lib/clips/editor/clip-editor-word-scope'
import { captionPresetPatch, captionStyleOptions } from '@/lib/clips/editor/starter-templates'
import { applyCaptionStyleSnapshot } from '@/lib/clips/editor/caption-style-snapshot'
import { t6CaptionPresetsEnabled } from '@/lib/clips/t6-feature-flags'
import { splitLayoutSegmentAt, setLayoutModeForSegmentAt } from '@/lib/clips/layout-segments'
import { clipsFetch, requestClipReframe } from '@/lib/clips-api'
import { routes } from '@/lib/routes'
import type { EditorModeSwitcherMode } from '@/components/clips/editor/editor-mode-switcher'
import { StandaloneEditorChrome, finishStandaloneLayoutHandoff } from '@/components/clips/editor/standalone-editor-chrome'
import type { BrollMediaRow } from '@/lib/server/clips/broll-media'

type Props = Parameters<typeof EditorClipShell>[0]
type Scene = { id: string; startMs: number; endMs: number; sourceStartMs: number; sourceEndMs: number; label: string }
type Rail = 'story' | 'visuals' | 'audio' | 'layouts' | 'text' | 'styles' | 'brand'
type CustomCaptionStyle = { id: string; name: string; config: Record<string, unknown> }

function clock(ms: number) {
  const s = Math.floor(Math.max(0, ms) / 1000)
  return (s >= 3600 ? String(Math.floor(s / 3600)).padStart(2, '0') + ':' : '') +
    String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
}

function aspectName(aspect: ClipEditsV2['aspectRatio']) {
  if (aspect === '16:9') return 'Widescreen 16:9'
  if (aspect === '9:16' || !aspect) return 'Vertical 9:16'
  if (aspect === '1:1') return 'Square 1:1'
  return String(aspect)
}

/** View of the authoritative OUTPUT EDL, not a second scene document. */
function storyScenes(tb: Timebase, words: SourceWord[], edits: ClipEditsV2): Scene[] {
  if (!tb.segs.length || tb.durationMs < 1) return []
  const active = sourceWordsForClipEditing(words, edits)
  const paras = paragraphStarts(active, (w) => wordDisplayText(w, edits.wordFixes))
  const video = videoLaneSegments(tb, edits.videoSplits)
  const breaks = new Set<number>([0, tb.durationMs])
  for (const seg of video) {
    breaks.add(Math.round(seg.startMs))
    breaks.add(Math.round(seg.startMs + seg.b - seg.a))
    let previous: SourceWord | undefined
    for (const word of active) {
      const ms = Math.round(word.s * 1000)
      if (ms < seg.a || ms >= seg.b) continue
      const speakerChange = previous != null && previous.spk != null && word.spk != null && previous.spk !== word.spk
      if (paras.has(word.i) || speakerChange) {
        const at = Math.round(seg.startMs + ms - seg.a)
        if (at > seg.startMs + 400 && at < seg.startMs + seg.b - seg.a - 400) breaks.add(at)
      }
      previous = word
    }
  }
  for (const m of edits.markers ?? []) if (m.ms > 0 && m.ms < tb.durationMs) breaks.add(m.ms)
  const ordered = [...breaks].sort((a, b) => a - b)
  const result: Scene[] = []
  let from = ordered[0] ?? 0
  for (let i = 1; i < ordered.length; i++) {
    const end = ordered[i]!
    if (end - from < 300 && i !== ordered.length - 1) continue
    if (end <= from) continue
    const sourceStartMs = outputToSource(tb, from)
    const sourceEndMs = outputToSourceEnd(tb, end)
    const phrase = active.filter((w) => w.s * 1000 >= sourceStartMs && w.s * 1000 < sourceEndMs)
      .slice(0, 9).map((w) => wordDisplayText(w, edits.wordFixes)).join(' ').trim()
    const label = (edits.markers?.find((m) => m.id.startsWith('story_') && Math.abs(m.ms - from) < 35 && m.label) ??
      edits.markers?.find((m) => Math.abs(m.ms - from) < 35 && m.label))?.label
    result.push({
      id: 'out:' + from,
      startMs: from, endMs: end, sourceStartMs, sourceEndMs,
      label: label || phrase || 'Scene ' + (result.length + 1),
    })
    from = end
  }
  return result
}

function hasRepeatedSource(tb: Timebase) {
  return tb.segs.some(([a, b], i) => tb.segs.some(([c, d], j) => i !== j && a < d && c < b))
}

export function StoryBlocksEditorShell(props: Props) {
  const { clipId, projectId, bounds } = props
  const baseWords = useMemo(() => loadSourceWords(props.words), [props.words])
  const [media, setMedia] = useState(props.primaryMedia)
  const [brollMedia, setBrollMedia] = useState<BrollMediaRow[]>(props.brollMedia)
  const [tab, setTab] = useState<Rail>('story')
  const [search, setSearch] = useState('')
  const [selectedStart, setSelectedStart] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [playheadOut, setPlayheadOut] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [addSceneOpen, setAddSceneOpen] = useState(false)
  const [layersOpen, setLayersOpen] = useState(false)
  const [customStyles, setCustomStyles] = useState<CustomCaptionStyle[]>([])
  const [customStylesState, setCustomStylesState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [labelDraft, setLabelDraft] = useState('')
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const tried = useRef(new Set<string>())
  const retryMutationRef = useRef<(() => void) | null>(null)
  const fallbacks = useMemo(() => editorMediaLoadFallbacks(props.primaryMedia, props.mediaUrls, {
    sourceSegStartMs: props.sourceSegStartMs, sourceSegEndMs: props.sourceSegEndMs,
    clipStartMs: props.clipStartMs, clipEndMs: props.clipEndMs,
  }), [props.primaryMedia, props.mediaUrls, props.sourceSegStartMs, props.sourceSegEndMs, props.clipStartMs, props.clipEndMs])
  const videoUrl = media?.url ?? props.mediaUrls.proxy ?? props.mediaUrls.segment ?? props.mediaUrls.source ?? props.mediaUrls.preview
  const offset = media?.offsetMs ?? 0
  const { edits, setEdits, undo, redo, canUndo, canRedo, saveState, flushSave, setLayoutMode, setShotOverride,
    setCaptions, layers, setLayers, syncWordsForCuts } =
    useEditorState(clipId, bounds, props.initialEdits, {
      serverUpdatedAt: props.serverUpdatedAt, editsSaveVersion: props.editsSaveVersion, words: baseWords,
      editorSaveSeq: typeof (props.aiMeta as { __editorSaveSeq?: number } | null)?.__editorSaveSeq === 'number'
        ? (props.aiMeta as { __editorSaveSeq: number }).__editorSaveSeq : 0,
    })
  const { words, wordsLoading, reloadWords } = useEditorWords(clipId, baseWords, bounds, edits.trim)
  useEffect(() => { syncWordsForCuts(words) }, [words, syncWordsForCuts])
  useEffect(() => {
    console.log('[editor:story-mode] route-hydrate', { projectId, clipId, saveVersion: props.editsSaveVersion })
  }, [projectId, clipId, props.editsSaveVersion])
  useEffect(() => {
    console.log('[editor:story-mode] save-state', { projectId, clipId, state: saveState })
  }, [projectId, clipId, saveState])
  useEffect(() => {
    if (tab !== 'styles' || customStylesState === 'loading' || customStylesState === 'ready') return
    setCustomStylesState('loading')
    console.log('[editor:story-mode] styles-load', { projectId, clipId })
    void clipsFetch<{ items: CustomCaptionStyle[] }>('/api/clips/caption-presets')
      .then((data) => { setCustomStyles(data.items ?? []); setCustomStylesState('ready'); console.log('[editor:story-mode] styles-loaded', { projectId, clipId, count: data.items?.length ?? 0 }) })
      .catch(() => { setCustomStyles([]); setCustomStylesState('error'); console.error('[editor:story-mode] styles-load-failed', { projectId, clipId }) })
  }, [tab, customStylesState, projectId, clipId])

  const previewEdits = useMemo(() => editorPreviewEdits(edits, words), [edits, words])
  const tb = useMemo(() => timebaseFor(previewEdits), [previewEdits])
  const scenes = useMemo(() => storyScenes(tb, words, edits), [tb, words, edits])
  const selected = scenes.find((s) => s.startMs === selectedStart) ??
    scenes.find((s) => playheadOut >= s.startMs && playheadOut < s.endMs) ?? scenes[0] ?? null
  const selectedIndex = selected ? scenes.findIndex((s) => s.id === selected.id) : -1
  useEffect(() => { setLabelDraft(selected?.label ?? '') }, [selected?.id, selected?.label])
  useEffect(() => {
    console.log('[editor:story-mode] scenes-built', { projectId, clipId, count: scenes.length, outputMs: tb.durationMs })
  }, [projectId, clipId, scenes.length, tb.durationMs])
  const framesAt = useMemo(() => scenes.map((s) => Math.max(0, outputToSource(tb, s.startMs + Math.min(150, (s.endMs - s.startMs) / 2)) - offset)), [scenes, tb, offset])
  const framesKey = framesAt.join(',')
  const extractor = useFilmstripFrames(videoUrl)
  useEffect(() => {
    if (extractor && framesAt.length) extractor.want(framesAt, 1000)
  }, [extractor, framesKey, framesAt])
  const frameCount = extractor ? framesAt.filter((f) => !!extractor.get(f, 1000)).length : 0
  useEffect(() => {
    console.log('[editor:story-mode] frames-state', { projectId, clipId, available: frameCount, total: framesAt.length, failed: extractor?.failed ?? false })
  }, [projectId, clipId, frameCount, framesAt.length, extractor?.failed])

  const simpleEdlReason = edits.inserts?.length ? 'Scene mutations with inserted clips require the full editor.'
    : edits.segmentSpeeds?.length || edits.speed ? 'Scene mutations with speed changes require the full editor.'
      : hasRepeatedSource(tb) ? 'Repeated source sections cannot be safely mutated by scene.'
        : edits.timelineLanes?.video?.locked ? 'The video track is locked.' : null
  const videoSegments = videoLaneSegments(tb, edits.videoSplits)
  const exactVideoScene = (s: Scene) => videoSegments.some((v) =>
    v.startMs === s.startMs && v.a === s.sourceStartMs && v.b === s.sourceEndMs)
  const canReorder = (s: Scene) => !simpleEdlReason && exactVideoScene(s) && videoSegments.length <= 64
  const filtered = scenes.filter((s, i) => !search.trim() || s.label.toLowerCase().includes(search.toLowerCase()) || String(i + 1) === search.trim())
  const styleOptions = useMemo(() => captionStyleOptions(t6CaptionPresetsEnabled()), [])
  const seekOutput = useCallback((outputMs: number) => {
    const next = Math.max(0, Math.min(tb.durationMs, outputMs))
    setPlayheadOut(next)
    if (videoRef.current) seekToOutputMs(videoRef.current, previewEdits, next, offset)
  }, [tb.durationMs, previewEdits, offset])
  const seekSource = useCallback((sourceMs: number) => {
    const out = sourceToOutput(tb, sourceMs)
    if (out != null) setPlayheadOut(out)
    if (videoRef.current) videoRef.current.currentTime = videoTimeFromSourceMs(sourceMs, offset)
  }, [tb, offset])

  const selectScene = useCallback((s: Scene) => {
    setSelectedStart(s.startMs)
    seekOutput(s.startMs)
    console.log('[editor:story-mode] scene-selected', { projectId, clipId, startMs: s.startMs, endMs: s.endMs })
  }, [projectId, clipId, seekOutput])
  const onMediaError = useCallback(() => {
    if (media?.url) tried.current.add(media.url)
    const next = fallbacks.find((f) => !tried.current.has(f.url))
    if (next) {
      tried.current.add(next.url)
      setMedia(next)
      console.log('[editor:story-mode] media-fallback', { projectId, clipId, found: true })
    } else {
      console.error('[editor:story-mode] media-fallback', { projectId, clipId, found: false })
    }
  }, [media?.url, fallbacks, projectId, clipId])
  const reportError = (action: string, e: unknown, retry?: () => void) => {
    const reason = e instanceof Error ? e.message : 'This scene edit was not applied'
    retryMutationRef.current = retry ?? null
    setMutationError(reason)
    toast.error(reason)
    console.error('[editor:story-mode] mutation-failed', { projectId, clipId, action, reason })
  }
  const commit = (action: string, next: ClipEditsV2 | null) => {
    if (!next) return reportError(action, new Error('The current edit cannot represent that scene operation safely.'))
    retryMutationRef.current = null
    setMutationError(null)
    setEdits(next)
    console.log('[editor:story-mode] mutation', { projectId, clipId, action, sceneStartMs: selected?.startMs ?? null })
  }
  const insertBoundary = (scene: Scene, atOutputMs: number, mode?: ClipEditsV2['layout']['mode'], facecam?: ClipEditsV2['layout']['facecam']) => {
    if (scene.endMs - scene.startMs < 1200 || atOutputMs <= scene.startMs + 400 || atOutputMs >= scene.endMs - 400 || (edits.markers?.length ?? 0) >= MAX_MARKERS)
      return reportError('insert-boundary', new Error('This block cannot fit another safe scene boundary.'))
    const marker = { id: 'story_' + crypto.randomUUID().replaceAll('-', '').slice(0, 28), ms: Math.round(atOutputMs), color: 'blue' as const }
    let next: ClipEditsV2 = { ...edits, markers: normalizeMarkers([...(edits.markers ?? []), marker]) }
    if (mode) {
      const sourceAt = outputToSource(tb, atOutputMs)
      next = splitLayoutSegmentAt(next, sourceAt)
      next = setLayoutModeForSegmentAt(next, Math.min(scene.sourceEndMs - 1, sourceAt + 1), mode)
      if (facecam) next = { ...next, layout: { ...next.layout, facecam } }
    }
    commit(mode ? 'add-scene-layout-boundary' : 'split-boundary', next)
    setSelectedStart(Math.round(atOutputMs))
    setAddSceneOpen(false)
    console.log('[editor:story-mode] scene-boundary-added', { projectId, clipId, atOutputMs: Math.round(atOutputMs), hasLayout: Boolean(mode) })
  }
  const splitScene = () => {
    if (!selected || selected.endMs - selected.startMs < 1200 || (edits.markers?.length ?? 0) >= MAX_MARKERS)
      return reportError('split', new Error('This block cannot be split into two valid scene boundaries.'))
    const at = Math.round((selected.startMs + selected.endMs) / 2)
    insertBoundary(selected, at)
  }
  const mergeScene = () => {
    if (!selected || selectedIndex < 1) return
    const marker = edits.markers?.find((m) => m.id.startsWith('story_') && Math.abs(m.ms - selected.startMs) < 35)
    if (!marker) return reportError('merge', new Error('This boundary comes from the source transcript or video cuts. It cannot be merged here.'))
    const next = { ...edits, markers: normalizeMarkers(edits.markers?.filter((m) => m.id !== marker.id)) }
    if (storyScenes(timebaseFor(editorPreviewEdits(next, words)), words, next).length >= scenes.length)
      return reportError('merge', new Error('This boundary is also part of the source edit. Merge it in the clip editor.'))
    commit('merge-boundary', next)
  }
  const deleteSceneTarget = (scene: Scene | null) => {
    if (!scene || simpleEdlReason) return reportError('delete', new Error(simpleEdlReason || 'No scene is selected'))
    const next = deleteRange({ edits, previewEdits }, [scene.startMs, scene.endMs])
    commit('delete-output-range', next)
    if (next) setSelectedStart(null)
  }
  const deleteScene = () => deleteSceneTarget(selected)
  const reorderScene = (from: number, before: number | null) => {
    const moving = scenes[from]
    const target = before == null ? null : scenes[before]
    if (!moving || from === before || !canReorder(moving) || (target != null && !canReorder(target)))
      return reportError('reorder', new Error(simpleEdlReason || 'Reorder needs scene boundaries that match a video segment. Open the clip editor to split the footage first.'))
    const next = moveVideoSegment(
      { edits, previewEdits },
      'seg:' + moving.sourceStartMs,
      target ? 'seg:' + target.sourceStartMs : null,
    )
    if (!next || timebaseFor(editorPreviewEdits(next, words)).durationMs !== tb.durationMs)
      return reportError('reorder', new Error('The section-order normalizer could not preserve this scene move.'))
    commit('reorder-sectionOrder', next)
    setSelectedStart(null)
    console.log('[editor:story-mode] reorder', { projectId, clipId, from, before })
  }
  const rerunReframe = () => {
    console.log('[editor:story-mode] reframe-start', { projectId, clipId })
    void requestClipReframe(clipId)
      .then(() => { console.log('[editor:story-mode] reframe-requested', { projectId, clipId }); toast.success('Reframe requested') })
      .catch((error) => reportError('reframe', error, rerunReframe))
  }
  const saveLabel = () => {
    if (!selected || !labelDraft.trim() || labelDraft.trim() === selected.label) return
    const at = selected.startMs
    const current = edits.markers?.find((m) => m.id.startsWith('story_') && Math.abs(m.ms - at) < 35)
    if (!current && (edits.markers?.length ?? 0) >= MAX_MARKERS)
      return reportError('scene-label', new Error('The clip has reached its marker limit.'))
    const id = current?.id ?? 'story_' + crypto.randomUUID().replaceAll('-', '').slice(0, 28)
    const markers = normalizeMarkers([...(edits.markers ?? []).filter((m) => m.id !== id),
      { id, color: current?.color ?? 'blue', ms: at, label: labelDraft.trim().slice(0, 80), chapter: current?.chapter }])
    commit('scene-label-only', { ...edits, markers })
    console.log('[editor:story-mode] scope', { projectId, clipId, kind: 'metadata-only', sceneStartMs: at })
  }
  const openOther = async (target: EditorModeSwitcherMode | 'transcript' | 'captions') => {
    console.log('[editor:story-mode] handoff-start', { projectId, clipId, target })
    try { await flushSave() } catch {
      reportError('handoff', new Error('Save edits before changing editors'))
      return
    }
    const fromQuery = props.clipperStudio ? { from: 'studio' } : undefined
    const editorQuery = target === 'transcript' || target === 'captions' ? { tab: target } : undefined
    const editorUrl = props.clipperStudio ? routes.studio(projectId, clipId, editorQuery) : routes.edit(projectId, clipId, editorQuery)
    const url = target === 'producer' ? routes.chat(projectId, clipId, fromQuery)
      : target === 'templates' ? routes.templateMode(projectId, clipId, fromQuery)
        : target === 'generate' ? routes.generate(projectId, clipId, { atMs: String(Math.round(selected?.sourceStartMs ?? edits.trim.in)), ...(props.clipperStudio ? { from: 'studio' } : {}) })
          : editorUrl
    console.log('[editor:story-mode] handoff-complete', { projectId, clipId, target })
    window.location.assign(url)
  }
  const stockAttachReason = !selected ? 'Select a scene first.'
    : selected.endMs - selected.startMs < 1000 || selected.endMs - selected.startMs > 8000
      ? 'Stock visual replacement supports scenes from 1 to 8 seconds; split longer scenes first.'
      : (edits.broll ?? []).some((b) => b.endMs > selected.startMs && b.startMs < selected.endMs)
        ? 'Existing visual overlays overlap this scene; edit them in the clip editor first.'
        : null
  const attachStock = async (providerId: string) => {
    if (!selected || stockAttachReason) throw new Error(stockAttachReason ?? 'Select a scene first.')
    const startMs = Math.round(selected.startMs)
    const endMs = Math.round(selected.endMs)
    console.log('[editor:story-mode] visual-attach-start', { projectId, clipId, startMs, endMs })
    try {
      const data = await clipsFetch<{ assetId: string; url?: string; thumbUrl?: string; previewUrl?: string }>(
        '/api/clips/clips/' + clipId + '/broll', {
          method: 'POST', body: JSON.stringify({ providerId, startMs, endMs }),
        })
      const id = crypto.randomUUID()
      setBrollMedia((rows) => [...rows, { id, source: 'stock', assetId: data.assetId, startMs, endMs, url: data.url || data.previewUrl || null, thumbUrl: data.thumbUrl }])
      commit('attach-visual-only', { ...edits, broll: [...(edits.broll ?? []), { id, source: 'stock', assetId: data.assetId, startMs, endMs, placement: 'manual' }] })
      console.log('[editor:story-mode] visual-attach-complete', { projectId, clipId, startMs, endMs, assetId: data.assetId })
      toast.success('Visual added; original narration preserved')
    } catch (e) { reportError('visual-attach', e, () => { void attachStock(providerId).catch(() => undefined) }); throw e }
  }
  const frame = (s: Scene, compact = false) => {
    const idx = scenes.findIndex((x) => x.id === s.id)
    const ms = framesAt[idx] ?? 0
    const img = extractor?.get(ms, 1000)
    return <div className={'relative overflow-hidden rounded-md bg-muted ' + (compact ? 'aspect-video w-24 shrink-0' : 'aspect-video w-32 shrink-0')}>
      {img ? <img src={img} alt={'Frame from scene ' + (idx + 1)} className="size-full object-cover" /> :
        extractor?.failed && videoUrl ? <video src={videoUrl + '#t=' + (ms / 1000).toFixed(2)} muted playsInline preload="metadata" className="size-full object-cover" aria-label="Source frame fallback" /> :
          props.posterUrl ? <img src={props.posterUrl} alt="Source poster while frame loads" className="size-full object-cover opacity-65" /> :
            <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
              {videoUrl ? <><Loader2 className="mr-1 size-3 animate-spin" />Loading frame</> : 'Media unavailable'}
            </div>}
    </div>
  }
  const rail: { id: Rail; label: string; icon: typeof FileText }[] = [
    { id: 'story', label: 'Story', icon: FileText },
    { id: 'visuals', label: 'Visuals', icon: ImageIcon },
    { id: 'audio', label: 'Audio / Voice', icon: AudioLines },
    { id: 'layouts', label: 'Layouts', icon: LayoutGrid },
    { id: 'text', label: 'Text / Captions', icon: Clapperboard },
    { id: 'styles', label: 'Styles', icon: Palette },
    { id: 'brand', label: 'Brand', icon: Sparkles },
  ]

  return <ClipperSurfaceErrorBoundary surface="Story blocks editor">
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground" data-testid="story-blocks-editor">
      <StandaloneEditorChrome
        projectTitle={props.projectTitle}
        title={props.initialTitle}
        current="story"
        saveState={saveState}
        canUndo={canUndo}
        canRedo={canRedo}
        contextSlot={<>
          <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium">Story blocks</span>
          <button type="button" className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted" onClick={() => { setTab('layouts'); console.log('[editor:story-mode] header-aspect-open', { projectId, clipId, aspect: edits.aspectRatio ?? '9:16' }) }}>{aspectName(edits.aspectRatio)}</button>
        </>}
        onBack={() => {
          console.log('[editor:story-mode] project-handoff-start', { projectId, clipId })
          void flushSave()
            .then(() => window.location.assign(routes.project(projectId)))
            .catch((e) => reportError('project-handoff', e))
        }}
        onUndo={() => { undo(); setSelectedStart(null); console.log('[editor:story-mode] undo', { projectId, clipId }) }}
        onRedo={() => { redo(); setSelectedStart(null); console.log('[editor:story-mode] redo', { projectId, clipId }) }}
        onExport={() => { setExportOpen(true); console.log('[editor:story-mode] export-open', { projectId, clipId }) }}
        onRetrySave={() => { void flushSave().catch((e) => reportError('save-retry', e)) }}
        onModeSelect={(mode) => {
          console.log('[editor:story-mode] mode-selected', { projectId, clipId, mode })
          if (mode === 'story') return
          void openOther(mode)
        }}
        onLayoutSelect={(view) => {
          console.log('[editor:story-mode] layout-handoff-start', { projectId, clipId, view })
          void finishStandaloneLayoutHandoff({
            view,
            projectId,
            clipId,
            clipperStudio: props.clipperStudio,
            flushSave,
          }).catch((e) => reportError('layout-handoff', e))
        }}
      />
      <div className="flex min-h-0 flex-1 gap-1 p-1">
        <nav className="order-last flex h-full w-14 shrink-0 flex-col items-center gap-1 overflow-y-auto rounded-lg border border-border/70 bg-muted/20 px-1 py-2" aria-label="Story tools" data-testid="story-tool-rail">
          {rail.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => {
            setTab(id); console.log('[editor:story-mode] tool-selected', { projectId, clipId, tool: id })
          }} aria-current={tab === id ? 'page' : undefined} className={'flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-[9px] leading-none transition-colors ' + (tab === id ? 'bg-accent font-semibold text-foreground ring-1 ring-border' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
            <Icon className="size-5" />{label}
          </button>)}
        </nav>
        <aside className="relative flex w-[390px] shrink-0 flex-col overflow-hidden rounded-lg border border-border/70 bg-card xl:w-[430px]" aria-label="Scene cards and tools">
          {tab === 'story' ? <>
            <div className="border-b border-border p-3">
              <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Story</h2><span className="text-xs text-muted-foreground">{scenes.length} scenes</span></div>
              <Button className="mt-3 w-full" variant="outline" size="sm" onClick={() => void openOther('transcript')}><FileText className="mr-1 size-3" />Edit full script</Button>
              <div className="mt-3 flex gap-2">
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-input px-2"><Search className="size-4 text-muted-foreground" /><input className="h-9 min-w-0 flex-1 bg-transparent text-xs outline-none" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a scene" aria-label="Find scenes" /></label>
                <Button variant="outline" size="sm" disabled={!selected || selected.endMs - selected.startMs < 1200 || (edits.markers?.length ?? 0) >= MAX_MARKERS || Boolean(edits.inserts?.length) || hasRepeatedSource(tb)} title={!selected ? 'Select a scene first.' : edits.inserts?.length ? 'Add scene is disabled while inserted clips are present.' : hasRepeatedSource(tb) ? 'Repeated source sections cannot receive an unambiguous layout boundary.' : undefined} onClick={() => { setAddSceneOpen(true); console.log('[editor:story-mode] add-scene-open', { projectId, clipId, selected: selectedIndex }) }}><Plus className="mr-1 size-3" />Add scene</Button>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">Add scene splits the selected existing footage and can assign a layout to the new block. New source footage still belongs in Clip editor.</p>
            </div>
            {addSceneOpen && selected ? <div className="absolute left-3 right-3 top-36 z-30 max-h-[70%] overflow-y-auto rounded-xl border border-border bg-background p-3 shadow-xl" data-testid="story-add-scene-popup">
              <div className="mb-2 flex items-center justify-between"><div><p className="text-xs font-semibold">Add scene after split</p><p className="text-[10px] text-muted-foreground">Choose an existing layout tile. One edit inserts the boundary and layout segment.</p></div><Button size="sm" variant="ghost" onClick={() => setAddSceneOpen(false)}>Cancel</Button></div>
              <LayoutQuickPicker value={edits.layout.mode} edits={edits} facecamLayout={props.facecamLayout} reframeV2Enabled={props.reframeV2Enabled} onPick={(mode, facecam) => insertBoundary(selected, Math.round((selected.startMs + selected.endMs) / 2), mode, facecam)} onAspectChange={(aspect) => commit('aspect-global', { ...edits, aspectRatio: aspect })} />
              <Button className="mt-3 w-full" variant="outline" size="sm" onClick={() => insertBoundary(selected, Math.round((selected.startMs + selected.endMs) / 2), edits.layout.mode, edits.layout.facecam)}>Use current layout</Button>
            </div> : null}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {wordsLoading && !scenes.length ? <div className="space-y-3 py-12 text-center text-xs text-muted-foreground"><Loader2 className="mx-auto size-6 animate-spin" />Preparing scene transcript <Button size="sm" variant="outline" onClick={() => void reloadWords().catch((e) => reportError('reload-words', e))}>Retry transcript</Button></div> :
                !scenes.length ? <div className="py-12 text-center text-xs text-muted-foreground">No scenes in this edit. Restore video in the clip editor or retry the transcript.</div> :
                  filtered.length ? filtered.map((scene) => {
                    const index = scenes.findIndex((s) => s.id === scene.id)
                    return <div key={scene.id} onDragOver={(e) => {
                      if (dragIndex === null) return
                      e.preventDefault()
                      setDropIndex(index)
                    }} onDrop={(e) => {
                      e.preventDefault()
                      if (dragIndex !== null) reorderScene(dragIndex, index)
                      setDragIndex(null); setDropIndex(null)
                    }} className="relative">
                      {dropIndex === index && dragIndex !== null && <div className="absolute -top-1 z-10 h-0.5 w-full bg-primary" aria-label="Scene drop guide" />}
                      <div className={'flex w-full items-start gap-2 rounded-lg border p-2 transition-colors ' + (selected?.id === scene.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-card')}>
                        <button type="button" draggable={Boolean(canReorder(scene)) && !search} onDragStart={(e) => {
                          if (!canReorder(scene)) { e.preventDefault(); return }
                          setDragIndex(index); e.dataTransfer.effectAllowed = 'move'
                        }} onDragEnd={() => { setDragIndex(null); setDropIndex(null) }} title={canReorder(scene) ? 'Drag to reorder scene' : simpleEdlReason || 'Scene must match one video segment to reorder'} aria-label={'Reorder scene ' + (index + 1)} className="cursor-grab p-1 text-muted-foreground disabled:cursor-not-allowed" disabled={!canReorder(scene) || Boolean(search)}><GripVertical className="size-4" /></button>
                        <button type="button" className="flex min-w-0 flex-1 gap-2 text-left" onClick={() => selectScene(scene)}>
                          {frame(scene)}
                          <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold">Scene {index + 1}</span><span className="mt-1 line-clamp-3 block text-xs leading-snug">{scene.label}</span><span className="mt-2 block text-[10px] tabular-nums text-muted-foreground">{clock(displayPositionMs(previewEdits, scene.endMs) - displayPositionMs(previewEdits, scene.startMs))}</span></span>
                        </button>
                        {selected?.id === scene.id ? <div className="flex shrink-0 flex-col gap-1">
                          <Button type="button" size="icon" variant="ghost" className="size-7" aria-label={'Move scene ' + (index + 1) + ' up'} title="Move scene up" disabled={Boolean(search) || index <= 0 || !canReorder(scene)} onClick={() => reorderScene(index, index - 1)}><ChevronUp className="size-3.5" /></Button>
                          <Button type="button" size="icon" variant="ghost" className="size-7" aria-label={'Move scene ' + (index + 1) + ' down'} title="Move scene down" disabled={Boolean(search) || index >= scenes.length - 1 || !canReorder(scene)} onClick={() => reorderScene(index, index + 2 < scenes.length ? index + 2 : null)}><ChevronDown className="size-3.5" /></Button>
                          <Button type="button" size="icon" variant="ghost" className="size-7" aria-label={'Edit scene ' + (index + 1)} title="Edit selected scene" onClick={() => { selectScene(scene); setTab('story') }}><Pencil className="size-3.5" /></Button>
                          <Button type="button" size="icon" variant="ghost" className="size-7 text-destructive" aria-label={'Delete scene ' + (index + 1)} title={simpleEdlReason ?? 'Delete selected footage'} disabled={Boolean(simpleEdlReason) || scenes.length < 2} onClick={() => deleteSceneTarget(scene)}><Trash2 className="size-3.5" /></Button>
                        </div> : null}
                      </div>
                    </div>
                  }) : <p className="py-8 text-center text-xs text-muted-foreground">No scenes match this search.</p>}
            </div>
            <div className="border-t border-border p-3 text-[11px] text-muted-foreground">Scenes follow the existing source edit. Label changes do not change recorded words or narration.</div>
          </> : <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <Button variant="ghost" size="sm" onClick={() => setTab('story')}><ArrowLeft className="mr-1 size-3" />Back to story</Button>
            <h2 className="text-sm font-semibold">{rail.find((r) => r.id === tab)?.label}</h2>
            {tab === 'visuals' ? <>
              <p className="text-xs text-muted-foreground">Stock B-roll covers only the selected scene; recorded A-roll narration and timing stay intact.</p>
              <Button variant="outline" disabled={Boolean(stockAttachReason)} title={stockAttachReason ?? undefined} onClick={() => setPickerOpen(true)}>Replace selected visual</Button>
              {stockAttachReason && <p className="text-xs text-muted-foreground">{stockAttachReason}</p>}
            </> : tab === 'audio' ? <>
              <p className="text-xs text-muted-foreground">This recording keeps its current audio. Voice generation is not scene-scoped in the existing edit contract, so Story mode does not silently regenerate narration.</p>
              <Button size="sm" variant="outline" onClick={() => void openOther('clip')}>Open existing audio / voice tools</Button>
            </> : tab === 'layouts' ? <>
              <p className="text-xs text-muted-foreground">Quick layouts and the existing layout inspector write to the same clip edit document.</p>
              <LayoutQuickPicker value={edits.layout.mode} edits={edits} facecamLayout={props.facecamLayout} reframeV2Enabled={props.reframeV2Enabled} onPick={(mode, facecam) => { setLayoutMode(mode, facecam); console.log('[editor:story-mode] layout', { projectId, clipId, mode }) }} onAspectChange={(aspect) => commit('aspect-global', { ...edits, aspectRatio: aspect })} />
              <div className="border-t border-border pt-3">
                <LayoutPanel edits={edits} shots={props.cropShots} onMode={(mode, facecam) => { setLayoutMode(mode, facecam); console.log('[editor:story-mode] layout-panel-mode', { projectId, clipId, mode }) }} onShotFocus={setShotOverride} onSeekShot={seekSource} onRerunReframe={rerunReframe} onEdits={setEdits} reframeV2Enabled={props.reframeV2Enabled} clipId={clipId} words={words} clipStartMs={bounds.clipStartMs} clipEndMs={bounds.clipEndMs} facecamLayout={props.facecamLayout} onOpenLayersTab={() => setLayersOpen(true)} videoUrl={videoUrl} posterUrl={props.posterUrl} projectId={projectId} mediaOffsetMs={offset} aiMeta={props.aiMeta as Record<string, unknown> | null} />
              </div>
            </> : tab === 'text' ? <>
              <p className="text-xs text-muted-foreground">Scene labels are metadata. Transcript correction changes caption text only, not the recorded voice.</p>
              <Button size="sm" variant="outline" onClick={() => void openOther('captions')}>Edit full transcript / script</Button>
              <CaptionsPanel clipId={clipId} edits={edits} words={words} onChange={(captions) => { setCaptions(captions); console.log('[editor:story-mode] captions-change', { projectId, clipId }) }} onEdits={setEdits} outputMs={playheadOut} onSeekOutput={seekOutput} compactProperties />
            </> : tab === 'styles' ? <>
              <p className="text-xs text-muted-foreground">Typography uses the same caption catalog and saved custom presets as the full editor.</p>
              <div className="flex gap-1 rounded-md border border-border p-1">
                <Button size="sm" variant="ghost" disabled title="The current caption schema is clip-wide; per-scene typography would require a new renderer contract.">This scene</Button>
                <Button size="sm" variant="secondary">All scenes</Button>
              </div>
              <section className="space-y-2"><h3 className="text-xs font-semibold">Styles library</h3><div className="grid grid-cols-2 gap-2">
                {styleOptions.map((style) => <button key={style.id} type="button" className={'rounded-lg border p-2 text-left text-xs hover:bg-muted ' + (edits.captions.presetId === style.id && !edits.captions.customPresetId ? 'border-primary ring-1 ring-primary/20' : 'border-border')} onClick={() => { commit('caption-style-library', captionPresetPatch(edits, style.id)); console.log('[editor:story-mode] style-applied', { projectId, clipId, source: 'library', styleId: style.id }) }}><span className="block font-semibold">{style.name}</span><span className="text-[10px] text-muted-foreground">{style.kind === 'cp' ? 'Caption preset v2' : 'Classic'}</span></button>)}
              </div></section>
              <section className="space-y-2"><h3 className="text-xs font-semibold">My styles</h3>
                {customStylesState === 'loading' || customStylesState === 'idle' ? <p className="text-xs text-muted-foreground">Loading saved styles…</p> : customStylesState === 'error' ? <div className="flex items-center gap-2"><p className="text-xs text-destructive">Could not load saved styles.</p><Button size="sm" variant="outline" onClick={() => setCustomStylesState('idle')}>Retry</Button></div> : customStyles.length ? <div className="grid grid-cols-2 gap-2">{customStyles.map((style) => <button key={style.id} type="button" className={'rounded-lg border p-2 text-left text-xs hover:bg-muted ' + (edits.captions.customPresetId === style.id ? 'border-primary ring-1 ring-primary/20' : 'border-border')} onClick={() => { setCaptions({ ...applyCaptionStyleSnapshot(edits.captions, style.config), customPresetId: style.id }); console.log('[editor:story-mode] style-applied', { projectId, clipId, source: 'custom', styleId: style.id }) }}><span className="block truncate font-semibold">{style.name}</span><span className="text-[10px] text-muted-foreground">Saved caption style</span></button>)}</div> : <p className="text-xs text-muted-foreground">No saved styles yet. Save one from Text / Captions.</p>}
              </section>
            </> : <>
              <p className="text-xs text-muted-foreground">Brand settings reuse the existing Brand panel and remain shared with preview and export.</p>
              <BrandPanel edits={edits} onEdits={(next) => { commit('brand', next); console.log('[editor:story-mode] brand-change', { projectId, clipId }) }} />
            </>}
          </div>}
        </aside>
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/70 bg-background" aria-label="Selected scene and preview">
          <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2">
            <div><h2 className="text-sm font-semibold">{selected ? 'Scene ' + (selectedIndex + 1) : 'No scene selected'}</h2>
              <p className="text-[11px] text-muted-foreground">{selected ? clock(displayPositionMs(previewEdits, selected.endMs) - displayPositionMs(previewEdits, selected.startMs)) + ' · ' + (edits.aspectRatio ?? '9:16') : 'Select a scene card'}</p>
            </div>
            {selected && <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="icon" className="size-8" aria-label="Previous scene" disabled={selectedIndex <= 0} onClick={() => selectedIndex > 0 && selectScene(scenes[selectedIndex - 1]!)}><ChevronLeft className="size-4" /></Button>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Next scene" disabled={selectedIndex < 0 || selectedIndex >= scenes.length - 1} onClick={() => selectedIndex >= 0 && selectedIndex < scenes.length - 1 && selectScene(scenes[selectedIndex + 1]!)}><ChevronRight className="size-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => selectScene(selected)}>Preview scene</Button>
              <Button variant="outline" size="sm" disabled={Boolean(stockAttachReason)} title={stockAttachReason ?? undefined} onClick={() => setPickerOpen(true)}>Replace visual</Button>
              <Button variant="outline" size="sm" onClick={() => setTab('layouts')}>Layout</Button>
            </div>}
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted/10 p-4" data-testid="story-preview-host">
            {videoUrl ? <PreviewStage clipId={clipId} videoUrl={videoUrl} posterUrl={props.posterUrl} edits={previewEdits} words={words} cropTrack={props.cropTrack} brollMedia={brollMedia} media={media} videoRef={videoRef} onEditorMediaError={onMediaError} onTick={(tick) => {
              setPlayheadOut(tick.outputMs); setPlaying(tick.playing)
              if (tick.playing) {
                const scene = scenes.find((s) => tick.outputMs >= s.startMs && tick.outputMs < s.endMs)
                if (scene) setSelectedStart(scene.startMs)
              }
            }} /> :
              <div className="space-y-3 text-center text-xs text-muted-foreground"><p>Media unavailable. The source edit is preserved.</p><Button size="sm" variant="outline" onClick={() => { tried.current.clear(); setMedia(props.primaryMedia); console.log('[editor:story-mode] media-retry', { projectId, clipId }) }}>Retry media</Button></div>}
          </div>
          <div className="border-t border-border bg-background">
            <div className="flex min-w-0 items-center gap-2 px-3 py-2">
              <span className="max-w-[32%] truncate text-xs font-semibold">{selected ? 'Scene ' + (selectedIndex + 1) + ' · ' + selected.label : 'Scene —'}</span>
              <Button type="button" size="sm" variant={layersOpen ? 'secondary' : 'outline'} aria-expanded={layersOpen} onClick={() => { setLayersOpen((v) => !v); console.log('[editor:story-mode] layers-toggle', { projectId, clipId, open: !layersOpen }) }}><Layers3 className="mr-1 size-3.5" />Layers</Button>
              <div className="min-w-0 flex-1">
                <PlayerControls
                  playing={playing}
                  outputMs={displayPositionMs(previewEdits, playheadOut)}
                  outputDurationMs={displayDurationMs(previewEdits)}
                  onToggle={() => {
                    const video = videoRef.current
                    if (!video) return
                    if (video.paused) void video.play().catch((e) => reportError('play', e))
                    else video.pause()
                  }}
                  onScrub={(displayMs) => seekOutput(editMsAtDisplayMs(previewEdits, displayMs))}
                />
              </div>
            </div>
            {layersOpen ? <div className="max-h-72 overflow-y-auto border-t border-border p-3" data-testid="story-layers-panel">
              <LayersPanel clipId={clipId} edits={edits} layers={layers} setLayers={(next) => { setLayers(next); console.log('[editor:story-mode] layers-change', { projectId, clipId, count: next.length }) }} onEdits={setEdits} />
            </div> : null}
          </div>
          {selected && <section className="space-y-3 border-t border-border bg-card/40 p-3" aria-label="Selected scene tools">
            <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-semibold">Scene {selectedIndex + 1} · script / beat</h3><span className="text-[10px] text-muted-foreground">Label only — not voice</span></div>
            <div className="flex gap-2">
              <input className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-xs" value={labelDraft} onChange={(e) => setLabelDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveLabel() } }} maxLength={80} aria-label="Scene label" />
              <Button variant="outline" size="sm" disabled={!labelDraft.trim() || labelDraft.trim() === selected.label} onClick={saveLabel}>Save label</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled title="Story mode does not create new source footage; use Add scene to split this footage or Clip editor to insert media.">Insert before</Button>
              <Button variant="outline" size="sm" disabled title="Story mode does not create new source footage; use Add scene to split this footage or Clip editor to insert media.">Insert after</Button>
              <Button variant="outline" size="sm" onClick={splitScene} disabled={selected.endMs - selected.startMs < 1200 || (edits.markers?.length ?? 0) >= MAX_MARKERS}><Scissors className="mr-1 size-3" />Split boundary</Button>
              <Button variant="outline" size="sm" onClick={mergeScene} disabled={selectedIndex < 1 || !edits.markers?.some((m) => m.id.startsWith('story_') && Math.abs(m.ms - selected.startMs) < 35)}>Merge boundary</Button>
              <Button variant="outline" size="sm" onClick={deleteScene} disabled={Boolean(simpleEdlReason) || scenes.length < 2} title={simpleEdlReason ?? undefined}><Trash2 className="mr-1 size-3" />Delete footage</Button>
              <Button variant="outline" size="sm" onClick={() => void openOther('transcript')}>Edit words in Compact</Button>
            </div>
            {simpleEdlReason && <p className="text-[11px] text-muted-foreground">{simpleEdlReason}</p>}
            {mutationError && <div role="alert" className="flex items-center gap-2 text-xs text-destructive"><span className="flex-1">{mutationError}</span><Button size="sm" variant="outline" disabled={!retryMutationRef.current} title={retryMutationRef.current ? 'Retry the failed operation' : 'This operation is blocked by the current edit shape'} onClick={() => retryMutationRef.current?.()}>Retry</Button><Button size="sm" variant="ghost" onClick={() => { retryMutationRef.current = null; setMutationError(null) }}>Dismiss</Button></div>}
          </section>}
        </main>
      </div>
      <div className="shrink-0 border-t border-border bg-card/50 px-3 py-2" aria-label="Scene thumbnail strip">
        <div className="mb-2 flex items-center justify-between gap-3"><span className="text-xs font-semibold">Pages / scenes</span><span className="text-[10px] tabular-nums text-muted-foreground">{selectedIndex >= 0 ? 'Scene ' + (selectedIndex + 1) + ' / ' + scenes.length + ' · ' : ''}{clock(displayPositionMs(previewEdits, playheadOut))} / {clock(displayDurationMs(previewEdits))}</span></div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {scenes.map((scene, index) => <button key={scene.id} type="button" onClick={() => selectScene(scene)} className={'shrink-0 rounded-md border p-1 text-left ' + (selected?.id === scene.id ? 'border-primary ring-1 ring-primary/20' : 'border-border')} aria-current={selected?.id === scene.id ? 'true' : undefined}>
            {frame(scene, true)}<span className="block pt-1 text-[10px] text-muted-foreground">Page {index + 1} · Scene {index + 1}</span><span className="block text-[10px] tabular-nums text-muted-foreground">{clock(displayPositionMs(previewEdits, scene.endMs) - displayPositionMs(previewEdits, scene.startMs))}</span>
          </button>)}
          {!scenes.length && <span className="p-3 text-xs text-muted-foreground">No scene thumbnails yet</span>}
        </div>
      </div>
      <StockBrollPicker open={pickerOpen} onClose={() => setPickerOpen(false)} defaultQuery={selected?.label.split(' ').slice(0, 3).join(' ') ?? ''} clipEndMs={selected?.endMs ?? 0} playheadMs={selected?.startMs ?? 0} onInsert={(id) => attachStock(id)} />
      <ExportDialog clipId={clipId} title={props.initialTitle} edits={edits} words={words} open={exportOpen} onClose={() => setExportOpen(false)} onBeforeExport={async () => {
        console.log('[editor:story-mode] export-flush', { projectId, clipId })
        await flushSave()
      }} onEdits={setEdits} onAspectChange={(aspect) => commit('export-aspect', { ...edits, aspectRatio: aspect })} layoutMode={edits.layout.mode} onLayoutModeChange={setLayoutMode} facecamLayout={props.facecamLayout} reframeV2Enabled={props.reframeV2Enabled} posterUrl={props.posterUrl} aiMeta={props.aiMeta} fullVideo={props.fullVideo} />
    </div>
  </ClipperSurfaceErrorBoundary>
}
