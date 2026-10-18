import { Page, PageHeader, Panel, Stat } from '@/components/app/page-primitives'
import { BarsChart, TrendChart } from '@/components/app/charts'
import { RangeSelect } from '@/components/app/range-select'
import { HOURLY_VOLUME, PHONE_TREND, TEAM } from '@/lib/data'

export const metadata = { title: 'Analytics · Phone' }

const totals = PHONE_TREND.reduce((a, d) => ({ inbound: a.inbound + d.inbound, outbound: a.outbound + d.outbound, missed: a.missed + d.missed }), { inbound: 0, outbound: 0, missed: 0 })

const userRows = [
  { name: TEAM[2].name, calls: 118, answered: 104, talk: '6h 12m', avg: '3m 34s' },
  { name: TEAM[1].name, calls: 86, answered: 79, talk: '4h 48m', avg: '3m 39s' },
  { name: TEAM[0].name, calls: 41, answered: 37, talk: '2h 05m', avg: '3m 23s' },
]

export default function PhoneAnalytics() {
  return (
    <Page>
      <PageHeader
        title="Phone analytics"
        description="Call volume, answer rates and team activity across all business lines. Missed means no eligible human or AI answered."
        actions={<RangeSelect />}
      />
      <section aria-label="Totals" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Inbound calls" value={totals.inbound} hint="+8% vs prior period" />
        <Stat label="Outbound calls" value={totals.outbound} hint="Includes power dialer" />
        <Stat label="Missed" value={totals.missed} tone="danger" hint={`${Math.round((totals.missed / totals.inbound) * 100)}% of inbound`} />
        <Stat label="Answer rate" value={`${Math.round(((totals.inbound - totals.missed) / totals.inbound) * 100)}%`} tone="success" hint="Human + AI" />
      </section>
      <Panel title="Daily volume" description="Inbound, outbound and missed calls per day">
        <TrendChart
          data={PHONE_TREND}
          xKey="day"
          config={{
            inbound: { label: 'Inbound', color: 'var(--chart-1)' },
            outbound: { label: 'Outbound', color: 'var(--chart-2)' },
            missed: { label: 'Missed', color: 'var(--chart-4)' },
          }}
        />
      </Panel>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Busiest hours" description="Inbound calls by hour of day (CT)">
          <BarsChart data={HOURLY_VOLUME} xKey="hour" config={{ calls: { label: 'Calls', color: 'var(--chart-1)' } }} />
        </Panel>
        <Panel title="By teammate" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Teammate</th>
                  <th className="px-3 py-2.5 text-right font-medium">Calls</th>
                  <th className="px-3 py-2.5 text-right font-medium">Answered</th>
                  <th className="px-3 py-2.5 text-right font-medium">Talk time</th>
                  <th className="px-5 py-2.5 text-right font-medium">Avg</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {userRows.map((r) => (
                  <tr key={r.name}>
                    <td className="px-5 py-3 font-medium">{r.name}</td>
                    <td className="px-3 py-3 text-right tabular">{r.calls}</td>
                    <td className="px-3 py-3 text-right tabular">{r.answered}</td>
                    <td className="px-3 py-3 text-right tabular">{r.talk}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs">{r.avg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </Page>
  )
}
