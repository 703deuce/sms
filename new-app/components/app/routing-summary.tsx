'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Panel } from '@/components/app/page-primitives'
import { useWorkspace } from '@/components/providers/workspace-provider'
import { formatWhen } from '@/lib/format'
import type { RoutePolicy } from '@/lib/data'

export const DESTINATION_LABEL: Record<RoutePolicy['duringHours'], string> = {
  ring_group: 'Front desk ring group',
  user: 'Specific teammate',
  external: 'External number',
  ai: 'AI Receptionist',
  voicemail: 'Voicemail',
}

export const FALLBACK_LABEL: Record<RoutePolicy['noAnswer'], string> = {
  ai: 'AI Receptionist',
  voicemail: 'Voicemail',
  external: 'External number',
}

export const COVERAGE_LABEL: Record<RoutePolicy['aiCoverage'], string> = {
  full_time: 'Full-time',
  after_hours: 'After-hours only',
  overflow: 'Overflow / no answer',
  after_hours_overflow: 'After-hours + overflow',
  off: 'Off',
}

export function useRouteSteps() {
  const { routePolicy: p } = useWorkspace()
  return {
    policy: p,
    steps: [
      { when: 'During hours', then: `${DESTINATION_LABEL[p.duringHours]}${p.duringHours === 'ring_group' ? ` · ${p.ringStrategy}, ${p.ringTimeout}s` : ''}` },
      { when: 'No answer / busy', then: FALLBACK_LABEL[p.noAnswer] },
      { when: 'After hours', then: FALLBACK_LABEL[p.afterHours] },
      { when: 'Still missed', then: p.mctbEnabled ? 'Missed Call Text Back (press-1 consent)' : 'No text back' },
    ],
  }
}

export function RoutingSummary({ title = 'Call handling', manageHref, manageLabel = 'Manage routing' }: { title?: string; manageHref: string; manageLabel?: string }) {
  const { policy, steps } = useRouteSteps()
  return (
    <Panel
      title={title}
      description={<>Main line · updated {formatWhen(policy.updatedAt)} by {policy.updatedBy}</>}
      actions={
        <Link href={manageHref} className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
          {manageLabel}
          <ChevronRight className="size-3.5" />
        </Link>
      }
    >
      <ol className="flex flex-col">
        {steps.map((s, i) => (
          <li key={s.when} className="relative flex gap-3 pb-4 last:pb-0">
            {i < steps.length - 1 && <span aria-hidden className="absolute top-6 bottom-0 left-[11px] w-px bg-border" />}
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-[11px] font-semibold text-accent-foreground">
              {i + 1}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{s.when}</span>
              <span className="text-sm font-medium">{s.then}</span>
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  )
}
