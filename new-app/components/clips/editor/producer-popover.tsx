'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Eye, EyeOff, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProducerPanel } from '@/components/clips/producer/producer-panel'
import type { ClipBounds, ClipEditsV2 } from '@/lib/clips/edits'
import { formatToolCost, producerToolCost } from '@/lib/clips/producer-cost'
import { appliedProducerSummaries } from '@/lib/clips/producer-honesty'

export type ProducerProposal = { edits: ClipEditsV2; changeCount: number; before: ClipEditsV2; summaries: string[] }

/**
 * E4: the existing AI Producer chat (components/clips/producer/producer-panel.tsx, unchanged
 * behaviour) as a small ✨ pop-over under the top bar. Requests run with dryRun so nothing is saved
 * until Accept; Preview plays the proposal through PreviewStage `audition`; Accept is ONE undo step
 * (applyProducerPatch) and lights the existing top-bar undo strip. Paid tools show credits (never $)
 * before Generate (the existing confirm route creates the job).
 */
export function ProducerPopover({
  open,
  onClose,
  clipId,
  bounds,
  edits,
  durationMs,
  onAudition,
  onAccept,
  onUndo,
  onPendingPaidChange,
}: {
  open: boolean
  onClose: () => void
  clipId: string
  bounds: ClipBounds
  edits: ClipEditsV2
  durationMs: number
  onAudition: (edits: ClipEditsV2 | null) => void
  onAccept: (edits: ClipEditsV2, before: ClipEditsV2, changeCount: number) => void
  onUndo: () => void
  onPendingPaidChange?: (n: number) => void
}) {
  const [proposal, setProposal] = useState<ProducerProposal | null>(null)
  const [previewing, setPreviewing] = useState(false)

  const discard = useCallback(() => {
    setProposal(null)
    setPreviewing(false)
    onAudition(null)
  }, [onAudition])

  // A proposal is against the edits it was made from; any other edit makes it stale.
  useEffect(() => {
    if (proposal && proposal.before !== edits) discard()
  }, [discard, edits, proposal])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose, open])

  // Closing stops any audition (the proposal stays until Accept / Discard).
  useEffect(() => {
    if (!open && previewing) {
      setPreviewing(false)
      onAudition(null)
    }
  }, [onAudition, open, previewing])

  const costLabel = useCallback(
    (tool: { name: string; args: Record<string, unknown> }) => formatToolCost(producerToolCost(tool, durationMs)),
    [durationMs],
  )

  return (
    <div
      id="editor-panel-producer"
      role="dialog"
      aria-label="AI Producer"
      hidden={!open}
      className="fixed right-3 top-14 z-50 flex max-h-[min(640px,calc(100vh-5rem))] w-[420px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
      data-testid="producer-popover"
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="size-4 text-lane-ai" aria-hidden />
          AI Producer
        </p>
        <Button size="icon-sm" variant="ghost" aria-label="Close" onClick={onClose} data-testid="producer-popover-close">
          <X className="size-4" />
        </Button>
      </div>
      {proposal ? (
        <div className="space-y-2 border-b bg-primary/5 px-3 py-2 text-xs" data-testid="producer-proposal">
          <p className="font-medium">
            {proposal.changeCount} proposed change{proposal.changeCount === 1 ? '' : 's'}
            {proposal.summaries.length ? ` · ${proposal.summaries.slice(0, 3).join(' · ')}` : ''}
          </p>
          <div className="flex gap-2">
            <Button
              size="xs"
              variant="outline"
              className="gap-1"
              data-testid="producer-preview"
              onClick={() => {
                const next = !previewing
                setPreviewing(next)
                onAudition(next ? proposal.edits : null)
              }}
            >
              {previewing ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
              {previewing ? 'Stop preview' : 'Preview'}
            </Button>
            <Button
              size="xs"
              className="gap-1"
              data-testid="producer-accept"
              onClick={() => {
                onAudition(null)
                onAccept(proposal.edits, proposal.before, proposal.changeCount)
                setProposal(null)
                setPreviewing(false)
              }}
            >
              <Check className="size-3" />
              Accept
            </Button>
            <Button size="xs" variant="ghost" data-testid="producer-discard" onClick={discard}>
              Discard
            </Button>
          </div>
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <ProducerPanel
          clipId={clipId}
          bounds={bounds}
          edits={edits}
          dryRun
          onApplyEdits={(e, n, before) => onAccept(e, before, n)}
          onUndo={onUndo}
          onProposal={(e, n, before, summaries) => {
            if (n <= 0) return
            setProposal({ edits: e, changeCount: n, before, summaries: appliedProducerSummaries(summaries) })
            setPreviewing(false)
            onAudition(null)
          }}
          costLabel={costLabel}
          onPendingPaidChange={onPendingPaidChange}
        />
      </div>
    </div>
  )
}
