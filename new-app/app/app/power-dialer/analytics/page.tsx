'use client'

import { useEffect, useState } from 'react'
import { Page, PageHeader, Panel, Stat } from '@/components/app/page-primitives'
import { RangeSelect } from '@/components/app/range-select'
import { TrendChart } from '@/components/app/charts'
import { formatDuration } from '@/lib/format'

export default function PowerDialerAnalyticsPage() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d')
  const [data, setData] = useState<{
    totals: { attempts: number; humanConversations: number; billableMinutes: number; humanRate: number; screeningEvents: number }
    trend: { day: string; attempts: number }[]
    campaigns: { id: string; name: string; attempts: number; humanConversations: number }[]
    usage: { minutesUsed: number; minutesIncluded: number | null }
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetch(`/api/phone/power-dialer/analytics?range=${range}`)
      .then((r) => r.json())
      .then((j) => setData(j.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load analytics'))
  }, [range])

  return (
    <Page>
      <PageHeader
        title="Analytics"
        description="Power-dialer metrics use the same definitions as Overview and Call history (human conversations exclude voicemail, machine, and screener)."
        actions={<RangeSelect value={range} onChange={setRange} />}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {data && (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Attempts" value={data.totals.attempts} />
            <Stat label="Human conversations" value={data.totals.humanConversations} />
            <Stat label="Human rate" value={`${data.totals.humanRate}%`} />
            <Stat label="Billable minutes" value={data.totals.billableMinutes} />
          </section>
          {data.usage.minutesIncluded != null && (
            <p className="text-sm text-muted-foreground">
              Usage this period: {data.usage.minutesUsed} / {data.usage.minutesIncluded} included minutes (from workspace limits).
            </p>
          )}
          <Panel title="Daily volume">
            <TrendChart
              data={data.trend}
              xKey="day"
              config={{
                attempts: { label: 'Attempts', color: 'var(--chart-2)' },
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
                    {c.attempts} attempts · {c.humanConversations} human conversations
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
