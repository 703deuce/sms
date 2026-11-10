'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Clapperboard, Download, FileText, Loader2, Pause, Play, Redo2, RefreshCw, Search, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ClipperSurfaceErrorBoundary } from '@/components/clips/clipper-surface-error-boundary'
import { TranscriptPanel, type TranscriptSelection } from '@/components/clips/editor/transcript-panel'
import { PreviewStage } from '@/components/clips/editor/preview-stage'
import { ExportDialog } from '@/components/clips/editor/export-dialog'
import { LayoutQuickPicker } from '@/components/clips/editor/layout-quick-picker'
import { PreviewChipRow } from '@/components/clips/editor/preview-chip-row'
import { useEditorState } from '@/components/clips/editor/use-editor-state'
import { useEditorWords } from '@/components/clips/editor/use-editor-words'
import { useFilmstripFrames } from '@/components/clips/editor/timeline/use-filmstrip-frames'
import type { EditorClipShell } from '@/components/clips/editor/editor-clip-shell'
import { editorMediaLoadFallbacks } from '@/lib/server/clips/editor-clip-media'
import { editorIconBtn, editorIconBtnActive } from '@/lib/clips/editor/editor-chrome-tokens'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import { outputToSource, timebaseFor } from '@/lib/clips/editor/clip-timeline'
import { videoTimeFromSourceMs } from '@/lib/clips/editor-playback'
import { wordDisplayText } from '@/lib/clips/edits'
import { loadSourceWords, type SourceWord } from '@/lib/clips/source-words'
import { paragraphStarts } from '@/lib/clips/editor/transcript-edit'
import { sourceWordsForClipEditing } from '@/lib/clips/editor/clip-editor-word-scope'
import { snapTranscriptSelectionMs } from '@/lib/clips/editor/make-clip-from-transcript'
import { captionPresetPatch, captionStyleOptions } from '@/lib/clips/editor/starter-templates'
import { applyBrandTemplateToEdits } from '@/lib/clips/apply-brand'
import type { BrandTemplateSettings } from '@/lib/clips/brand'
import { deriveClipFromEditor, clipsFetch } from '@/lib/clips-api'
import { routes } from '@/lib/routes'

type Props = Parameters<typeof EditorClipShell>[0]
type Scene = { start: number; end: number; label: string; id: string }
type BrandRow = { id: string; name: string; settings: unknown; logoKey?: string | null; introVideoKey?: string | null; outroVideoKey?: string | null }

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
    for (const word of active) {
      if (breaks.has(word.i) && word.s * 1000 < edits.trim.out) starts.add(Math.max(edits.trim.in, Math.round(word.s * 1000)))
    }
  }
  const ordered = [...starts].sort((a, b) => a - b)
  return ordered.map((start, index) => {
    const end = ordered[index + 1] ?? edits.trim.out
    const phrase = active.filter((w) => w.s * 1000 >= start && w.s * 1000 < end).slice(0, 7)
      .map((w) => wordDisplayText(w, edits.wordFixes)).join(' ').trim()
    return { start, end, id: 'scene-' + index, label: phrase || 'Scene ' + (index + 1) }
  }).filter((s) => s.end > s.start)
}

