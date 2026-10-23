'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { RangeSelect } from '@/components/app/range-select'
import { SegmentedFilter } from '@/components/app/filters'
import {
  AnalyticsKpiStrip,
  AnalyticsTrend,
  usePowerDialerAnalytics,
  type AnalyticsPayload,
} from '@/components/power-dialer/analytics-range-shell'

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'campaigns', label: 'Campaigns' },
  { value: 'representatives', label: 'Representatives' },
  { value: 'numbers', label: 'Numbers' },
  { value: 'screening', label: 'Screening' },
  { value: 'usage', label: 'Usage' },
] as const

type TabValue = (typeof TABS)[number]['value']

function CampaignsPanel({ data }: { data: AnalyticsPayload }) {
  return (
    <Panel title="By campaign">
      <ul className="divide-y text-sm">
        {data.campaigns.map((c) => (
          <li key={c.id} className="flex justify-between gap-2 py-2">
            <span className="font-medium">{c.name}</span>
            <span className="text-muted-foreground tabular-nums">
              {c.attempts} attempts · {c.humanConversations} conversations
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function RepresentativesPanel({ data }: { data: AnalyticsPayload }) {
  return (
    <Panel title="By representative">
      <ul className="divide-y text-sm">
        {data.representatives.map((r) => (
          <li key={r.userId} className="flex justify-between gap-2 py-2">
            <span className="font-mono text-xs">{r.userId.slice(0, 8)}…</span>
            <span className="text-muted-foreground tabular-nums">
              {r.attempts} attempts · {r.humanConversations} conversations
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function NumbersPanel({ data }: { data: AnalyticsPayload }) {
  return (
    <Panel title="By caller ID number">
      <ul className="divide-y text-sm">
        {data.numbers.map((n) => (
          <li key={n.phoneNumberId} className="flex justify-between gap-2 py-2">
            <span className="font-mono text-xs">{n.phoneNumberId.slice(0, 10)}…</span>
            <span className="text-muted-foreground tabular-nums">
              {n.attempts} attempts · {n.humanConversations} conversations
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function ScreeningPanel({ data }: { data: AnalyticsPayload }) {
  return (
    <Panel title="Call screening">
      <p className="text-sm text-muted-foreground">
        Detected: {data.screening.detected} · Uncertain: {data.screening.uncertain}
      </p>
    </Panel>
  )
}

function UsagePanel({ data }: { data: AnalyticsPayload }) {
  return (
    <Panel title="Usage">
      <p className="text-sm">
        Billable minutes this period: <span className="font-medium tabular-nums">{data.usage.minutesUsed}</span>
        {data.usage.minutesIncluded != null && (
          <> / {data.usage.minutesIncluded} included</>
        )}
      </p>
    </Panel>
  )
}

export function PowerDialerAnalyticsTabShell({ initialTab = 'overview' }: { initialTab?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = (searchParams.get('tab') || initialTab) as TabValue
  const [tab, setTab] = useState<TabValue>(TABS.some((t) => t.value === tabParam) ? tabParam : 'overview')
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d')
  const { data, error } = usePowerDialerAnalytics(range)

  useEffect(() => {
    const next = searchParams.get('tab') as TabValue | null
    if (next && TABS.some((t) => t.value === next)) setTab(next)
  }, [searchParams])

  const changeTab = (next: TabValue) => {
    setTab(next)
    const q = new URLSearchParams(searchParams.toString())
    q.set('tab', next)
    router.replace(`/app/power-dialer/analytics?${q.toString()}`, { scroll: false })
  }

  return (
    <Page>
      <PageHeader
        title="Analytics"
        description="Shared metric definitions with Overview and Call history."
        actions={<RangeSelect value={range} onChange={setRange} />}
      />
      <div className="mb-4 overflow-x-auto">
        <SegmentedFilter
          label="Analytics section"
          value={tab}
          onChange={(v) => changeTab(v as TabValue)}
          options={TABS.map((t) => ({ value: t.value, label: t.label }))}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          {tab === 'overview' && (
            <>
              <AnalyticsKpiStrip data={data} />
              {data.usage.minutesIncluded != null && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Period usage: {data.usage.minutesUsed} / {data.usage.minutesIncluded} included minutes.
                </p>
              )}
              <Panel title="Daily volume" className="mt-6">
                <AnalyticsTrend data={data} />
              </Panel>
            </>
          )}
          {tab === 'campaigns' && <CampaignsPanel data={data} />}
          {tab === 'representatives' && <RepresentativesPanel data={data} />}
          {tab === 'numbers' && <NumbersPanel data={data} />}
          {tab === 'screening' && <ScreeningPanel data={data} />}
          {tab === 'usage' && <UsagePanel data={data} />}
        </>
      )}
    </Page>
  )
}
