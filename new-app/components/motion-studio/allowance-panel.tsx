'use client'

import { CheckCircle2, Coins, ExternalLink } from 'lucide-react'
import { formatMsCredits } from '@/lib/motion-studio/format'
import type { MsAllowance } from '@/lib/motion-studio/types'

/** Estimated allowance before the full render (ST-UX-128 / ST-CRD-002). Credits and minutes only. */
export function AllowancePanel({ allowance }: { allowance: MsAllowance | null }) {
  if (!allowance) return null
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs" aria-labelledby="ms-allowance-title" data-testid="ms-allowance">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Coins className="size-4 text-muted-foreground" aria-hidden />
          <h3 id="ms-allowance-title" className="text-sm font-semibold">Estimated allowance</h3>
        </div>
        <p className="text-sm font-medium tabular-nums">
          {formatMsCredits(allowance.estimateCredits)} · {allowance.minutes} min
        </p>
      </header>
      <ul className="flex flex-col gap-1.5">
        {allowance.items.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              {i.thirdParty ? <ExternalLink className="size-3.5 shrink-0 text-warning" aria-hidden /> : <CheckCircle2 className="size-3.5 shrink-0 text-success" aria-hidden />}
              <span className="truncate">{i.label}</span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {i.included ? 'Included' : i.thirdParty ? `Third-party · ${formatMsCredits(i.credits)}` : formatMsCredits(i.credits)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">Routine code-rendered revisions are included. Nothing paid runs until you start production.</p>
    </section>
  )
}
