'use client'

import { Panel } from '@/components/app/page-primitives'
import { AnalyticsShell } from '@/components/power-dialer/analytics-range-shell'

export default function AnalyticsNumbersPage() {
  return (
    <AnalyticsShell title="Number performance" description="Outbound caller ID usage in the selected range.">
      {({ data }) => (
        <Panel title="Numbers" bodyClassName="p-0">
          <ul className="divide-y text-sm">
            {data.numbers.length === 0 && (
              <li className="px-5 py-8 text-center text-muted-foreground">No number-attributed calls in range.</li>
            )}
            {data.numbers.map((n) => (
              <li key={n.phoneNumberId} className="flex justify-between px-5 py-3">
                <span className="font-mono text-xs">{n.phoneNumberId}</span>
                <span className="text-xs text-muted-foreground tabular">
                  {n.attempts} attempts · {n.humanConversations} human
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </AnalyticsShell>
  )
}
