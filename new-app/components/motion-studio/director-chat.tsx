'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Check, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { MS_LABELS } from '@/lib/motion-studio/config'
import type { MsProject, MsScene } from '@/lib/motion-studio/types'

/** AI Director (concept §3/§7): conversational intent → "Proposed changes" that apply only when accepted. */
export function DirectorChat({
  project,
  scene,
  busy,
  onSend,
  onDecide,
}: {
  project: MsProject
  scene: MsScene | null
  busy: string | null
  onSend: (text: string, sceneId: string | null) => void
  onDecide: (proposalId: string, itemIds: string[] | 'all', decision: 'accept' | 'reject') => void
}) {
  const [text, setText] = useState('')
  const [scoped, setScoped] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [project.director.length, project.proposals])
  const send = () => {
    const t = text.trim()
    if (!t || busy != null) return
    onSend(t, scoped && scene ? scene.id : null)
    setText('')
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2" data-testid="ms-director">
      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1" aria-live="polite">
        {!project.director.length ? (
          <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            Tell the director what to change in plain words. You’ll see the proposed changes before anything is applied.
          </p>
        ) : null}
        {project.director.map((m) => {
          const proposal = m.proposalId ? project.proposals.find((p) => p.id === m.proposalId) : null
          const body = (m.text ?? '').trim()
          if (!body && !proposal) return null
          const single = proposal ? proposal.items.length === 1 : false
          return (
            <div key={m.id} className={cn('flex flex-col gap-1.5', m.role === 'user' ? 'items-end' : 'items-start')}>
              {body ? (
                <p className={cn('max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed', m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>{body}</p>
              ) : null}
              {proposal ? (
                <div className="w-full rounded-xl border border-border bg-card p-3" data-testid="ms-proposal">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold"><Sparkles className="size-3.5 text-lane-ai" aria-hidden />{MS_LABELS.proposedChanges}</p>
                    {!single && proposal.items.some((i) => i.status === 'pending') ? (
                      <div className="flex gap-1">
                        <Button size="xs" variant="ghost" disabled={busy != null} onClick={() => onDecide(proposal.id, 'all', 'reject')}>Reject all</Button>
                        <Button size="xs" disabled={busy != null} onClick={() => onDecide(proposal.id, 'all', 'accept')} data-testid="ms-proposal-accept-all">Accept all</Button>
                      </div>
                    ) : null}
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {proposal.items.map((i) => (
                      <li key={i.id} className="flex items-start gap-2 text-sm">
                        <span className={cn('min-w-0 flex-1 leading-snug', i.status === 'rejected' && 'text-muted-foreground line-through')}>{i.text}</span>
                        {i.status === 'pending' && single ? (
                          <span className="flex shrink-0 gap-1">
                            <Button size="xs" variant="ghost" disabled={busy != null} onClick={() => onDecide(proposal.id, [i.id], 'reject')} data-testid="ms-proposal-reject">Reject</Button>
                            <Button size="xs" disabled={busy != null} onClick={() => onDecide(proposal.id, [i.id], 'accept')} data-testid="ms-proposal-accept">
                              <Check className="size-3" aria-hidden />
                              Accept
                            </Button>
                          </span>
                        ) : i.status === 'pending' ? (
                          <span className="flex shrink-0 gap-1">
                            <Button size="icon-xs" variant="outline" aria-label={`Reject: ${i.text}`} disabled={busy != null} onClick={() => onDecide(proposal.id, [i.id], 'reject')}><X /></Button>
                            <Button size="icon-xs" aria-label={`Accept: ${i.text}`} disabled={busy != null} onClick={() => onDecide(proposal.id, [i.id], 'accept')}><Check /></Button>
                          </span>
                        ) : (
                          <span className={cn('shrink-0 text-xs', i.status === 'accepted' ? 'text-success' : 'text-muted-foreground')}>{i.status === 'accepted' ? 'Applied' : 'Rejected'}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      <div className="rounded-xl border border-border bg-card transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
        <label htmlFor="ms-director-input" className="sr-only">Message the AI Director</label>
        <Textarea
          id="ms-director-input"
          data-testid="ms-director-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={MS_LABELS.directorPlaceholder}
          rows={2}
          className="min-h-14 resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          {scene ? (
            <label className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={scoped} onChange={(e) => setScoped(e.target.checked)} className="accent-[var(--primary)]" />
              <span className="truncate">Only scene {scene.index + 1}</span>
            </label>
          ) : <span />}
          <Button size="icon-sm" aria-label="Send to AI Director" disabled={!text.trim() || busy != null} onClick={send} data-testid="ms-director-send">
            <ArrowUp className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
