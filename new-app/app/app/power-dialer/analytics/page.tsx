'use client'

import { useEffect, useState } from 'react'
import { Page, PageHeader, Panel, Stat } from '@/components/app/page-primitives'
import { RangeSelect } from '@/components/app/range-select'
import { TrendChart } from '@/components/app/charts'
import { fetchPhoneAnalytics } from '@/lib/phone-api'
import { formatDuration } from '@/lib/format'

export default function PowerDialerAnalyticsPage() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d')
  const [data, setData] = useState<import('@/lib/phone-api').PhoneAnalyticsDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchPhoneAnalytics(range)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load analytics'))
  }, [range])

  const outbound = data?.totals.outbound ?? 0

  return (
    <Page>
      <PageHeader
        title="Analytics"
        description="Workspace phone analytics including power-dialer campaign rollups. Power-dialer-specific funnels expand in Phase 6."
        actions={<RangeSelect value={range} onChange={setRange} />}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {data && (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Outbound calls" value={outbound} />
            <Stat label="Answer rate (inbound baseline)" value={`${Math.round(data.totals.answerRate)}%`} />
            <Stat label="Talk time" value={formatDuration(data.totals.talkSec)} />
            <Stat label="Campaigns" value={data.campaigns.length} />
          </section>
          <Panel title="Daily volume">
            <TrendChart
              data={data.trend}
              xKey="day"
              config={{
                outbound: { label: 'Outbound', color: 'var(--chart-2)' },
              }}
            />
          </Panel>
          <Panel title="Campaign rollups" bodyClassName="p-0">
            <ul className="divide-y text-sm">
              {data.campaigns.length === 0 && (
                <li className="px-5 py-8 text-center text-muted-foreground">No campaign activity in range.</li>
              )}
              {data.campaigns.map((c) => (
                <li key={c.id} className="flex justify-between gap-3 px-5 py-3">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground tabular">
                    {c.attemptedCount} attempts · {c.connectedCount} connected
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </Page>
  )
}
