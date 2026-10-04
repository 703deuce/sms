'use client'

import { Phone, MessageSquare, CheckCircle2 } from 'lucide-react'
import { ButtonLink } from '@/newui-transplant/components/app/button-link'
import { Pill } from '@/newui-transplant/components/app/kit'
import { OPUS_CONFIG_INSET } from '@/newui-transplant/components/app/opus-surfaces'
import { cn } from '@/lib/utils'

export type MctbHandoffSummaryView = {
  callerName: string
  statusLine: string
  phone: string
  phoneTel: string
  narrative: string
  facts: Array<{ label: string; value: string }>
  suggestedAction: string
  needsAttention?: boolean
}

function parseFactsFromBullets(bullets: string[]): Array<{ label: string; value: string }> {
  const facts: Array<{ label: string; value: string }> = []
  for (const raw of bullets) {
    const b = raw.trim()
    if (!b) continue
    const colon = b.indexOf(':')
    if (colon > 0 && colon < 40) {
      facts.push({
        label: b.slice(0, colon).trim(),
        value: b.slice(colon + 1).trim(),
      })
    } else {
      facts.push({ label: 'Note', value: b })
    }
    if (facts.length >= 6) break
  }
  return facts
}

export function buildHandoffSummaryView(input: {
  caller: string
  phone: string
  phoneTel: string
  recoveryLabel: string
  headline: string
  summary: string
  bullets: string[]
  recommendedNextStep: string
}): MctbHandoffSummaryView {
  const needsAttention =
    input.recoveryLabel === 'Needs attention' ||
    input.headline.toLowerCase().includes('callback') ||
    input.recommendedNextStep.toLowerCase().includes('call')

  let statusLine = input.headline
  if (statusLine.length > 72) {
    statusLine = needsAttention ? 'Callback requested · Needs attention' : 'Follow-up needed'
  }

  const facts = parseFactsFromBullets(input.bullets)

  return {
    callerName: input.caller,
    statusLine,
    phone: input.phone,
    phoneTel: input.phoneTel,
    narrative: input.summary,
    facts,
    suggestedAction: input.recommendedNextStep,
    needsAttention,
  }
}

export function MctbHandoffSummaryPanel({
  handoff,
  conversationHref,
  className,
}: {
  handoff: MctbHandoffSummaryView
  conversationHref?: string
  className?: string
}) {
  return (
    <section
      className={cn(OPUS_CONFIG_INSET, 'space-y-4 p-4 md:p-5', className)}
      aria-labelledby="mctb-handoff-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="mctb-handoff-heading" className="text-lg font-semibold text-foreground">
            {handoff.callerName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {handoff.statusLine}
            {handoff.needsAttention ? (
              <Pill tone="warning" className="ml-2 inline-flex align-middle">
                Needs attention
              </Pill>
            ) : null}
          </p>
          <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">{handoff.phone}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`tel:${handoff.phoneTel}`} variant="outline">
            <Phone className="size-3.5" aria-hidden="true" />
            Call
          </ButtonLink>
          {conversationHref ? (
            <ButtonLink href={conversationHref}>
              <MessageSquare className="size-3.5" aria-hidden="true" />
              Text
            </ButtonLink>
          ) : null}
        </div>
      </div>

      <p className="text-pretty text-sm leading-relaxed text-foreground">{handoff.narrative}</p>

      {handoff.facts.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What we know</p>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            {handoff.facts.map((f) => (
              <div key={`${f.label}-${f.value}`} className="rounded-lg border bg-background/60 px-3 py-2">
                <dt className="text-xs text-muted-foreground">{f.label}</dt>
                <dd className="text-sm font-medium text-foreground">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3.5 py-3">
        <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm text-foreground">
          <span className="font-medium">Suggested next step: </span>
          {handoff.suggestedAction}
        </p>
      </div>
    </section>
  )
}
