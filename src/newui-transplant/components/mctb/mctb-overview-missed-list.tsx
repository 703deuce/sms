'use client'

import Link from 'next/link'
import { Initials, Pill } from '@/newui-transplant/components/app/kit'
import type { MctbOverviewPayload } from '@/lib/mctb/overview-types'
import { formatMctbPhoneLabel } from '@/lib/mctb/phone-display'
import { cn } from '@/lib/utils'

function statusTone(chip: string): 'warning' | 'success' | 'neutral' {
  if (chip.toLowerCase().includes('need')) return 'warning'
  if (chip.toLowerCase().includes('recover') || chip.toLowerCase().includes('replied')) return 'success'
  return 'neutral'
}

export function MctbOverviewMissedList({
  rows,
}: {
  rows: MctbOverviewPayload['recentMissedCalls']
}) {
  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/mctb/missed-calls/${row.id}`}
            className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-muted/40"
          >
            <Initials name={row.callerLabel} className="size-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold text-foreground">{row.callerLabel}</span>
                <Pill tone={statusTone(row.statusChip)} className="h-auto py-0.5 text-[11px]">
                  {row.statusChip}
                </Pill>
              </div>
              <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{row.subtitle}</p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground tabular-nums">
                {formatMctbPhoneLabel(row.callerE164)} · {row.missedAtRelative}
              </p>
            </div>
          </Link>
        </li>
      ))}
      {rows.length === 0 ? (
        <li className={cn('px-5 py-8 text-center text-sm text-muted-foreground')}>No missed calls yet.</li>
      ) : null}
    </ul>
  )
}
