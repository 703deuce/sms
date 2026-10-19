'use client'

import { useEffect, useState } from 'react'
import { Page, PageHeader, Panel, Stat } from '@/components/app/page-primitives'
import { BarsChart, TrendChart } from '@/components/app/charts'
import { RangeSelect } from '@/components/app/range-select'
import { fetchPhoneAnalytics } from '@/lib/phone-api'
import { formatDuration } from '@/lib/format'

export default function PhoneAnalytics() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d')
  const [data, setData] = useState<import('@/lib/phone-api').PhoneAnalyticsDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchPhoneAnalytics(range)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load analytics'))
  }, [range])

  const totals = data?.totals

  return (
    <Page>
      <PageHeader
        title="Phone analytics"
        description="Call volume, answer rates and campaign activity from your greenfield database."
        actions={<RangeSelect value={range} onChange={setRange} />}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {totals && (
        <section aria-label="Totals" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Inbound calls" value={totals.inbound} />
          <Stat label="Outbound calls" value={totals.outbound} />
          <Stat label="Missed" value={totals.missed} tone="danger" />
          <Stat label="Answer rate" value={`${Math.round(totals.answerRate)}%`} tone="success" hint={`Talk ${formatDuration(totals.talkSec)}`} />
        </section>
      )}
      {data && (
        <>
          <Panel title="Daily volume">
            <TrendChart
              data={data.trend}
              xKey="day"
              config={{
                inbound: { label: 'Inbound', color: 'var(--chart-1)' },
                outbound: { label: 'Outbound', color: 'var(--chart-2)' },
                missed: { label: 'Missed', color: 'var(--chart-4)' },
              }}
            />
          </Panel>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel title="Busiest hours">
              <BarsChart data={data.hourly} xKey="hour" config={{ calls: { label: 'Calls', color: 'var(--chart-1)' } }} />
            </Panel>
            <Panel title="Power dialer campaigns" bodyClassName="p-0">
              <ul className="divide-y text-sm">
                {data.campaigns.length === 0 && (
                  <li className="px-5 py-8 text-center text-muted-foreground">No campaigns yet.</li>
                )}
                {data.campaigns.map((c) => (
                  <li key={c.id} className="flex justify-between gap-3 px-5 py-3">
                    <span>{c.name}</span>
                    <span className="text-muted-foreground tabular">{c.attemptedCount} attempts</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </>
      )}
    </Page>
  )
}