/** A separate view of the same clip, EDL, history, and autosave; no timeline is mounted. */
export function TextSceneEditorShell(props: Props) {
  const { clipId, projectId, bounds } = props
  const normalizedWords = useMemo(() => loadSourceWords(props.words), [props.words])
  const [media, setMedia] = useState(props.primaryMedia)
  const [exportOpen, setExportOpen] = useState(false)
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [title] = useState(props.initialTitle)
  const [playing, setPlaying] = useState(false)
  const [playhead, setPlayhead] = useState(props.initialEdits.trim.in)
  const [derived, setDerived] = useState<string | null>(null)
  const [brands, setBrands] = useState<BrandRow[]>([])
  const selectionRef = useRef<TranscriptSelection | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const tried = useRef(new Set<string>())
  const fallbacks = useMemo(() => editorMediaLoadFallbacks(props.primaryMedia, props.mediaUrls, {
    sourceSegStartMs: props.sourceSegStartMs, sourceSegEndMs: props.sourceSegEndMs,
    clipStartMs: props.clipStartMs, clipEndMs: props.clipEndMs,
  }), [props.primaryMedia, props.mediaUrls, props.sourceSegStartMs, props.sourceSegEndMs, props.clipStartMs, props.clipEndMs])
  const videoUrl = media?.url ?? props.mediaUrls.proxy ?? props.mediaUrls.segment ?? props.mediaUrls.source ?? props.mediaUrls.preview
  const posterUrl = props.posterUrl
  const mediaOffsetMs = media?.offsetMs ?? 0
  const { edits, setEdits, undo, redo, canUndo, canRedo, saveState, flushSave, applyCleanupCut,
    setWordFix, applyWordFixesBatch, restoreWord, restoreCutRange, setTrim, setLayoutMode,
    syncWordsForCuts } = useEditorState(clipId, bounds, props.initialEdits, {
      serverUpdatedAt: props.serverUpdatedAt, editsSaveVersion: props.editsSaveVersion, words: normalizedWords,
      editorSaveSeq: typeof (props.aiMeta as { __editorSaveSeq?: number } | null)?.__editorSaveSeq === 'number'
        ? (props.aiMeta as { __editorSaveSeq: number }).__editorSaveSeq : 0,
    })
  const { words, wordsLoading, loadingReason, reloadWords } = useEditorWords(clipId, normalizedWords, bounds, edits.trim)
  useEffect(() => { syncWordsForCuts(words) }, [words, syncWordsForCuts])
  useEffect(() => {
    console.info('[editor:text-mode] route-entry', { projectId, clipId })
    console.info('[editor:text-mode] edits-hydrate', { projectId, clipId, version: props.editsSaveVersion })
  }, [projectId, clipId, props.editsSaveVersion])
  useEffect(() => {
    void clipsFetch<{ items: BrandRow[] }>('/api/clips/brand/templates')
      .then((data) => { setBrands(data.items ?? []); console.info('[editor:text-mode] brand-presets-loaded', { projectId, clipId, count: data.items?.length ?? 0 }) })
      .catch(() => { console.warn('[editor:text-mode] brand-presets-unavailable', { projectId, clipId }) })
  }, [projectId, clipId])

  const previewEdits = useMemo(() => editorPreviewEdits(edits, words), [edits, words])
  const scenes = useMemo(() => buildScenes(words, edits), [words, edits])
  const sceneKey = scenes.map((s) => s.start).join(',')
  useEffect(() => console.info('[editor:text-mode] scene-list-built', { projectId, clipId, count: scenes.length }), [projectId, clipId, sceneKey, scenes.length])
  const [selectedScene, setSelectedScene] = useState(0)
  const frameExtractor = useFilmstripFrames(videoUrl)
  const framesAt = useMemo(() => scenes.map((scene) => Math.max(0, scene.start - mediaOffsetMs + 100)), [scenes, mediaOffsetMs])
  const frameKey = framesAt.join(',')
  const thumbStartedRef = useRef(0)
  useEffect(() => {
    if (!frameExtractor || !framesAt.length) return
    thumbStartedRef.current = Date.now()
    console.info('[editor:text-mode] thumbnail-backfill-started', { projectId, clipId, count: framesAt.length, hasMedia: Boolean(videoUrl) })
    frameExtractor.want(framesAt, 1000)
  }, [frameExtractor, frameKey, projectId, clipId, videoUrl])
  const readyThumbnails = frameExtractor ? framesAt.filter((t) => Boolean(frameExtractor.get(t, 1000))).length : 0
  const thumbDoneRef = useRef('')
  useEffect(() => {
    if (!frameExtractor || !framesAt.length || (!frameExtractor.failed && readyThumbnails < framesAt.length)) return
    const key = clipId + ':' + frameKey + ':' + (frameExtractor.failed ? 'failed' : 'ready')
    if (thumbDoneRef.current === key) return
    thumbDoneRef.current = key
    console.info('[editor:text-mode] thumbnail-backfill-finished', {
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
      console.error('[editor:text-mode] media-fallback-exhausted', { projectId, clipId })
    }
  }, [media?.url, fallbacks, projectId, clipId])
  const seekSource = useCallback((ms: number) => {
    const sourceMs = Math.max(edits.trim.in, Math.min(edits.trim.out, ms))
    setPlayhead(sourceMs)
    if (videoRef.current) videoRef.current.currentTime = videoTimeFromSourceMs(sourceMs, mediaOffsetMs)
  }, [edits.trim.in, edits.trim.out, mediaOffsetMs])
  const openClipEditor = async () => {
    console.info('[editor:text-mode] open-in-clip-editor', { projectId, clipId })
    try { await flushSave() } catch {
      toast.error('Save edits before switching editors')
      return
    }
    window.location.assign(props.clipperStudio ? routes.studio(projectId, clipId) : routes.edit(projectId, clipId))
  }
  const createClip = useCallback(async (start: number, end: number, clipTitle?: string) => {
    console.info('[editor:text-mode] create-clip-started', { projectId, clipId, startMs: start, endMs: end })
    try {
      await flushSave()
      const snapped = snapTranscriptSelectionMs(start, end, words, edits.trim.in, edits.trim.out)
      const created = await deriveClipFromEditor(clipId, { trimIn: snapped.trimIn, trimOut: snapped.trimOut, title: clipTitle || snapped.title })
      if (created.projectId !== projectId) throw new Error('Clip was not created in this project')
      setDerived(created.clipId)
      console.info('[editor:text-mode] create-clip-finished', { projectId, clipId, newClipId: created.clipId })
      toast.success('Clip added to this project')
    } catch (error) {
      console.error('[editor:text-mode] create-clip-failed', { projectId, clipId, name: error instanceof Error ? error.name : 'UnknownError' })
      toast.error(error instanceof Error ? error.message : 'Could not create clip')
    }
  }, [clipId, projectId, words, edits.trim.in, edits.trim.out, flushSave])
  const highlightSelection = useCallback((indices: number[]) => {
    if (!indices.length) return
    const current = edits.captions.emphasis ?? []
    const allSelected = indices.every((i) => current.includes(i))
    const next = allSelected ? current.filter((i) => !indices.includes(i)) : [...new Set([...current, ...indices])]
    setEdits({ ...edits, captions: { ...edits.captions, enabled: true, keywordHighlight: true, emphasis: next } })
    console.info('[editor:text-mode] emphasis-selection', { projectId, clipId, words: indices.length, enabled: !allSelected })
  }, [edits, setEdits, projectId, clipId])
  const activeScene = Math.max(0, scenes.findIndex((s) => playhead >= s.start && playhead < s.end))
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
          <Button variant="ghost" size="icon" disabled={!canUndo} aria-label="Undo" onClick={() => { undo(); console.info('[editor:text-mode] undo', { projectId, clipId }) }}><Undo2 className="size-4" /></Button>
          <Button variant="ghost" size="icon" disabled={!canRedo} aria-label="Redo" onClick={() => { redo(); console.info('[editor:text-mode] redo', { projectId, clipId }) }}><Redo2 className="size-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => { setExportOpen(true); console.info('[editor:text-mode] export-opened', { projectId, clipId }) }}><Download className="mr-1 size-4" />Export</Button>
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
                const frameMs = framesAt[index] ?? 0
                const frame = frameExtractor?.get(frameMs, 1000)
                return <button type="button" key={scene.id} onClick={() => {
                  setSelectedScene(index); seekSource(scene.start)
                  console.info('[editor:text-mode] scene-selected', { projectId, clipId, scene: index, startMs: scene.start })
                }} className={'w-full overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-all hover:border-primary/60 ' + ((activeScene === index || selectedScene === index) ? 'border-primary ring-2 ring-primary/15' : 'border-border')}>
                  <div className="relative aspect-video overflow-hidden bg-muted">
                    {frame ? <img src={frame} alt={'Frame from scene ' + (index + 1)} className="h-full w-full object-cover" /> :
                      frameExtractor?.failed && videoUrl ?
                        <video src={videoUrl + '#t=' + Math.max(0, frameMs / 1000).toFixed(2)} preload="metadata" muted playsInline className="h-full w-full object-cover" aria-label={'Scene ' + (index + 1) + ' frame'} /> :
                        posterUrl ? <img src={posterUrl} alt="Video poster while scene frame loads" className="h-full w-full object-cover opacity-70" /> :
                          <div className="flex h-full items-center justify-center text-xs text-muted-foreground"><Loader2 className="mr-1 size-4 animate-spin" />Preparing frame</div>}
                    <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">{clock(scene.start - edits.trim.in)}</span>
                  </div>
                  <div className="px-2.5 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Scene {index + 1}</p><p className="mt-0.5 line-clamp-2 text-xs leading-snug">{scene.label}</p></div>
                </button>
              })}
              {!scenes.length && <p className="px-2 py-5 text-center text-xs text-muted-foreground">Scenes appear with the transcript.</p>}
            </div>
          </aside>
          <main className="flex min-h-0 min-w-[300px] flex-[1.15] flex-col bg-card" aria-label="Transcript document">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5"><div><h2 className="text-sm font-semibold">Transcript</h2><p className="text-[11px] text-muted-foreground">Select words to edit your video</p></div><span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">Text editor</span></div>
            {isPending && !words.length ? <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"><Loader2 className="size-6 animate-spin text-primary" /><p className="text-sm font-medium">Transcribing recording</p><p className="text-xs text-muted-foreground">Words and scenes will appear when the transcript is ready.</p><Button size="sm" variant="outline" onClick={() => void reloadWords().catch(() => toast.error('Transcript refresh failed'))}><RefreshCw className="mr-1 size-4" />Refresh transcript</Button></div> :
              !words.length ? <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"><FileText className="size-7 text-muted-foreground" /><p className="text-sm font-medium">No spoken words found yet</p><p className="text-xs text-muted-foreground">You can retry loading the transcript or open this clip in the regular editor.</p><Button variant="outline" size="sm" onClick={() => void reloadWords().catch(() => toast.error('Transcript refresh failed'))}><RefreshCw className="mr-1 size-4" />Retry</Button></div> :
                <TranscriptPanel
                  words={words} wordsLoading={wordsLoading} wordsLoadingReason={loadingReason} shots={props.cropShots}
                  edits={edits} clipStartMs={bounds.clipStartMs} clipEndMs={bounds.clipEndMs} selectionRef={selectionRef}
                  onSeek={seekSource} onAddCut={(range) => {
                    console.info('[editor:text-mode] sentence-delete', { projectId, clipId, range })
                    applyCleanupCut(range)
                  }}
                  onWordFix={setWordFix} applyWordFixesBatch={applyWordFixesBatch} onRestoreWord={restoreWord}
                  onRestoreCutRange={restoreCutRange} onExtendTrim={(ms) => setTrim({ in: Math.min(ms, edits.trim.in), out: Math.max(ms, edits.trim.out) })}
                  onSaveAsNewClip={createClip} onEmphasisSelection={highlightSelection} textSceneMode
                  playheadSourceMs={playhead} onSetEdits={setEdits} compactToolbar largeScript
                />}
          </main>
          <section className="flex min-w-[280px] flex-[1] flex-col border-l border-border bg-background" aria-label="Video preview">
            <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2"><span className="text-xs font-semibold">Preview</span><Button size="sm" variant="outline" onClick={() => setLayoutOpen((v) => !v)} aria-expanded={layoutOpen}>Layouts · {edits.aspectRatio ?? '9:16'}</Button></div>
            {layoutOpen && <div className="max-h-56 overflow-y-auto border-b border-border bg-card p-3">
              <LayoutQuickPicker value={edits.layout.mode} edits={edits} facecamLayout={props.facecamLayout} reframeV2Enabled={props.reframeV2Enabled} onPick={(mode, facecam) => { setLayoutMode(mode, facecam); console.info('[editor:text-mode] layout-picked', { projectId, clipId, mode }) }} onAspectChange={(aspect) => { setEdits({ ...edits, aspectRatio: aspect }); console.info('[editor:text-mode] aspect-picked', { projectId, clipId, aspect }) }} />
            </div>}
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted/15 p-3">
              {videoUrl ? <PreviewStage clipId={clipId} videoUrl={videoUrl} posterUrl={posterUrl}
                edits={previewEdits} words={words} cropTrack={props.cropTrack} brollMedia={props.brollMedia}
                media={media} videoRef={videoRef} onEditorMediaError={onMediaError}
                onTick={(tick) => { setPlayhead(tick.sourceMs); setPlaying(tick.playing) }}
              /> : <div className="space-y-2 text-center"><p className="text-sm">Video is unavailable</p><Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry preview</Button></div>}
            </div>
            <div className="flex items-center justify-center gap-3 border-t border-border px-3 py-2">
              <Button variant="ghost" size="icon" aria-label={playing ? 'Pause' : 'Play'} onClick={() => {
                const v = videoRef.current
                if (!v) return
                if (v.paused) void v.play().catch(() => toast.error('Preview playback unavailable'))
                else v.pause()
              }}>{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</Button>
              <span className="font-mono text-xs tabular-nums">{clock(playhead - edits.trim.in)} / {clock(edits.trim.out - edits.trim.in)}</span>
            </div>
            <div className="border-t border-border px-3 py-2">
              <PreviewChipRow>
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs">Original</span>
                <button type="button" className={'rounded-full border px-2.5 py-1 text-xs ' + (edits.captions.enabled !== false ? 'border-primary/30 bg-primary/10' : 'border-border')} onClick={() => setEdits({ ...edits, captions: { ...edits.captions, enabled: edits.captions.enabled === false } })}>Subtitles</button>
                {props.brollMedia.length ? <span className="rounded-full border border-border px-2.5 py-1 text-xs">Attached media</span> : null}
              </PreviewChipRow>
            </div>
            <div className="space-y-2 border-t border-border bg-card/60 p-3">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="text-mode-caption-style">Caption template</label>
              <select id="text-mode-caption-style" className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs" value={edits.captions.presetId ?? ''} onChange={(e) => {
                setEdits(captionPresetPatch(edits, e.target.value))
                console.info('[editor:text-mode] caption-template-picked', { projectId, clipId, preset: e.target.value })
              }}><option value="">Current / default</option>{captionStyleOptions(false).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              {brands.length > 0 && <>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="text-mode-brand">Brand kit</label>
                <select id="text-mode-brand" className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs" defaultValue="" onChange={(e) => {
                  const brand = brands.find((b) => b.id === e.target.value)
                  if (!brand) return
                  try {
                    setEdits(applyBrandTemplateToEdits(edits, { id: brand.id, settings: brand.settings as BrandTemplateSettings, logoKey: brand.logoKey ?? null, introVideoKey: brand.introVideoKey ?? null, outroVideoKey: brand.outroVideoKey ?? null }))
                    console.info('[editor:text-mode] brand-kit-picked', { projectId, clipId, brandId: brand.id })
                  } catch (error) { toast.error(error instanceof Error ? error.message : 'Brand kit unavailable') }
                }}><option value="">Use existing brand</option>{brands.map((b) => <option value={b.id} key={b.id}>{b.name}</option>)}</select>
              </>}
              {derived && <Link href={routes.edit(projectId, derived)} className="block text-xs font-medium text-primary underline">Open newly created clip</Link>}
            </div>
          </section>
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
