'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, AudioLines, Clapperboard, Download, FileText, GripVertical, ImageIcon, Loader2, Palette, Pause, Play, Plus, Redo2, RefreshCw, Scissors, Search, Trash2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ClipperSurfaceErrorBoundary } from '@/components/clips/clipper-surface-error-boundary'
import type { EditorClipShell } from '@/components/clips/editor/editor-clip-shell'
import { PreviewStage } from '@/components/clips/editor/preview-stage'
import { ExportDialog } from '@/components/clips/editor/export-dialog'
import { LayoutQuickPicker } from '@/components/clips/editor/layout-quick-picker'
import { StockBrollPicker } from '@/components/clips/editor/stock-broll-picker'
import { useEditorState } from '@/components/clips/editor/use-editor-state'
import { useEditorWords } from '@/components/clips/editor/use-editor-words'
import { useFilmstripFrames } from '@/components/clips/editor/timeline/use-filmstrip-frames'
import { editorMediaLoadFallbacks } from '@/lib/server/clips/editor-clip-media'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import { displayDurationMs, displayPositionMs, wordDisplayText, type ClipEditsV2 } from '@/lib/clips/edits'
import { outputToSource, outputToSourceEnd, timebaseFor, videoLaneSegments, type Timebase } from '@/lib/clips/editor/clip-timeline'
import { deleteRange, moveVideoSegment } from '@/lib/clips/editor/timeline-edit-ops'
import { videoTimeFromSourceMs } from '@/lib/clips/editor-playback'
import { normalizeMarkers, MAX_MARKERS } from '@/lib/clips/editor/markers'
import { loadSourceWords, type SourceWord } from '@/lib/clips/source-words'
import { paragraphStarts } from '@/lib/clips/editor/transcript-edit'
import { sourceWordsForClipEditing } from '@/lib/clips/editor/clip-editor-word-scope'
import { captionPresetPatch, captionStyleOptions } from '@/lib/clips/editor/starter-templates'
import { clipsFetch } from '@/lib/clips-api'
import { routes } from '@/lib/routes'
import type { BrollMediaRow } from '@/lib/server/clips/broll-media'

type Props = Parameters<typeof EditorClipShell>[0]
type Scene = { id: string; startMs: number; endMs: number; sourceStartMs: number; sourceEndMs: number; label: string }
type Rail = 'story' | 'visuals' | 'audio' | 'text' | 'styles'

