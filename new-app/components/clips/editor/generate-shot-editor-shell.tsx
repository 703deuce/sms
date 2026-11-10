'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Download, Undo2, Redo2, Play, Pause, Sparkles, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ClipperSurfaceErrorBoundary } from '@/components/clips/clipper-surface-error-boundary'
import { ExportDialog } from '@/components/clips/editor/export-dialog'
import { useEditorState } from '@/components/clips/editor/use-editor-state'
import type { EditorClipShell } from '@/components/clips/editor/editor-clip-shell'
import { loadSourceWords } from '@/lib/clips/source-words'
import { normalizeEditSpeed, orderedKeepSegments } from '@/lib/clips/edits'
import { routes } from '@/lib/routes'

type EditorProps = Parameters<typeof EditorClipShell>[0]
type Props = Pick<EditorProps,
  'projectId' | 'projectTitle' | 'clipId' | 'initialTitle' | 'serverUpdatedAt' |
  'editsSaveVersion' | 'bounds' | 'initialEdits' | 'words' | 'mediaUrls' |
  'sourceSegStartMs' | 'sourceSegEndMs' | 'posterUrl' | 'facecamLayout' |
  'reframeV2Enabled' | 'aiMeta' | 'fullVideo'
> & {
  initialAtMs?: number
  initialRange: { startMs: number; endMs: number } | null
  fromStudio: boolean
}

const V2V_BLOCKER = 'No verified source-video editing model is configured. Studio models currently generate from text or images, not existing footage. Generation is disabled to protect your source and credits.'

function clock(ms: number): string {
  const sec = Math.floor(Math.max(0, ms) / 1000)
  const hh = Math.floor(sec / 3600)
  const mm = Math.floor(sec / 60) % 60
  const ss = sec % 60
  return (hh ? String(hh).padStart(2, '0') + ':' : '') + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0')
}

