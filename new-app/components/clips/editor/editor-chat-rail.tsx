'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, Eye, EyeOff, Loader2, RotateCcw, Sparkles, Undo2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProducerPanel } from '@/components/clips/producer/producer-panel'
import { ProducerPlanList } from '@/components/clips/editor/producer-plan-list'
import { FindClipsInVideoButton } from '@/components/clips/editor/find-clips-in-video-button'
import { HighlightsListPanel } from '@/components/clips/editor/highlights-list-panel'
import { SpeechSearchSection } from '@/components/clips/editor/speech-search-section'
import { MediaThumb } from '@/components/clips/editor/media-panel'
import { MEDIA_ACCEPT, type ProjectMediaApi } from '@/components/clips/editor/use-project-media'
import { useFullVideoHighlights } from '@/components/clips/editor/use-full-video-highlights'
import { appliedProducerSummaries } from '@/lib/clips/producer-honesty'
import { canonicalEditsJson, type ClipBounds, type ClipEditsV2 } from '@/lib/clips/edits'
import { formatToolCost, producerToolCost } from '@/lib/clips/producer-cost'
import type { ProducerToolCall } from '@/lib/clips/edits-reducer'

export type EditorChatScope =
  | { kind: 'whole' }
  | { kind: 'range' | 'scene'; startMs: number; endMs: number; label: string }

type Proposal = { edits: ClipEditsV2; before: ClipEditsV2; changeCount: number; summaries: string[] }

function time(ms: number) {
  const seconds = Math.floor(Math.max(0, ms) / 1000)
  return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0')
}

