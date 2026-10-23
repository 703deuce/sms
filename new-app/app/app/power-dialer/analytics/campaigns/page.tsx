'use client'

import { Panel } from '@/components/app/page-primitives'
import { AnalyticsKpiStrip, AnalyticsShell, AnalyticsTrend } from '@/components/power-dialer/analytics-range-shell'

export default function AnalyticsCampaignsPage() {
  return (
    <AnalyticsShell title="Campaign performance" description="Attempts and human conversations by campaign.">
      {({ data }) => (
        <>
          <AnalyticsKpiStrip data={data} />
          <Panel title="Daily attempts"><AnalyticsTrend data={data} /></Panel>
          <Panel title="Campaigns" bodyClassName="p-0">
            <ul className="divide-y text-sm">
              {data.campaigns.length === 0 && (
                <li className="px-5 py-8 text-center text-muted-foreground">No campaign activity in range.</li>
              )}
              {data.campaigns.map((c) => (
                <li key={c.id} className="flex justify-between px-5 py-3">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground tabular">
                    {c.attempts} attempts · {c.humanConversations} human
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </AnalyticsShell>
  )
}
