'use client'

import { Panel, Stat } from '@/components/app/page-primitives'
import { AnalyticsShell } from '@/components/power-dialer/analytics-range-shell'

export default function AnalyticsUsagePage() {
  return (
    <AnalyticsShell title="Usage & minutes" description="Billable minutes from persisted attempt seconds and workspace limits.">
      {({ data }) => (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat label="Billable minutes (range)" value={data.totals.billableMinutes} />
            <Stat label="Used this period" value={data.usage.minutesUsed} />
            <Stat
              label="Included allowance"
              value={data.usage.minutesIncluded ?? '—'}
            />
          </section>
          <Panel title="Overage">
            <p className="text-sm text-muted-foreground">
              Allowance and overage behavior are configured in workspace billing limits and Settings → Usage.
            </p>
          </Panel>
        </>
      )}
    </AnalyticsShell>
  )
}
