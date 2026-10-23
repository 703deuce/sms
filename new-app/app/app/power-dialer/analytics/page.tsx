'use client'

import { Panel } from '@/components/app/page-primitives'
import { AnalyticsKpiStrip, AnalyticsShell, AnalyticsTrend } from '@/components/power-dialer/analytics-range-shell'

export default function PowerDialerAnalyticsPage() {
  return (
    <AnalyticsShell
      title="Analytics"
      description="Shared metric definitions with Overview and Call history."
    >
      {({ data }) => (
        <>
          <AnalyticsKpiStrip data={data} />
          {data.usage.minutesIncluded != null && (
            <p className="text-sm text-muted-foreground">
              Period usage: {data.usage.minutesUsed} / {data.usage.minutesIncluded} included minutes.
            </p>
          )}
          <Panel title="Daily volume">
            <AnalyticsTrend data={data} />
          </Panel>
        </>
      )}
    </AnalyticsShell>
  )
}
