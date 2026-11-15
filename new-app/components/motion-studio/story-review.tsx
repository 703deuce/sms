'use client'

import { useState } from 'react'
import { BookOpen, Check, ExternalLink, MessageSquareText, Quote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/app/page-primitives'
import type { MsProject } from '@/lib/motion-studio/types'

/**
 * Story / script review (ST-UX-061/062, ST-WF-002/003). Optional in fully automatic mode;
 * with Checkpoint, production waits here for Approve.
 */
export function StoryReview({
  project,
  busy,
  onApprove,
  onRequestChanges,
}: {
  project: MsProject
  busy: string | null
  onApprove: () => void
  onRequestChanges: (note: string) => void
}) {
  const [note, setNote] = useState('')
  const [asking, setAsking] = useState(false)
  const story = project.story
  if (!story) {
    return <EmptyState icon={BookOpen} title="The story is being developed" description="Chapters and the script appear here as soon as planning finishes." />
  }
  const awaiting = project.status === 'awaiting_review' && project.settings.productionMode === 'checkpoint' && !story.approved
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4" data-testid="ms-story">
      {awaiting ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm" role="status">
          <p className="font-medium">Checkpoint: review the story and visual plan</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Approve to start full production, or ask for changes first. You won’t be asked to approve each chapter.</p>
        </div>
      ) : story.approved ? (
        <p className="flex items-center gap-1.5 text-xs text-success"><Check className="size-3.5" aria-hidden />Story approved</p>
      ) : project.settings.productionMode === 'auto' ? (
        <p className="text-xs text-muted-foreground">Fully automatic: production doesn’t wait for review. You can still read and adjust the script here.</p>
      ) : null}
      {story.preservedUserScript ? (
        <p className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground"><Quote className="size-3.5" aria-hidden />Your script is used word for word. Nothing is rewritten unless you ask.</p>
      ) : null}

      <ol className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {story.chapters.map((ch) => (
          <li key={ch.id} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground tabular-nums">Chapter {ch.index + 1} of {story.chapters.length}</p>
            <h3 className="text-section-title">{ch.title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{ch.summary}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {ch.lines.map((l) => (
                <li key={l.id} className="text-sm leading-relaxed">
                  <p>{l.text}</p>
                  {l.sources.length ? (
                    <p className="mt-1 flex flex-wrap gap-2">
                      {l.sources.map((s) => (
                        <a key={s.url + s.title} href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 rounded text-xs text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                          <ExternalLink className="size-3" aria-hidden />
                          {s.title}
                        </a>
                      ))}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      {story.changeRequest ? <p className="text-xs text-muted-foreground">Last change request: “{story.changeRequest}”</p> : null}

      <div className="flex flex-col gap-2 border-t border-border/70 pt-3">
        {asking ? (
          <>
            <label htmlFor="ms-story-note" className="text-xs font-medium">What should change?</label>
            <Textarea id="ms-story-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Make chapter 2 shorter and open with the most surprising fact." data-testid="ms-story-note" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>Cancel</Button>
              <Button
                size="sm"
                disabled={!note.trim() || busy != null}
                onClick={() => {
                  onRequestChanges(note.trim())
                  setNote('')
                  setAsking(false)
                }}
              >
                Send request
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setAsking(true)} disabled={busy != null} data-testid="ms-story-changes">
              <MessageSquareText className="size-3.5" aria-hidden />
              Request changes
            </Button>
            {!story.approved ? (
              <Button size="sm" onClick={onApprove} disabled={busy != null} data-testid="ms-story-approve">
                <Check className="size-3.5" aria-hidden />
                {awaiting ? 'Approve and start production' : 'Approve story'}
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
