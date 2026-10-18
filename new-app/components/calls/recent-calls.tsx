import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Disc } from 'lucide-react'
import { Panel } from '@/components/app/page-primitives'
import { AI_OUTCOME, CALL_OUTCOME, MCTB_STATE, StatusBadge } from '@/components/app/status'
import type { Call } from '@/lib/data'
import { formatDuration, formatWhen } from '@/lib/format'

export function RecentCalls({
  calls,
  basePath,
  title = 'Recent calls',
  viewAllHref,
  focus = 'phone',
}: {
  calls: Call[]
  basePath: string
  title?: string
  viewAllHref: string
  focus?: 'phone' | 'receptionist' | 'mctb'
}) {
  return (
    <Panel
      title={title}
      bodyClassName="p-0"
      actions={
        <Link href={viewAllHref} className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
          View all
          <ChevronRight className="size-3.5" />
        </Link>
      }
    >
      <ul className="divide-y">
        {calls.map((c) => {
          const badge =
            focus === 'receptionist' && c.ai
              ? AI_OUTCOME[c.ai.outcome]
              : focus === 'mctb' && c.mctb
                ? MCTB_STATE[c.mctb.state]
                : CALL_OUTCOME[c.outcome]
          const Dir = c.direction === 'inbound' ? ArrowDownLeft : ArrowUpRight
          return (
            <li key={c.id}>
              <Link href={`${basePath}/${c.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/60">
                <Dir className="size-4 shrink-0 text-muted-foreground" aria-label={c.direction} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{c.caller}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {focus === 'receptionist' && c.ai ? c.ai.intent : c.routedTo}
                  </span>
                </span>
                {c.recording && <Disc className="hidden size-3.5 text-muted-foreground sm:block" aria-label="Recorded" />}
                <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                <span className="hidden w-20 text-right sm:flex sm:flex-col">
                  <span className="text-xs tabular">{formatWhen(c.startedAt)}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{formatDuration(c.durationSec)}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
