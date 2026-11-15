'use client'

import { useEffect, useRef } from 'react'
import { Brain, CircleDot, RotateCcw, TriangleAlert, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MS_ACTIVITY_STEPS, MS_STAGES } from '@/lib/motion-studio/config'
import type { MsActivityEvent, MsProject } from '@/lib/motion-studio/types'
import { STAGE_STATUS_LABEL, StageStatusIcon } from './motion-studio-shared'

const KIND_ICON = { reasoning: Brain, action: Zap, status: CircleDot, warning: TriangleAlert } as const
const KIND_LABEL = { reasoning: 'Director', action: 'Action', status: 'Status', warning: 'Warning' } as const

/** Production Activity (ST-UI-104): live steps with counts and the director's reasoning. Not a spinner. */
export function ProductionActivity({
  project,
  events,
  onRetry,
  busy,
  compact = false,
}: {
  project: MsProject
  events: MsActivityEvent[]
  onRetry: (stage: string) => void
  busy: string | null
  compact?: boolean
}) {
  const feedRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [events.length])
  const failed = project.stages.filter((s) => s.status === 'failed')
  return (
    <div className={cn('flex min-h-0 flex-col gap-4', compact ? '' : 'h-full')} data-testid="ms-activity">
      <ol className="flex flex-col gap-1" aria-label="Production steps">
        {MS_ACTIVITY_STEPS.map((step) => {
          const st = project.activity.find((a) => a.id === step.id)
          const status = st?.status ?? 'pending'
          return (
            <li key={step.id} className={cn('flex gap-3 rounded-lg px-3 py-2.5', status === 'running' && 'bg-primary/5 ring-1 ring-inset ring-primary/20')} data-testid={`ms-step-${step.id}`} data-status={status}>
              <StageStatusIcon status={status} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{step.label}</p>
                  <span className="text-xs text-muted-foreground">{STAGE_STATUS_LABEL[status]}</span>
                </div>
                {st?.counts ? <p className="text-xs text-muted-foreground tabular-nums">{st.counts}</p> : null}
                {st?.latestAction ? <p className="mt-0.5 truncate text-xs text-foreground/80" title={st.latestAction}>{st.latestAction}</p> : null}
              </div>
            </li>
          )
        })}
      </ol>

      {failed.length ? (
        <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3" role="alert">
          {failed.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 text-sm">
              <span>
                {MS_STAGES.find((x) => x.id === s.id)?.label} failed{s.error ? `: ${s.error}` : '.'} Your project is still editable.
              </span>
              <Button size="xs" variant="outline" disabled={busy != null} onClick={() => onRetry(s.id)}>
                <RotateCcw className="size-3" aria-hidden />
                Retry step
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <section className="flex min-h-0 flex-1 flex-col gap-2" aria-labelledby="ms-reasoning-title">
        <h3 id="ms-reasoning-title" className="text-xs font-medium text-muted-foreground">Director’s reasoning</h3>
        {events.length ? (
          <ol ref={feedRef} className={cn('flex min-h-0 flex-col gap-2 overflow-y-auto pr-1', compact ? 'max-h-64' : 'flex-1')} aria-live="polite" aria-relevant="additions" data-testid="ms-reasoning">
            {events.map((e) => {
              const Icon = KIND_ICON[e.kind]
              return (
                <li key={e.id} className={cn('flex gap-2.5 rounded-lg border px-3 py-2 text-sm', e.kind === 'reasoning' ? 'border-lane-ai/30 bg-lane-ai/5' : e.kind === 'warning' ? 'border-warning/30 bg-warning/5' : 'border-border bg-card')}>
                  <Icon className={cn('mt-0.5 size-3.5 shrink-0', e.kind === 'reasoning' ? 'text-lane-ai' : 'text-muted-foreground')} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">{KIND_LABEL[e.kind]}</span> · {MS_STAGES.find((s) => s.id === e.stage)?.label} ·{' '}
                      <time dateTime={e.at} className="tabular-nums">{new Date(e.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</time>
                    </p>
                    <p className={cn('leading-relaxed', e.kind === 'reasoning' && 'italic')}>{e.text}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">Activity appears here once planning starts.</p>
        )}
      </section>
    </div>
  )
}
