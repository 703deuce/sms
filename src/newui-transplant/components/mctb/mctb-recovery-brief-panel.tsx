'use client'

import { Sparkles } from 'lucide-react'
import { OPUS_STATUS_ANCHOR, OPUS_CONFIG_INSET } from '@/newui-transplant/components/app/opus-surfaces'
import { Button } from '@/newui-transplant/components/ui/button'
import { cn } from '@/lib/utils'
import type { MctbTeamActivityBriefView } from '@/newui-transplant/components/mctb/mctb-team-activity-brief-panel'

export function MctbRecoveryBriefPanel({
  brief,
  callerFirstName,
  onCall,
  className,
}: {
  brief: MctbTeamActivityBriefView
  callerFirstName?: string | null
  onCall?: () => void
  className?: string
}) {
  const callLabel = callerFirstName ? `Call ${callerFirstName}` : 'Call customer'

  return (
    <section
      className={cn(OPUS_STATUS_ANCHOR, 'flex h-full flex-col p-0', className)}
      aria-labelledby="mctb-recovery-brief-heading"
    >
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5 md:px-5">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <Sparkles className="size-4" />
        </span>
        <h2 id="mctb-recovery-brief-heading" className="text-sm font-semibold uppercase tracking-wide text-foreground">
          Recovery brief
        </h2>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-4 py-4 md:px-5 md:py-5">
        <p className="text-pretty text-sm leading-relaxed text-foreground">{brief.summary}</p>

        {brief.bullets.length > 0 ? (
          <div className={cn(OPUS_CONFIG_INSET, 'px-4 py-3')}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Key details</p>
            <ul className="mt-2 space-y-1.5">
              {brief.bullets.map((b) => (
                <li key={b} className="flex gap-2 text-sm text-foreground">
                  <span className="text-muted-foreground" aria-hidden="true">•</span>
                  <span className="text-pretty leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-auto space-y-3 border-t border-border/60 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{brief.recommendedNextStep}</p>
          {onCall ? (
            <Button type="button" variant="default" size="sm" onClick={onCall} className="w-full sm:w-auto">
              {callLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export function MctbRecoveryBriefPlaceholder({ className }: { className?: string }) {
  return (
    <section className={cn(OPUS_STATUS_ANCHOR, 'p-5 text-sm text-muted-foreground', className)}>
      <p className="font-medium text-foreground">Recovery brief</p>
      <p className="mt-2 leading-relaxed">
        A summary will appear here after recovery text is sent or the caller replies.
      </p>
    </section>
  )
}