export function GenerateShotEditorShell(props: Props) {
  const { projectId, clipId } = props
  const words = useMemo(() => loadSourceWords(props.words), [props.words])
  const { edits, setEdits, undo, redo, canUndo, canRedo, saveState, flushSave } = useEditorState(
    clipId, props.bounds, props.initialEdits, {
      serverUpdatedAt: props.serverUpdatedAt,
      editsSaveVersion: props.editsSaveVersion,
      words,
      editorSaveSeq: typeof (props.aiMeta as { __editorSaveSeq?: number } | null)?.__editorSaveSeq === 'number'
        ? (props.aiMeta as { __editorSaveSeq: number }).__editorSaveSeq : 0,
    },
  )
  // Only signed original source media (or its signed source segment) is a candidate.
  // A render/proxy/preview is not silently treated as provider-editable footage.
  const source = useMemo(() => props.mediaUrls.source
    ? { url: props.mediaUrls.source, offsetMs: 0, startMs: 0, endMs: Number.POSITIVE_INFINITY, kind: 'source' }
    : props.mediaUrls.segment && props.sourceSegStartMs != null && props.sourceSegEndMs != null
      ? { url: props.mediaUrls.segment, offsetMs: props.sourceSegStartMs,
          startMs: props.sourceSegStartMs, endMs: props.sourceSegEndMs, kind: 'segment' }
      : null,
  [props.mediaUrls.source, props.mediaUrls.segment, props.sourceSegStartMs, props.sourceSegEndMs])
  const minMs = source ? Math.max(source.startMs, edits.trim.in) : edits.trim.in
  const maxMs = source ? Math.min(source.endMs, edits.trim.out) : edits.trim.out
  const [playheadMs, setPlayheadMs] = useState(() => props.initialAtMs !== undefined && props.initialAtMs >= minMs && props.initialAtMs <= maxMs
    ? props.initialAtMs : minMs)
  const [inMs, setInMs] = useState<number | null>(() => props.initialRange?.startMs ?? null)
  const [outMs, setOutMs] = useState<number | null>(() => props.initialRange?.endMs ?? null)
  const [instruction, setInstruction] = useState('')
  const [view, setView] = useState<'original' | 'result'>('original')
  const [playing, setPlaying] = useState(false)
  const [mediaFailure, setMediaFailure] = useState(false)
  const [mediaReady, setMediaReady] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const inFlightRef = useRef(false)
  const hasRange = inMs !== null && outMs !== null
  const validRange = Boolean(source && maxMs > minMs && hasRange && inMs >= minMs && outMs <= maxMs && outMs > inMs)

  // A simple contiguous source interval has a unique output mapping. Complex cuts,
  // reordered/duplicated sections, speed changes and inserts require a proper range
  // replacement adapter; never guess the output range from a raw source clock.
  const outputRange = useMemo(() => {
    if (!validRange || inMs === null || outMs === null) return null
    if (edits.sectionOrder?.length || edits.segmentSpeeds?.length || edits.inserts?.length ||
        edits.sourceSegments?.length || normalizeEditSpeed(edits.speed)) return null
    let cursor = 0
    let match: { startMs: number; endMs: number } | null = null
    let count = 0
    for (const [start, end] of orderedKeepSegments(edits)) {
      if (inMs >= start && outMs <= end) {
        count += 1
        match = { startMs: cursor + inMs - start, endMs: cursor + outMs - start }
      }
      cursor += end - start
    }
    return count === 1 ? match : null
  }, [edits, inMs, outMs, validRange])

  const rangeIssue = !source
    ? 'An authorized original source is not available for this clip; previews and proxies are not substitutes.'
    : maxMs <= minMs
      ? 'The saved trim has no playable overlap with the available original source.'
      : !hasRange
        ? 'Mark both In and Out on the original source before attempting a shot edit.'
        : !validRange
          ? 'Select a positive-duration range entirely inside the available saved source.'
          : !outputRange
            ? 'This range crosses cuts or uses reordered, inserted, or speed-altered footage. Exact output replacement is not yet supported.'
            : null

  useEffect(() => {
    console.info('[editor:generate-mode] eligibility', {
      projectId, clipId, hasSource: Boolean(source), validRange, outputMapped: Boolean(outputRange),
      provider: 'unavailable', rangeMs: validRange && inMs !== null && outMs !== null ? outMs - inMs : null,
    })
  }, [projectId, clipId, source, validRange, outputRange, inMs, outMs])
  useEffect(() => {
    console.info('[editor:generate-mode] save-state', { projectId, clipId, state: saveState })
  }, [projectId, clipId, saveState])

  const seek = useCallback((requestedMs: number) => {
    if (!source || maxMs <= minMs) return
    const ms = Math.round(Math.max(minMs, Math.min(maxMs, requestedMs)))
    setPlayheadMs(ms)
    if (videoRef.current) videoRef.current.currentTime = Math.max(0, (ms - source.offsetMs) / 1000)
    console.info('[editor:generate-mode] seek', { projectId, clipId, sourceMs: ms })
  }, [source, minMs, maxMs, projectId, clipId])

  const mark = useCallback((edge: 'in' | 'out') => {
    if (!source) return
    const ms = Math.round(Math.max(minMs, Math.min(maxMs, playheadMs)))
    if (edge === 'in') setInMs(ms)
    else setOutMs(ms)
    console.info('[editor:generate-mode] range-mark', { projectId, clipId, edge, sourceMs: ms })
  }, [source, minMs, maxMs, playheadMs, projectId, clipId])

  const clearDraft = useCallback(() => {
    setInMs(null)
    setOutMs(null)
    setInstruction('')
    setView('original')
    console.info('[editor:generate-mode] discard-draft', { projectId, clipId })
  }, [projectId, clipId])

  const navigate = useCallback(async (href: string, destination: string) => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setNavigating(true)
    console.info('[editor:generate-mode] handoff-start', { projectId, clipId, destination })
    try {
      await flushSave()
      console.info('[editor:generate-mode] handoff-saved', { projectId, clipId, destination })
      window.location.assign(href)
    } catch {
      console.error('[editor:generate-mode] handoff-save-failed', { projectId, clipId, destination })
      toast.error('Save edits before switching editors.')
      setNavigating(false)
      inFlightRef.current = false
    }
  }, [flushSave, projectId, clipId])

  const editorHref = props.fromStudio ? routes.studio(projectId, clipId) : routes.edit(projectId, clipId)
  return (
    <ClipperSurfaceErrorBoundary surface="Change this shot">
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground" data-testid="generate-shot-editor">
        <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <Button size="sm" variant="ghost" aria-label="Back to clip editor" disabled={navigating}
            onClick={() => void navigate(editorHref, 'edit')}><ArrowLeft className="size-4" /></Button>
          <div className="mr-2 min-w-0">
            <p className="max-w-44 truncate text-[11px] text-muted-foreground">{props.projectTitle}</p>
            <h1 className="max-w-56 truncate text-sm font-semibold">Change this shot · {props.initialTitle}</h1>
          </div>
          <span className="text-xs text-muted-foreground" aria-live="polite">{saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Save failed' : 'Saving…'}</span>
          {saveState === 'error' && <Button size="sm" variant="outline" onClick={() => void flushSave().catch(() => toast.error('Save retry failed'))}>Retry save</Button>}
          <div className="ml-auto flex flex-wrap items-center gap-1">
            <Button size="sm" variant="ghost" disabled={!canUndo} aria-label="Undo" onClick={() => { undo(); console.info('[editor:generate-mode] undo', { projectId, clipId }) }}><Undo2 className="size-4" /></Button>
            <Button size="sm" variant="ghost" disabled={!canRedo} aria-label="Redo" onClick={() => { redo(); console.info('[editor:generate-mode] redo', { projectId, clipId }) }}><Redo2 className="size-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => { setExportOpen(true); console.info('[editor:generate-mode] export-open', { projectId, clipId }) }}><Download className="mr-1 size-4" />Export</Button>
            <Button size="sm" variant="ghost" disabled={navigating} onClick={() => void navigate(routes.text(projectId, clipId, props.fromStudio ? { from: 'studio' } : undefined), 'text')}>Text</Button>
            <Button size="sm" variant="ghost" disabled={navigating} onClick={() => void navigate(editorHref, 'clip')}>Clip</Button>
            <Button size="sm" variant="ghost" disabled={navigating} onClick={() => void navigate(routes.studio(projectId, clipId), 'studio')}>Studio</Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[230px_minmax(0,1fr)_255px] lg:overflow-hidden">
          <aside className="space-y-4 border-b border-border bg-card/50 p-4 lg:overflow-y-auto lg:border-b-0 lg:border-r" aria-label="Original source and range">
            <div>
              <h2 className="text-sm font-semibold">Original shot</h2>
              <p className="mt-1 text-xs text-muted-foreground">A selected range is required. Your original video is never overwritten.</p>
            </div>
            <div className="overflow-hidden rounded-lg border border-border bg-muted">
              {props.posterUrl ? <img src={props.posterUrl} alt="Original clip thumbnail" className="aspect-video w-full object-cover" /> :
                <div className="flex aspect-video items-center justify-center text-xs text-muted-foreground">No thumbnail</div>}
            </div>
            <div className="space-y-1 text-xs">
              <p>Source: <strong>{source?.kind === 'source' ? 'Original upload' : source?.kind === 'segment' ? 'Original segment' : 'Unavailable'}</strong></p>
              <p>Saved trim: {clock(edits.trim.in)} – {clock(edits.trim.out)}</p>
              <p>Selected: {validRange && inMs !== null && outMs !== null ? clock(outMs - inMs) : 'No valid range'}</p>
              <p className="text-muted-foreground">Audio: original source playback. An accepted edit must retain existing narration.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="generate-source-playhead" className="block text-xs font-medium">Source playhead · {clock(playheadMs)}</label>
              <input id="generate-source-playhead" className="w-full accent-primary" type="range" min={minMs}
                max={Math.max(minMs + 1, maxMs)} step={100} value={Math.min(maxMs, Math.max(minMs, playheadMs))}
                disabled={!source || maxMs <= minMs} onChange={(event) => seek(Number(event.target.value))} />
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" disabled={!source} onClick={() => mark('in')}>Mark In</Button>
                <Button size="sm" variant="outline" disabled={!source} onClick={() => mark('out')}>Mark Out</Button>
              </div>
              <p className="text-xs text-muted-foreground">In: {inMs === null ? 'Not set' : clock(inMs)} · Out: {outMs === null ? 'Not set' : clock(outMs)}</p>
              <Button size="sm" variant="ghost" onClick={clearDraft} disabled={!hasRange && !instruction}>Clear draft</Button>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-semibold">Reference</p>
              <p className="mt-1 text-xs text-muted-foreground">Reference attachment is unavailable until a source-video editing model with reference support is verified.</p>
            </div>
          </aside>

          <main className="flex min-h-[540px] min-w-0 flex-col lg:min-h-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <h2 className="text-sm font-semibold">Shot preview</h2>
              <div className="flex gap-1" role="tablist" aria-label="Compare original and generated result">
                <Button size="sm" variant={view === 'original' ? 'default' : 'outline'} role="tab" aria-selected={view === 'original'}
                  onClick={() => { setView('original'); console.info('[editor:generate-mode] compare-original', { projectId, clipId }) }}>Original</Button>
                <Button size="sm" variant={view === 'result' ? 'default' : 'outline'} role="tab" aria-selected={view === 'result'}
                  onClick={() => { setView('result'); console.info('[editor:generate-mode] compare-result-empty', { projectId, clipId }) }}>Result</Button>
              </div>
            </div>
            <div className="flex min-h-[260px] flex-1 items-center justify-center bg-black p-3">
              {view === 'original' && source ? (
                <div className="w-full max-w-4xl">
                  <video ref={videoRef} src={source.url} poster={props.posterUrl || undefined} preload="metadata"
                    controls playsInline className="mx-auto max-h-[51vh] w-full object-contain"
                    onLoadedMetadata={() => {
                      setMediaReady(true)
                      videoRef.current && (videoRef.current.currentTime = Math.max(0, (playheadMs - source.offsetMs) / 1000))
                      console.info('[editor:generate-mode] source-ready', { projectId, clipId })
                    }}
                    onError={() => { setMediaFailure(true); console.error('[editor:generate-mode] source-playback-failed', { projectId, clipId }) }}
                    onTimeUpdate={(event) => setPlayheadMs(Math.round(event.currentTarget.currentTime * 1000 + source.offsetMs))}
                    onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
                  {!mediaReady && !mediaFailure && <p className="mt-2 text-center text-xs text-white/75">Loading original source…</p>}
                  {mediaFailure && <p role="alert" className="mt-2 text-center text-xs text-red-300">The original video could not be loaded. No changes were made.</p>}
                </div>
              ) : <div className="max-w-md text-center text-sm text-white/75">
                {view === 'result' ? 'No generated candidate exists. The original clip remains unchanged.' : 'Original source footage is unavailable.'}
              </div>}
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 text-xs">
              <span>Source {clock(playheadMs)} · {hasRange && inMs !== null && outMs !== null ? clock(inMs) + ' – ' + clock(outMs) : 'Select an In/Out range'}</span>
              <Button size="sm" variant="outline" disabled={!source || view !== 'original'}
                onClick={() => {
                  if (!videoRef.current) return
                  if (videoRef.current.paused) void videoRef.current.play().catch(() => setMediaFailure(true))
                  else videoRef.current.pause()
                  console.info('[editor:generate-mode] playback-toggle', { projectId, clipId })
                }}>{playing ? <Pause className="mr-1 size-4" /> : <Play className="mr-1 size-4" />}{playing ? 'Pause' : 'Play'}</Button>
            </div>
            <section className="space-y-3 p-4" aria-label="Source-video edit instruction">
              <h2 className="text-sm font-semibold">Describe the change</h2>
              <textarea aria-label="Change this shot instruction" value={instruction} rows={3}
                onChange={(event) => setInstruction(event.target.value)} maxLength={20000}
                placeholder="For example: change the jacket to a blue coat while preserving motion and camera angle."
                className="w-full resize-y rounded-lg border border-input bg-background p-3 text-sm" />
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>Model: unavailable · Price: unavailable · Provider duration limits: unverified</span>
                <Button disabled title={rangeIssue || V2V_BLOCKER}><Sparkles className="mr-1 size-4" />Generate</Button>
              </div>
              <p role="status" className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{rangeIssue ? rangeIssue + ' ' : ''}{V2V_BLOCKER}</span>
              </p>
            </section>
          </main>

          <aside className="space-y-4 border-t border-border bg-card/50 p-4 lg:overflow-y-auto lg:border-l lg:border-t-0" aria-label="Generation candidates and history">
            <h2 className="text-sm font-semibold">Candidates & history</h2>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs font-semibold">Original · pinned</p>
              <p className="mt-1 text-xs text-muted-foreground">Saved footage is intact. No generated edit has been accepted.</p>
              <Button size="sm" variant="ghost" className="mt-2" onClick={() => setView('original')}>View original</Button>
            </div>
            <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">No source-video edit jobs</p>
              <p className="mt-1">No compatible provider is configured, so no task was submitted and no credits were spent.</p>
              <p className="mt-2">Results from ordinary Studio, B-roll or image generation are not candidates for this source range.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" disabled title="No verified candidate to accept">Accept</Button>
              <Button size="sm" variant="outline" disabled title="No candidate to discard">Discard</Button>
            </div>
            <p className="text-xs text-muted-foreground">Accept will remain unavailable until exact-range replacement preserves timing, audio and the existing edit history.</p>
          </aside>
        </div>
        <footer className="shrink-0 border-t border-border px-4 py-2 text-xs text-muted-foreground" aria-label="Selected shot and output timeline context">
          Shot context · Original {hasRange && inMs !== null && outMs !== null ? clock(inMs) + ' – ' + clock(outMs) : 'range not selected'}
          {' · '} Output {outputRange ? clock(outputRange.startMs) + ' – ' + clock(outputRange.endMs) : 'not safely mapped'}
          {' · '} No generated replacement or timeline mutation
        </footer>
        <ExportDialog clipId={clipId} title={props.initialTitle} edits={edits} words={words} open={exportOpen}
          onClose={() => setExportOpen(false)} onBeforeExport={flushSave} onEdits={setEdits}
          onAspectChange={(aspect) => setEdits({ ...edits, aspectRatio: aspect })} layoutMode={edits.layout.mode}
          onLayoutModeChange={(mode, facecam) => setEdits({ ...edits, layout: { ...edits.layout, mode, facecam } })}
          facecamLayout={props.facecamLayout} reframeV2Enabled={props.reframeV2Enabled}
          posterUrl={props.posterUrl} aiMeta={props.aiMeta} fullVideo={props.fullVideo} />
      </div>
    </ClipperSurfaceErrorBoundary>
  )
}