/** Session-local shell for the existing Producer API. No new agent or edit storage. */
export function EditorChatRail({
  open, clipTitle, clipId, projectId, bounds, edits, saveState, scope, canUndo, fullVideo, playheadSourceMs, projectMedia,
  onClose, onUseSelection, onUseScene, onClearScope, onSeek, onAudition,
  onBeforeSend, onAccept, onUndo, onRetrySave, onPendingPaidChange,
}: {
  open: boolean
  clipTitle: string
  clipId: string
  projectId: string
  bounds: ClipBounds
  edits: ClipEditsV2
  saveState: string
  scope: EditorChatScope
  canUndo: boolean
  fullVideo: boolean
  playheadSourceMs: number
  projectMedia: ProjectMediaApi
  onClose: () => void
  onUseSelection: () => void
  onUseScene: () => void
  onClearScope: () => void
  onSeek: (ms: number) => void
  onAudition: (edits: ClipEditsV2 | null) => void
  onBeforeSend: (promptLength: number) => Promise<void>
  onAccept: (next: ClipEditsV2, before: ClipEditsV2, count: number) => Promise<void>
  onUndo: () => void
  onRetrySave: () => Promise<void>
  onPendingPaidChange?: (count: number) => void
}) {
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [planTools, setPlanTools] = useState<ProducerToolCall[]>([])
  const [attachedMediaId, setAttachedMediaId] = useState<string | null>(null)
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const attachedMedia = projectMedia.items.find((item) => item.id === attachedMediaId) ?? null
  const highlights = useFullVideoHighlights(projectId, fullVideo, [])
  const [previewing, setPreviewing] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const acceptingRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [acceptedHash, setAcceptedHash] = useState<string | null>(null)
  const [savedResult, setSavedResult] = useState(false)
  const editsRef = useRef(edits)
  editsRef.current = edits
  const stale = Boolean(proposal && canonicalEditsJson(proposal.before) !== canonicalEditsJson(edits))
  const changedFields = useMemo(() => {
    if (!proposal) return []
    const before = proposal.before as unknown as Record<string, unknown>
    const after = proposal.edits as unknown as Record<string, unknown>
    return Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
  }, [proposal])
  useEffect(() => {
    if (!open && previewing) {
      setPreviewing(false)
      onAudition(null)
    }
  }, [open, previewing, onAudition])
  useEffect(() => {
    if (stale && previewing) {
      setPreviewing(false)
      onAudition(null)
      console.info('[editor:chat-mode] proposal-stale', { projectId, clipId })
    }
  }, [stale, previewing, onAudition, projectId, clipId])
  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButtonRef.current?.focus()
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])
  useEffect(() => {
    if (!acceptedHash || canonicalEditsJson(edits) !== acceptedHash) return
    if (saveState === 'saved') {
      setSavedResult(true)
      console.info('[editor:chat-mode] accepted-save-complete', { projectId, clipId })
    } else if (saveState === 'error') {
      setError('The edit is local, but autosave failed. Retry saving before leaving.')
      console.error('[editor:chat-mode] accepted-save-failed', { projectId, clipId })
    }
  }, [acceptedHash, edits, saveState, projectId, clipId])

  const discard = () => {
    setProposal(null)
    setPreviewing(false)
    onAudition(null)
    setError(null)
    console.info('[editor:chat-mode] proposal-discarded', { projectId, clipId })
  }
  const accept = async () => {
    if (!proposal || stale || acceptingRef.current || scope.kind !== 'whole') return
    acceptingRef.current = true
    setAccepting(true)
    setError(null)
    setPreviewing(false)
    onAudition(null)
    console.info('[editor:chat-mode] confirm-start', { projectId, clipId, changeCount: proposal.changeCount })
    try {
      await onAccept(proposal.edits, proposal.before, proposal.changeCount)
      setAcceptedHash(canonicalEditsJson(proposal.edits))
      setSavedResult(false)
      setProposal(null)
      console.info('[editor:chat-mode] confirm-local-applied', { projectId, clipId, changeCount: proposal.changeCount })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not accept this proposal'
      setError(message)
      console.error('[editor:chat-mode] confirm-failed', { projectId, clipId, errorType: cause instanceof Error ? cause.name : 'unknown' })
    } finally {
      acceptingRef.current = false
      setAccepting(false)
    }
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-border bg-card" aria-label="Edit with AI" data-testid="editor-chat-rail">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3">
        <Sparkles className="size-4 text-primary" aria-hidden />
        <h2 className="min-w-0 flex-1 text-sm font-semibold">Edit with AI</h2>
        <Button ref={closeButtonRef} variant="ghost" size="icon" aria-label="Close Edit with AI" onClick={() => {
          console.info('[editor:chat-mode] close', { projectId, clipId })
          onClose()
        }}><X className="size-4" /></Button>
      </div>
      <div className="shrink-0 space-y-2 border-b border-border p-3 text-xs">
        <p className="truncate text-muted-foreground">Active clip · <span className="font-medium text-foreground">{clipTitle}</span></p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={onClearScope} className={'rounded-full border px-2.5 py-1 ' + (scope.kind === 'whole' ? 'border-primary bg-primary/10' : 'border-border')}>Whole clip</button>
          <Button size="xs" variant="outline" onClick={onUseSelection}>Use transcript selection</Button>
          <Button size="xs" variant="outline" onClick={onUseScene}>Use current scene</Button>
          {scope.kind !== 'whole' ? <Button size="xs" variant="ghost" onClick={onClearScope}>Clear</Button> : null}
        </div>
        {scope.kind !== 'whole' && (
          <button type="button" className="w-full rounded-md border border-border px-2 py-1.5 text-left" onClick={() => onSeek(scope.startMs)}>
            {scope.label} · {time(scope.startMs)}–{time(scope.endMs)} · Seek
          </button>
        )}
        <p className="text-[11px] text-muted-foreground">
          {scope.kind === 'whole'
            ? 'Producer commands affect the whole clip. Review changes before accepting.'
            : 'Selection is for navigation only: this Producer API cannot enforce a selected range. Choose Whole clip to enable prompts.'}
        </p>
        <p className="text-[11px] text-muted-foreground">Chat proposals are session-only. Reload discards unaccepted proposals; accepted edits use the normal editor save and Undo history.</p>
        <details className="rounded-md border border-border p-2">
          <summary className="cursor-pointer font-medium">Reference media</summary>
          <div className="mt-2 space-y-2">
            <p className="text-[11px] text-muted-foreground">Uploads use the existing project media library. The current Producer request does not receive media attachments, so this is reference media only.</p>
            <div className="flex flex-wrap gap-1.5">
              <Button size="xs" variant="outline" onClick={() => mediaInputRef.current?.click()}><Upload className="mr-1 size-3" />Upload media</Button>
              <select className="h-7 min-w-0 flex-1 rounded border border-input bg-background px-2 text-[11px]" value={attachedMediaId ?? ''} onChange={(event) => {
                const id = event.target.value || null
                setAttachedMediaId(id)
                console.info('[editor:chat-mode] media-reference', { projectId, clipId, mediaId: id })
              }}>
                <option value="">No reference media</option>
                {projectMedia.items.filter((item) => !item.isMain).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <input ref={mediaInputRef} type="file" accept={MEDIA_ACCEPT} className="hidden" onChange={(event) => {
                const files = event.target.files ? [...event.target.files] : []
                event.target.value = ''
                if (!files.length) return
                console.info('[editor:chat-mode] media-upload-start', { projectId, clipId, count: files.length })
                void projectMedia.uploadFiles(files).then((created) => {
                  if (created[0]) setAttachedMediaId(created[0].id)
                  console.info('[editor:chat-mode] media-upload-complete', { projectId, clipId, count: created.length })
                })
              }} />
            </div>
            {attachedMedia ? <div className="flex items-center gap-2 rounded-md bg-muted/30 p-1.5"><MediaThumb item={attachedMedia} className="h-9 w-12" /><span className="min-w-0 flex-1 truncate">{attachedMedia.label}</span><Button size="xs" variant="ghost" onClick={() => setAttachedMediaId(null)}>Clear</Button></div> : null}
            {projectMedia.uploads.map((upload) => <p key={upload.key} className="text-[11px] text-muted-foreground">{upload.filename} · {upload.state === 'error' ? 'Failed' : upload.state === 'finalizing' ? 'Finishing…' : upload.percent + '%'}</p>)}
            {projectMedia.error ? <p className="text-[11px] text-destructive">{projectMedia.error}</p> : null}
          </div>
        </details>
        {fullVideo ? <details className="rounded-md border border-border p-2">
          <summary className="cursor-pointer font-medium">Find moments</summary>
          <div className="mt-2 space-y-2">
            <p className="text-[11px] text-muted-foreground">Transcript search narrows spoken moments. Find Clips itself still uses its existing whole-video job and does not accept a prompt or clip-length bound.</p>
            <SpeechSearchSection
              projectId={projectId}
              edits={edits}
              media={projectMedia}
              playheadSourceMs={playheadSourceMs}
              onSeekSource={(ms) => {
                onSeek(ms)
                console.info('[editor:chat-mode] speech-result-seek', { projectId, clipId, startMs: ms })
              }}
              readOnly
              mainOnly
              heading="Find spoken moments"
              placeholder="Include specific spoken moments…"
            />
            <FindClipsInVideoButton
              projectId={projectId}
              durationMs={Math.max(0, bounds.clipEndMs - bounds.clipStartMs)}
              highlightsOnly
              onStarted={() => {
                highlights.startedFind()
                console.info('[editor:chat-mode] find-clips-started', { projectId, clipId })
              }}
            />
            {highlights.status ? <p className="text-[11px] text-muted-foreground">Find status: {highlights.status}{typeof highlights.progress === 'number' ? ` · ${Math.round(highlights.progress)}%` : ''}</p> : null}
            {(highlights.hasPicks || highlights.isJobRunning) ? <HighlightsListPanel
              picks={highlights.picks}
              ranges={highlights.ranges}
              selectedClipId={highlights.selectedClipId}
              onSelect={(resultClipId) => {
                highlights.setSelectedClipId(resultClipId)
                const range = highlights.ranges.find((item) => item.pick.clipId === resultClipId)
                if (range) onSeek(range.startMs)
                console.info('[editor:chat-mode] find-result-selected', { projectId, clipId, resultClipId, startMs: range?.startMs ?? null, endMs: range?.endMs ?? null })
              }}
              jobRunning={highlights.isJobRunning}
              readOnly
              defaultOpen
            /> : null}
          </div>
        </details> : null}
      </div>
      {planTools.length ? <ProducerPlanList tools={planTools} readOnly /> : null}
      {proposal && (
        <div className="shrink-0 space-y-2 border-b border-border bg-muted/20 px-3 py-3 text-xs" data-testid="chat-proposal">
          <div className="font-semibold">{proposal.changeCount} proposed change{proposal.changeCount === 1 ? '' : 's'} · Whole clip</div>
          <p className="text-muted-foreground">Changed fields: {changedFields.join(', ') || 'none'}</p>
          {changedFields.includes('trim') && <p>Trim: {time(proposal.edits.trim.in)}–{time(proposal.edits.trim.out)}</p>}
          {changedFields.includes('cutRanges') && <div>
            <p>Cut ranges: {proposal.edits.cutRanges.length} proposed</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {proposal.edits.cutRanges.slice(0, 5).map((range, index) => <button type="button" key={index} className="rounded border border-border px-1.5 py-0.5 text-[11px]" onClick={() => onSeek(range[0])}>{time(range[0])}–{time(range[1])}</button>)}
            </div>
          </div>}
          {!!proposal.summaries.length && <details><summary className="cursor-pointer">Tool summary ({proposal.summaries.length})</summary><ul className="list-inside list-disc space-y-1 pt-1">{proposal.summaries.map((s, i) => <li key={i}>{s}</li>)}</ul></details>}
          {stale && <p className="flex items-center gap-1 text-destructive"><AlertTriangle className="size-3.5" />The edit changed since planning. Discard and replan; do not overwrite.</p>}
          <div className="flex flex-wrap gap-1.5">
            <Button size="xs" variant="outline" disabled={stale || accepting} onClick={() => {
              const next = !previewing
              setPreviewing(next)
              onAudition(next ? proposal.edits : null)
              console.info('[editor:chat-mode] preview', { projectId, clipId, enabled: next })
            }}>{previewing ? <EyeOff className="mr-1 size-3" /> : <Eye className="mr-1 size-3" />}{previewing ? 'Stop preview' : 'Preview'}</Button>
            <Button size="xs" disabled={stale || accepting || scope.kind !== 'whole'} onClick={() => void accept()}>
              {accepting ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Check className="mr-1 size-3" />}Accept
            </Button>
            <Button size="xs" variant="ghost" disabled={accepting} onClick={discard}>Discard</Button>
          </div>
        </div>
      )}
      {acceptedHash && (
        <div className="shrink-0 space-y-1 border-b border-border px-3 py-2 text-xs" role="status">
          <p>{savedResult ? 'Accepted and saved in shared edits.' : 'Accepted locally; checking autosave…'}</p>
          {canUndo && <Button size="xs" variant="outline" onClick={() => {
            console.info('[editor:chat-mode] undo', { projectId, clipId })
            onUndo()
            setAcceptedHash(null)
          }}><Undo2 className="mr-1 size-3" />Undo accepted edit</Button>}
        </div>
      )}
      {error && <div className="shrink-0 border-b border-destructive/30 px-3 py-2 text-xs text-destructive" role="alert">
        {error}
        {saveState === 'error' && <Button size="xs" variant="outline" className="ml-2" onClick={() => void onRetrySave().catch(() => setError('Save retry failed'))}><RotateCcw className="mr-1 size-3" />Retry save</Button>}
      </div>}
      <div className="min-h-0 flex-1" aria-label="Producer conversation">
        <ProducerPanel
          clipId={clipId}
          bounds={bounds}
          edits={edits}
          dryRun
          onApplyEdits={() => { /* Dry-run uses onProposal; never mutate from a message. */ }}
          onUndo={onUndo}
          onPendingPaidChange={onPendingPaidChange}
          includeDryRunPlan
          onPlan={(tools) => {
            setPlanTools(tools)
            console.info('[editor:chat-mode] plan-received', { projectId, clipId, toolCount: tools.length })
          }}
          onProposal={(next, changeCount, before, summaries) => {
            console.info('[editor:chat-mode] dry-run-result', { projectId, clipId, changeCount, scope: 'whole' })
            if (changeCount <= 0 || canonicalEditsJson(next) === canonicalEditsJson(before)) return
            setProposal({ edits: next, before, changeCount, summaries: appliedProducerSummaries(summaries) })
            setAcceptedHash(null)
            setPreviewing(false)
            onAudition(null)
          }}
          onBeforeSend={async (promptLength) => {
            if (scope.kind !== 'whole') throw new Error('Selected-range editing is not supported. Choose Whole clip.')
            setPlanTools([])
            setProposal(null)
            setPreviewing(false)
            onAudition(null)
            console.info('[editor:chat-mode] prompt-start', { projectId, clipId, promptLength, scope: 'whole', referenceMediaCount: attachedMedia ? 1 : 0 })
            await onBeforeSend(promptLength)
            console.info('[editor:chat-mode] dry-run-request', { projectId, clipId })
          }}
          sendDisabledReason={scope.kind !== 'whole' ? 'Choose Whole clip to send. Range-scoped Producer edits are not supported.' : undefined}
          costLabel={(tool) => formatToolCost(producerToolCost(tool, edits.trim.out - edits.trim.in))}
        />
      </div>
    </aside>
  )
}
