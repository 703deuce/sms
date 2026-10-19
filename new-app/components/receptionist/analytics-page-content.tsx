'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Page, PageHeader, Panel, Stat } from '@/components/app/page-primitives'
import { BarsChart, TrendChart } from '@/components/app/charts'
import { RangeSelect } from '@/components/app/range-select'
import { StatusBadge } from '@/components/app/status'
import { fetchReceptionistAnalytics } from '@/lib/receptionist-api'
import { formatDuration } from '@/lib/format'

export function ReceptionistAnalyticsContent() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchReceptionistAnalytics>> | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setData(await fetchReceptionistAnalytics())
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const t = data?.totals
  const bookedPct = t && t.handled > 0 ? Math.round((t.booked / t.handled) * 100) : 0

  return (
    <Page>
      <PageHeader
        title="AI Receptionist analytics"
        description="How Ava is resolving calls. Booked counts only confirmed calendar events; transfers count only connected handoffs."
        actions={<RangeSelect />}
      />
      <section aria-label="Totals" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Calls handled" value={loading ? '—' : t?.handled ?? 0} />
        <Stat label="Booked" value={loading ? '—' : t?.booked ?? 0} tone="success" hint={t ? `${bookedPct}% of handled` : undefined} />
        <Stat label="Transferred" value={loading ? '—' : t?.transferred ?? 0} hint="Connected handoffs" />
        <Stat label="Avg handle time" value={loading ? '—' : formatDuration(t?.avgSec ?? 0)} />
      </section>
      <Panel title="Outcomes over time">
        {data?.trend?.length ? (
          <TrendChart
            data={data.trend}
            xKey="day"
            config={{
              handled: { label: 'Handled', color: 'var(--chart-1)' },
              booked: { label: 'Booked', color: 'var(--chart-3)' },
              transferred: { label: 'Transferred', color: 'var(--chart-2)' },
            }}
          />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No calls in this range yet.</p>
        )}
      </Panel>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Top caller intents">
          {data?.intents?.length ? (
            <BarsChart horizontal data={data.intents} xKey="intent" config={{ calls: { label: 'Calls', color: 'var(--chart-1)' } }} />
          ) : (
            <p className="py-6 text-sm text-muted-foreground">No intent data yet.</p>
          )}
        </Panel>
        <Panel
          title="Knowledge gaps"
          description="Questions Ava could not answer"
          actions={<Link href="/app/receptionist/knowledge" className="text-xs font-medium text-primary hover:underline">Fix in Knowledge</Link>}
          bodyClassName="p-0"
        >
          <ul className="divide-y">
            {(data?.topGaps || []).length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-muted-foreground">No open gaps.</li>
            )}
            {(data?.topGaps || []).map((g) => (
              <li key={g.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium text-pretty">{g.question}</span>
                  {g.lastCallId && (
                    <Link href={`/app/receptionist/calls/${g.lastCallId}`} className="text-xs text-muted-foreground hover:text-foreground">
                      Asked {g.count}× · view latest call
                    </Link>
                  )}
                </span>
                <StatusBadge tone={g.impact === 'high' ? 'danger' : g.impact === 'medium' ? 'warning' : 'muted'}>{g.impact}</StatusBadge>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </Page>
  )
}