function clock(ms: number) {
  const s = Math.floor(Math.max(0, ms) / 1000)
  return (s >= 3600 ? String(Math.floor(s / 3600)).padStart(2, '0') + ':' : '') +
    String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
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
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [labelDraft, setLabelDraft] = useState('')
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const tried = useRef(new Set<string>())
  const fallbacks = useMemo(() => editorMediaLoadFallbacks(props.primaryMedia, props.mediaUrls, {
    sourceSegStartMs: props.sourceSegStartMs, sourceSegEndMs: props.sourceSegEndMs,
    clipStartMs: props.clipStartMs, clipEndMs: props.clipEndMs,
  }), [props.primaryMedia, props.mediaUrls, props.sourceSegStartMs, props.sourceSegEndMs, props.clipStartMs, props.clipEndMs])
  const videoUrl = media?.url ?? props.mediaUrls.proxy ?? props.mediaUrls.segment ?? props.mediaUrls.source ?? props.mediaUrls.preview
  const offset = media?.offsetMs ?? 0
  const { edits, setEdits, undo, redo, canUndo, canRedo, saveState, flushSave, setLayoutMode, syncWordsForCuts } =
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

  const selectScene = useCallback((s: Scene) => {
    setSelectedStart(s.startMs)
    setPlayheadOut(s.startMs)
    const v = videoRef.current
    if (v) v.currentTime = videoTimeFromSourceMs(s.sourceStartMs, offset)
    console.log('[editor:story-mode] scene-selected', { projectId, clipId, startMs: s.startMs, endMs: s.endMs })
  }, [projectId, clipId, offset])
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
  const reportError = (action: string, e: unknown) => {
    const reason = e instanceof Error ? e.message : 'This scene edit was not applied'
    setMutationError(reason)
    toast.error(reason)
    console.error('[editor:story-mode] mutation-failed', { projectId, clipId, action, reason })
  }
  const commit = (action: string, next: ClipEditsV2 | null) => {
    if (!next) return reportError(action, new Error('The current edit cannot represent that scene operation safely.'))
    setMutationError(null)
    setEdits(next)
    console.log('[editor:story-mode] mutation', { projectId, clipId, action, sceneStartMs: selected?.startMs ?? null })
  }
  const splitScene = () => {
    if (!selected || selected.endMs - selected.startMs < 1200 || (edits.markers?.length ?? 0) >= MAX_MARKERS)
      return reportError('split', new Error('This block cannot be split into two valid scene boundaries.'))
    const at = Math.round((selected.startMs + selected.endMs) / 2)
    const marker = { id: 'story_' + crypto.randomUUID().replaceAll('-', '').slice(0, 28), ms: at, color: 'blue' as const }
    const markers = normalizeMarkers([...(edits.markers ?? []), marker])
    commit('split-boundary', { ...edits, markers })
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
  const deleteScene = () => {
    if (!selected || simpleEdlReason) return reportError('delete', new Error(simpleEdlReason || 'No scene is selected'))
    const next = deleteRange({ edits, previewEdits }, [selected.startMs, selected.endMs])
    commit('delete-output-range', next)
    if (next) setSelectedStart(null)
  }
  const reorderScene = (from: number, before: number) => {
    const moving = scenes[from]
    const target = scenes[before]
    if (!moving || !target || from === before || !canReorder(moving) || !canReorder(target))
      return reportError('reorder', new Error(simpleEdlReason || 'Reorder needs scene boundaries that match a video segment. Open the clip editor to split the footage first.'))
    const next = moveVideoSegment({ edits, previewEdits }, 'seg:' + moving.sourceStartMs, 'seg:' + target.sourceStartMs)
    if (!next || timebaseFor(editorPreviewEdits(next, words)).durationMs !== tb.durationMs)
      return reportError('reorder', new Error('The section-order normalizer could not preserve this scene move.'))
    commit('reorder-sectionOrder', next)
    setSelectedStart(null)
    console.log('[editor:story-mode] reorder', { projectId, clipId, from, before })
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
  const openOther = async (target: 'edit' | 'text' | 'templates') => {
    console.log('[editor:story-mode] handoff-start', { projectId, clipId, target })
    try { await flushSave() } catch {
      reportError('handoff', new Error('Save edits before changing editors'))
      return
    }
    const query = props.clipperStudio ? { from: 'studio' } : undefined
    const url = target === 'text' ? routes.text(projectId, clipId, query)
      : target === 'templates' ? routes.templateMode(projectId, clipId, query)
        : props.clipperStudio ? routes.studio(projectId, clipId) : routes.edit(projectId, clipId)
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
    } catch (e) { reportError('visual-attach', e); throw e }
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
    { id: 'text', label: 'Text / Captions', icon: Clapperboard },
    { id: 'styles', label: 'Styles / Brand', icon: Palette },
  ]

  return <ClipperSurfaceErrorBoundary surface="Story blocks editor">
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground" data-testid="story-blocks-editor">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
        <Button variant="ghost" size="icon" render={<Link href={routes.project(projectId)} />} aria-label="Back to project"><ArrowLeft className="size-4" /></Button>
        <div className="min-w-0"><p className="truncate text-[10px] text-muted-foreground">{props.projectTitle}</p><h1 className="max-w-56 truncate text-sm font-semibold">{props.initialTitle}</h1></div>
        <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium">Story blocks</span>
        <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">{saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Save failed' : 'Saving…'}</span>
        {saveState === 'error' && <Button variant="outline" size="sm" onClick={() => void flushSave().catch((e) => reportError('save-retry', e))}><RefreshCw className="mr-1 size-3" />Retry</Button>}
        <Button variant="ghost" size="icon" aria-label="Undo" disabled={!canUndo} onClick={() => { undo(); setSelectedStart(null); console.log('[editor:story-mode] undo', { projectId, clipId }) }}><Undo2 className="size-4" /></Button>
        <Button variant="ghost" size="icon" aria-label="Redo" disabled={!canRedo} onClick={() => { redo(); setSelectedStart(null); console.log('[editor:story-mode] redo', { projectId, clipId }) }}><Redo2 className="size-4" /></Button>
        <Button size="sm" variant="outline" onClick={() => { setExportOpen(true); console.log('[editor:story-mode] export-open', { projectId, clipId }) }}><Download className="mr-1 size-4" />Export</Button>
        <Button variant="outline" size="sm" onClick={() => void openOther('text')}>Text editor</Button>
        <Button variant="outline" size="sm" onClick={() => void openOther('templates')}>Templates</Button>
        <Button size="sm" onClick={() => void openOther('edit')}>Clip editor</Button>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav className="flex w-[76px] shrink-0 flex-col border-r border-border bg-card/50 py-3" aria-label="Story tools">
          {rail.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => {
            setTab(id); console.log('[editor:story-mode] tool-selected', { projectId, clipId, tool: id })
          }} aria-current={tab === id ? 'page' : undefined} className={'flex flex-col items-center gap-1 px-1 py-3 text-[10px] ' + (tab === id ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground hover:bg-muted')}>
            <Icon className="size-5" />{label}
          </button>)}
        </nav>
        <aside className="flex w-[390px] shrink-0 flex-col border-r border-border bg-card/30 xl:w-[430px]" aria-label="Scene cards and tools">
          {tab === 'story' ? <>
            <div className="border-b border-border p-3">
              <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Story</h2><span className="text-xs text-muted-foreground">{scenes.length} scenes</span></div>
              <div className="mt-3 flex gap-2">
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-input px-2"><Search className="size-4 text-muted-foreground" /><input className="h-9 min-w-0 flex-1 bg-transparent text-xs outline-none" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a scene" aria-label="Find scenes" /></label>
                <Button variant="outline" size="sm" disabled title="Adding new source footage belongs in the Clip editor."><Plus className="mr-1 size-3" />Add scene</Button>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">Add new footage in Clip editor. Scene boundaries here split existing footage only.</p>
            </div>
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
                      </div>
                    </div>
                  }) : <p className="py-8 text-center text-xs text-muted-foreground">No scenes match this search.</p>}
            </div>
            <div className="border-t border-border p-3 text-[11px] text-muted-foreground">Scenes follow the existing source edit. Label changes do not change recorded words or narration.</div>
          </> : <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <Button variant="ghost" size="sm" onClick={() => setTab('story')}><ArrowLeft className="mr-1 size-3" />Back to story</Button>
            <h2 className="text-sm font-semibold">{rail.find((r) => r.id === tab)?.label}</h2>
            {tab === 'visuals' ? <>
              <p className="text-xs text-muted-foreground">Stock B-roll covers only the selected scene; recorded audio stays intact.</p>
              <Button variant="outline" disabled={Boolean(stockAttachReason)} title={stockAttachReason ?? undefined} onClick={() => setPickerOpen(true)}>Replace selected visual</Button>
              {stockAttachReason && <p className="text-xs text-muted-foreground">{stockAttachReason}</p>}
              <Button variant="outline" size="sm" onClick={() => setLayoutOpen((v) => !v)} aria-expanded={layoutOpen}>Layout / aspect</Button>
              {layoutOpen && <LayoutQuickPicker value={edits.layout.mode} edits={edits} facecamLayout={props.facecamLayout} reframeV2Enabled={props.reframeV2Enabled} onPick={(mode, facecam) => { setLayoutMode(mode, facecam); console.log('[editor:story-mode] layout', { projectId, clipId, mode }) }} onAspectChange={(aspect) => { commit('aspect-global', { ...edits, aspectRatio: aspect }) }} />}
            </> : tab === 'audio' ? <>
              <p className="text-xs text-muted-foreground">This recording uses its current audio. Changing narration or generating voice cannot be scoped safely from a scene label.</p>
              <Button size="sm" variant="outline" onClick={() => void openOther('edit')}>Open audio tools in clip editor</Button>
            </> : tab === 'text' ? <>
              <p className="text-xs text-muted-foreground">Scene labels are metadata. Transcript correction changes caption text only, not the recorded voice.</p>
              <Button size="sm" variant="outline" onClick={() => void openOther('text')}>Edit transcript / captions</Button>
              <label className="block text-xs">Caption style</label>
              <select className="w-full rounded-md border border-input bg-background p-2 text-xs" value={edits.captions.presetId ?? ''} onChange={(e) => commit('caption-style', captionPresetPatch(edits, e.target.value))}>
                <option value="">Current / default</option>{captionStyleOptions(false).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </> : <>
              <p className="text-xs text-muted-foreground">Existing project templates and brand settings are shared with every editor mode.</p>
              <Button size="sm" variant="outline" onClick={() => void openOther('templates')}>Open styles and brand templates</Button>
            </>}
          </div>}
        </aside>
        <main className="flex min-w-0 flex-1 flex-col" aria-label="Selected scene and preview">
          <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2">
            <div><h2 className="text-sm font-semibold">{selected ? 'Scene ' + (selectedIndex + 1) : 'No scene selected'}</h2>
              <p className="text-[11px] text-muted-foreground">{selected ? clock(displayPositionMs(previewEdits, selected.endMs) - displayPositionMs(previewEdits, selected.startMs)) + ' · ' + (edits.aspectRatio ?? '9:16') : 'Select a scene card'}</p>
            </div>
            {selected && <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => selectScene(selected)}>Preview scene</Button>
              <Button variant="outline" size="sm" disabled={Boolean(stockAttachReason)} title={stockAttachReason ?? undefined} onClick={() => setPickerOpen(true)}>Replace visual</Button>
              <Button variant="outline" size="sm" onClick={() => { setTab('visuals'); setLayoutOpen(true) }}>Layout</Button>
            </div>}
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted/10 p-4">
            {videoUrl ? <PreviewStage clipId={clipId} videoUrl={videoUrl} posterUrl={props.posterUrl} edits={previewEdits} words={words} cropTrack={props.cropTrack} brollMedia={brollMedia} media={media} videoRef={videoRef} onEditorMediaError={onMediaError} onTick={(tick) => {
              setPlayheadOut(tick.outputMs); setPlaying(tick.playing)
              if (tick.playing) {
                const scene = scenes.find((s) => tick.outputMs >= s.startMs && tick.outputMs < s.endMs)
                if (scene) setSelectedStart(scene.startMs)
              }
            }} /> :
              <div className="space-y-3 text-center text-xs text-muted-foreground"><p>Media unavailable. The source edit is preserved.</p><Button size="sm" variant="outline" onClick={() => { tried.current.clear(); setMedia(props.primaryMedia); console.log('[editor:story-mode] media-retry', { projectId, clipId }) }}>Retry media</Button></div>}
          </div>
          <div className="flex items-center justify-center gap-3 border-t border-border p-2">
            <Button variant="ghost" size="icon" aria-label={playing ? 'Pause' : 'Play'} onClick={() => {
              const video = videoRef.current
              if (!video) return
              if (video.paused) void video.play().catch((e) => reportError('play', e))
              else video.pause()
            }}>{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</Button>
            <span className="font-mono text-xs tabular-nums">{clock(displayPositionMs(previewEdits, playheadOut))} / {clock(displayDurationMs(previewEdits))}</span>
          </div>
          {selected && <section className="space-y-3 border-t border-border bg-card/40 p-3" aria-label="Selected scene tools">
            <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-semibold">Scene {selectedIndex + 1} · script / beat</h3><span className="text-[10px] text-muted-foreground">Label only — not voice</span></div>
            <div className="flex gap-2">
              <input className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-xs" value={labelDraft} onChange={(e) => setLabelDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveLabel() } }} maxLength={80} aria-label="Scene label" />
              <Button variant="outline" size="sm" disabled={!labelDraft.trim() || labelDraft.trim() === selected.label} onClick={saveLabel}>Save label</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={splitScene} disabled={selected.endMs - selected.startMs < 1200 || (edits.markers?.length ?? 0) >= MAX_MARKERS}><Scissors className="mr-1 size-3" />Split boundary</Button>
              <Button variant="outline" size="sm" onClick={mergeScene} disabled={selectedIndex < 1 || !edits.markers?.some((m) => m.id.startsWith('story_') && Math.abs(m.ms - selected.startMs) < 35)}>Merge boundary</Button>
              <Button variant="outline" size="sm" onClick={deleteScene} disabled={Boolean(simpleEdlReason) || scenes.length < 2} title={simpleEdlReason ?? undefined}><Trash2 className="mr-1 size-3" />Delete footage</Button>
              <Button variant="outline" size="sm" onClick={() => void openOther('text')}>Edit words in Text</Button>
            </div>
            {simpleEdlReason && <p className="text-[11px] text-muted-foreground">{simpleEdlReason}</p>}
            {mutationError && <div role="alert" className="flex items-center gap-2 text-xs text-destructive"><span className="flex-1">{mutationError}</span><Button size="sm" variant="outline" onClick={() => setMutationError(null)}>Dismiss</Button></div>}
          </section>}
        </main>
      </div>
      <div className="shrink-0 border-t border-border bg-card/50 px-3 py-2" aria-label="Scene thumbnail strip">
        <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold">Story order</span><span className="text-[10px] text-muted-foreground">{scenes.length} scenes · {clock(displayDurationMs(previewEdits))} final</span></div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {scenes.map((scene, index) => <button key={scene.id} type="button" onClick={() => selectScene(scene)} className={'shrink-0 rounded-md border p-1 text-left ' + (selected?.id === scene.id ? 'border-primary ring-1 ring-primary/20' : 'border-border')} aria-current={selected?.id === scene.id ? 'true' : undefined}>
            {frame(scene, true)}<span className="block pt-1 text-[10px] text-muted-foreground">{index + 1} · {clock(displayPositionMs(previewEdits, scene.endMs) - displayPositionMs(previewEdits, scene.startMs))}</span>
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
