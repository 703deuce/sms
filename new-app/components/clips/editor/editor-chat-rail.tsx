'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, Eye, EyeOff, Loader2, RotateCcw, Sparkles, Undo2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProducerPanel } from '@/components/clips/producer/producer-panel'
import { appliedProducerSummaries } from '@/lib/clips/producer-honesty'
import { canonicalEditsJson, type ClipBounds, type ClipEditsV2 } from '@/lib/clips/edits'
import { formatToolCost, producerToolCost } from '@/lib/clips/producer-cost'

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
  open, clipId, projectId, bounds, edits, saveState, scope, canUndo,
  onClose, onUseSelection, onUseScene, onClearScope, onSeek, onAudition,
  onBeforeSend, onAccept, onUndo, onRetrySave,
}: {
  open: boolean
  clipId: string
  projectId: string
  bounds: ClipBounds
  edits: ClipEditsV2
  saveState: string
  scope: EditorChatScope
  canUndo: boolean
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
}) {
  const [proposal, setProposal] = useState<Proposal | null>(null)
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
        <Button variant="ghost" size="icon" aria-label="Close Edit with AI" onClick={() => {
          console.info('[editor:chat-mode] close', { projectId, clipId })
          onClose()
        }}><X className="size-4" /></Button>
      </div>
      <div className="shrink-0 space-y-2 border-b border-border p-3 text-xs">
        <p className="truncate text-muted-foreground">Active clip: <span className="font-mono text-foreground">{clipId}</span></p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={onClearScope} className={'rounded-full border px-2.5 py-1 ' + (scope.kind === 'whole' ? 'border-primary bg-primary/10' : 'border-border')}>Whole clip</button>
          <Button size="xs" variant="outline" onClick={onUseSelection}>Use transcript selection</Button>
          <Button size="xs" variant="outline" onClick={onUseScene}>Use current scene</Button>
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
      </div>
      {proposal && (
        <div className="shrink-0 space-y-2 border-b border-border bg-muted/20 px-3 py-3 text-xs" data-testid="chat-proposal">
          <div className="font-semibold">{proposal.changeCount} proposed change{proposal.changeCount === 1 ? '' : 's'} · Whole clip</div>
          <p className="text-muted-foreground">Changed fields: {changedFields.join(', ') || 'none'}</p>
          {changedFields.includes('trim') && <p>Trim: {time(proposal.edits.trim.in)}–{time(proposal.edits.trim.out)}</p>}
          {changedFields.includes('cutRanges') && <p>Cut ranges: {proposal.edits.cutRanges.length} proposed</p>}
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
            console.info('[editor:chat-mode] prompt-start', { projectId, clipId, promptLength, scope: 'whole' })
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
