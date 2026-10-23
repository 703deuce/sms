'use client'

import { Panel } from '@/components/app/page-primitives'
import { AnalyticsShell } from '@/components/power-dialer/analytics-range-shell'

export default function AnalyticsRepresentativesPage() {
  return (
    <AnalyticsShell title="Representative performance" description="Per-rep attempt and human conversation counts.">
      {({ data }) => (
        <Panel title="Representatives" bodyClassName="p-0">
          <ul className="divide-y text-sm">
            {data.representatives.length === 0 && (
              <li className="px-5 py-8 text-center text-muted-foreground">No rep activity in range.</li>
            )}
            {data.representatives.map((r) => (
              <li key={r.userId} className="flex justify-between px-5 py-3">
                <span className="font-mono text-xs">{r.userId}</span>
                <span className="text-xs text-muted-foreground tabular">
                  {r.attempts} attempts · {r.humanConversations} human
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </AnalyticsShell>
  )
}
