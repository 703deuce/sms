'use client'

import { Stat } from '@/components/app/page-primitives'
import { AnalyticsShell } from '@/components/power-dialer/analytics-range-shell'

export default function AnalyticsScreeningPage() {
  return (
    <AnalyticsShell title="Screening analytics" description="Screener detections are never counted as human conversations.">
      {({ data }) => (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="Screeners detected" value={data.screening.detected} />
          <Stat label="Uncertain classifications" value={data.screening.uncertain} />
          <Stat label="Human conversations" value={data.totals.humanConversations} />
        </section>
      )}
    </AnalyticsShell>
  )
}
