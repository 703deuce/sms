import Link from 'next/link'
import { Page, PageHeader, Panel, Stat } from '@/components/app/page-primitives'
import { BarsChart, TrendChart } from '@/components/app/charts'
import { RangeSelect } from '@/components/app/range-select'
import { StatusBadge } from '@/components/app/status'
import { AI_INTENTS, AI_TREND, GAPS } from '@/lib/data'

export const metadata = { title: 'Analytics · AI Receptionist' }

const t = AI_TREND.reduce((a, d) => ({ handled: a.handled + d.handled, booked: a.booked + d.booked, transferred: a.transferred + d.transferred }), { handled: 0, booked: 0, transferred: 0 })

export default function AiAnalytics() {
  return (
    <Page>
      <PageHeader
        title="AI Receptionist analytics"
        description="How Ava is resolving calls. Booked counts only confirmed calendar events; transfers count only connected handoffs."
        actions={<RangeSelect />}
      />
      <section aria-label="Totals" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Calls handled" value={t.handled} />
        <Stat label="Booked" value={t.booked} tone="success" hint={`${Math.round((t.booked / t.handled) * 100)}% of handled`} />
        <Stat label="Transferred" value={t.transferred} hint="Connected handoffs" />
        <Stat label="Avg handle time" value="2m 41s" />
      </section>
      <Panel title="Outcomes over time">
        <TrendChart
          data={AI_TREND}
          xKey="day"
          config={{
            handled: { label: 'Handled', color: 'var(--chart-1)' },
            booked: { label: 'Booked', color: 'var(--chart-3)' },
            transferred: { label: 'Transferred', color: 'var(--chart-2)' },
          }}
        />
      </Panel>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Top caller intents">
          <BarsChart horizontal data={AI_INTENTS} xKey="intent" config={{ calls: { label: 'Calls', color: 'var(--chart-1)' } }} />
        </Panel>
        <Panel
          title="Knowledge gaps"
          description="Questions Ava could not answer"
          actions={<Link href="/app/receptionist/knowledge" className="text-xs font-medium text-primary hover:underline">Fix in Knowledge</Link>}
          bodyClassName="p-0"
        >
          <ul className="divide-y">
            {GAPS.map((g) => (
              <li key={g.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium text-pretty">{g.question}</span>
                  <Link href={`/app/receptionist/calls/${g.lastCallId}`} className="text-xs text-muted-foreground hover:text-foreground">
                    Asked {g.count}× · view latest call
                  </Link>
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
