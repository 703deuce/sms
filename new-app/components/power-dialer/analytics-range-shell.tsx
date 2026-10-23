'use client'

import { useEffect, useState } from 'react'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { RangeSelect } from '@/components/app/range-select'
import { PowerDialerAnalyticsNav } from '@/components/power-dialer/analytics-nav'
import { TrendChart } from '@/components/app/charts'
import { Stat } from '@/components/app/page-primitives'

export type AnalyticsPayload = {
  totals: {
    attempts: number
    humanConversations: number
    billableMinutes: number
    humanRate: number
    screeningEvents: number
  }
  trend: { day: string; attempts: number }[]
  campaigns: { id: string; name: string; attempts: number; humanConversations: number }[]
  representatives: { userId: string; attempts: number; humanConversations: number }[]
  numbers: { phoneNumberId: string; attempts: number; humanConversations: number }[]
  screening: { detected: number; uncertain: number }
  pickup?: {
    denominator: number
    human: number
    machine: number
    screener: number
    unclassified: number
    humanRate: number
    machineRate: number
  }
  usage: { minutesUsed: number; minutesIncluded: number | null }
  funnel?: { dialed: number; connected: number; conversations: number; outcomes: number }
  dispositions?: { label: string; count: number }[]
  byHour?: { hour: number; attempts: number }[]
  productivity?: { talkMinutes: number; wrapMinutes: number; callsPerHour: number }
  leaderboard?: {
    userId: string
    attempts: number
    humanConversations: number
    connectRate: number
  }[]
  conversions?: {
    campaignId: string
    campaignName: string
    conversions: number
    dispositioned: number
    conversionRatePct: number
  }[]
}

export function usePowerDialerAnalytics(range: '7d' | '30d' | '90d') {
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void fetch(`/api/phone/power-dialer/analytics?range=${range}`)
      .then((r) => r.json())
      .then((j) => setData(j.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
  }, [range])
  return { data, error }
}

export function AnalyticsShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: (ctx: { data: AnalyticsPayload; range: '7d' | '30d' | '90d' }) => React.ReactNode
}) {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d')
  const { data, error } = usePowerDialerAnalytics(range)
  return (
    <Page>
      <PageHeader title={title} description={description} actions={<RangeSelect value={range} onChange={setRange} />} />
      <PowerDialerAnalyticsNav />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {data ? children({ data, range }) : <p className="text-sm text-muted-foreground">Loading…</p>}
    </Page>
  )
}

export function AnalyticsKpiStrip({ data }: { data: AnalyticsPayload }) {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label="Attempts" value={data.totals.attempts} />
      <Stat label="Human conversations" value={data.totals.humanConversations} />
      <Stat label="Human rate" value={`${data.totals.humanRate}%`} />
      <Stat label="Billable minutes" value={data.totals.billableMinutes} />
    </section>
  )
}

export function AnalyticsTrend({ data }: { data: AnalyticsPayload }) {
  return (
    <TrendChart
      data={data.trend}
      xKey="day"
      config={{ attempts: { label: 'Attempts', color: 'var(--chart-2)' } }}
    />
  )
}
