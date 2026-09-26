import { Page, PageHeader, Panel, Stat, TextLink } from '@/newui-transplant/components/app/kit'
import { RangeToggle } from '@/newui-transplant/components/app/range-toggle'
import { MiniBars } from '@/newui-transplant/components/app/charts'
import { CHART_WEEK } from '@/newui-transplant/lib/sandbox-data'


const FUNNEL = [
  { label: 'Missed calls', value: 87, note: '100%' },
  { label: 'Eligible', value: 84, note: '97% of missed' },
  { label: 'Recovery texts sent', value: 81, note: '96% of eligible' },
  { label: 'Customer replies', value: 52, note: '64% reply rate' },
]

const OUTCOMES = [
  ['Delivery failures', '2'],
  ['Booking links sent', '38'],
  ['Callback requests', '14'],
  ['AI-assisted conversations', '41'],
  ['Tracking link clicks', '29'],
  ['Opt-outs (suppressed)', '1'],
]

const DEFINITIONS = [
  ['Eligible', 'Missed calls from mobile numbers that weren’t excluded or opted out.'],
  ['Recovery texts sent', 'Texts successfully handed to the carrier after a missed call.'],
  ['Customer replies', 'Conversations where the caller replied at least once.'],
  ['Reply rate', 'Customer replies divided by recovery texts sent.'],
]

const SUPPRESSED = [
  { reason: 'Landline number', count: 1 },
  { reason: 'On exclusion list', count: 1 },
  { reason: 'Recent text (cooldown)', count: 1 },
]

export function TransplantMctbAnalyticsPage() {
  const total = SUPPRESSED.reduce((a, s) => a + s.count, 0)
  return (
    <Page>
      <PageHeader title="Analytics" description="How missed-call recovery is performing." actions={<RangeToggle />} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Missed calls" value="87" delta={-6} href="/mctb/missed-calls" />
        <Stat label="Recovery texts sent" value="81" delta={9} href="/mctb/missed-calls" />
        <Stat label="Customers replied" value="52" delta={14} href="/mctb/conversations" />
        <Stat label="Reply rate" value="64%" delta={5} />
      </div>

      <Panel title="Recovery funnel" className="mt-4">
        <ol className="grid gap-4 sm:grid-cols-4">
          {FUNNEL.map((f) => (
            <li key={f.label}>
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{f.value}</p>
              <div className="mt-2 h-2 rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(f.value / FUNNEL[0].value) * 100}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{f.note}</p>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Panel title="Missed calls over time">
          <MiniBars data={CHART_WEEK} dataKey="missed" label="Missed" color="var(--chart-5)" />
        </Panel>
        <Panel title="Recovery texts over time">
          <MiniBars data={CHART_WEEK} dataKey="texts" label="Texts" color="var(--chart-1)" />
        </Panel>
        <Panel title="Replies over time">
          <MiniBars data={CHART_WEEK} dataKey="replies" label="Replies" color="var(--chart-3)" />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Outcomes & delivery">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            {OUTCOMES.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Why some callers weren’t texted" bodyClassName="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="px-5 py-2.5 font-medium">Reason</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Count</th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {SUPPRESSED.map((s) => (
                <tr key={s.reason}>
                  <td className="px-5 py-2.5">{s.reason}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{s.count}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">{Math.round((s.count / total) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Definitions">
          <dl className="flex flex-col gap-3">
            {DEFINITIONS.map(([k, v]) => (
              <div key={k}>
                <dt className="text-sm font-medium">{k}</dt>
                <dd className="text-pretty text-xs text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Voicemail" action={<TextLink href="/mctb/voicemail">Open voicemail</TextLink>}>
          <p className="text-2xl font-semibold tabular-nums">12</p>
          <p className="text-xs text-muted-foreground">Voicemails left after a missed call this period</p>
        </Panel>
      </div>
    </Page>
  )
}
