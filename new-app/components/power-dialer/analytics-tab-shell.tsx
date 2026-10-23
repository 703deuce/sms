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
import {
  ConversionPanel,
  DispositionSummaryPanel,
  ExportActions,
  FunnelPanel,
  LeaderboardPanel,
  LiveBoardPanel,
  ProductivityPanel,
  ScheduledReportsPanel,
} from '@/components/power-dialer/analytics-batch6-panels'

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'campaigns', label: 'Campaigns' },
  { value: 'representatives', label: 'Representatives' },
  { value: 'numbers', label: 'Numbers' },
  { value: 'screening', label: 'Screening' },
  { value: 'usage', label: 'Usage' },
  { value: 'funnel', label: 'Funnel' },
  { value: 'dispositions', label: 'Dispositions' },
  { value: 'leaderboard', label: 'Leaderboard' },
  { value: 'live', label: 'Live board' },
  { value: 'reports', label: 'Reports' },
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
  const pickup = data.pickup
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Pickup classification (P26)">
        {pickup ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Answered-signal denominator</dt>
              <dd className="font-medium tabular-nums">{pickup.denominator}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Human conversations</dt>
              <dd className="font-medium tabular-nums">
                {pickup.human} ({pickup.humanRate}%)
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Machine / voicemail</dt>
              <dd className="font-medium tabular-nums">
                {pickup.machine} ({pickup.machineRate}%)
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Call screeners</dt>
              <dd className="font-medium tabular-nums">{pickup.screener}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Unclassified (answered, no AMD)</dt>
              <dd className="font-medium tabular-nums">{pickup.unclassified}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No pickup data for this range.</p>
        )}
      </Panel>
      <Panel title="Call screening">
        <p className="text-sm text-muted-foreground">
          Detected: {data.screening.detected} · Uncertain: {data.screening.uncertain}
        </p>
      </Panel>
    </div>
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
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <ExportActions range={range} />
            <RangeSelect value={range} onChange={setRange} />
          </div>
        }
      />
      <div className="mb-4 overflow-x-auto">
        <SegmentedFilter
          label="Analytics section"
          value={tab}
          onChange={(v) => changeTab(v as TabValue)}
          options={TABS.map((t) => ({ value: t.value, label: t.label }))}
        />
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {!data && !error ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data ? null : (
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
          {tab === 'funnel' && (
            <div className="flex flex-col gap-4">
              <FunnelPanel data={data} />
              <ProductivityPanel data={data} />
              <ConversionPanel data={data} />
            </div>
          )}
          {tab === 'dispositions' && <DispositionSummaryPanel data={data} />}
          {tab === 'leaderboard' && <LeaderboardPanel data={data} />}
          {tab === 'live' && <LiveBoardPanel />}
          {tab === 'reports' && <ScheduledReportsPanel />}
        </>
      )}
    </Page>
  )
}
