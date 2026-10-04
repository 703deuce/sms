'use client'

import { ArrowRight, MessageSquareText, Mic, Sparkles } from 'lucide-react'
import { OPUS_CONFIG_INSET, OPUS_STATUS_ANCHOR } from '@/newui-transplant/components/app/opus-surfaces'
import { cn } from '@/lib/utils'

export type MctbTeamActivityBriefView = {
  headline: string
  summary: string
  bullets: string[]
  recommendedNextStep: string
  hasVoicemail?: boolean
  hasTextReplies?: boolean
}

export function MctbTeamActivityBriefPanel({
  brief,
  className,
}: {
  brief: MctbTeamActivityBriefView
  className?: string
}) {
  const signals = [
    brief.hasVoicemail ? { label: 'Voicemail', icon: Mic } : null,
    brief.hasTextReplies ? { label: 'Text replies', icon: MessageSquareText } : null,
  ].filter(Boolean) as { label: string; icon: typeof Mic }[]

  return (
    <section
      className={cn(OPUS_STATUS_ANCHOR, 'flex-col items-stretch gap-4 p-0', className)}
      aria-labelledby="mctb-team-brief-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3.5 md:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Team activity brief
            </p>
            <h2 id="mctb-team-brief-heading" className="mt-0.5 text-base font-semibold text-balance text-foreground">
              {brief.headline}
            </h2>
          </div>
        </div>
        {signals.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Sources included">
            {signals.map((s) => (
              <li
                key={s.label}
                className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                <s.icon className="size-3.5 shrink-0" aria-hidden="true" />
                {s.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="space-y-4 px-4 pb-4 md:px-5 md:pb-5">
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{brief.summary}</p>

        {brief.bullets.length > 0 ? (
          <div className={cn(OPUS_CONFIG_INSET, 'px-4 py-3')}>
            <p className="text-xs font-medium text-muted-foreground">Key points</p>
            <ul className="mt-2 space-y-2">
              {brief.bullets.map((b) => (
                <li key={b} className="flex gap-2 text-sm text-foreground">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden="true" />
                  <span className="text-pretty leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3.5 py-3">
          <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm text-foreground">
            <span className="font-medium">Suggested next step: </span>
            <span className="text-muted-foreground">{brief.recommendedNextStep}</span>
          </p>
        </div>
      </div>
    </section>
  )
}
