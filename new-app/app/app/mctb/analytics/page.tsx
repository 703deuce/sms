import { Page, PageHeader, Panel, Stat } from '@/components/app/page-primitives'
import { BarsChart, Funnel } from '@/components/app/charts'
import { RangeSelect } from '@/components/app/range-select'
import { MCTB_FUNNEL, NUMBERS } from '@/lib/data'

export const metadata = { title: 'Analytics · Missed Call Text Back' }

const f = Object.fromEntries(MCTB_FUNNEL.map((s) => [s.stage, s.value]))

const reasons = [
  { reason: 'No press-1', count: 24 },
  { reason: 'Declined', count: 8 },
  { reason: 'Opted out', count: 5 },
  { reason: 'Quiet hours', count: 4 },
  { reason: 'Recent text (cooldown)', count: 3 },
]

const byNumber = [
  { label: NUMBERS[0].label, missed: 58, replied: 19 },
  { label: NUMBERS[2].label, missed: 38, replied: 10 },
]

export default function McTbAnalytics() {
  return (
    <Page>
      <PageHeader
        title="Missed Call Text Back analytics"
        description="Recovery is measured from replies and completed callbacks — never from texts sent. Each stage requires real consent and delivery."
        actions={<RangeSelect />}
      />
      <section aria-label="Totals" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Missed calls" value={f['Missed calls']} />
        <Stat label="Consent rate" value={`${Math.round((f['Consent recorded'] / f['Consent offered']) * 100)}%`} hint="Pressed 1 of offered" />
        <Stat label="Reply rate" value={`${Math.round((f['Replied'] / f['Message delivered']) * 100)}%`} hint="Of delivered" />
        <Stat label="Recovered" value={f['Recovered']} tone="success" hint="Callback or booking" />
      </section>
      <Panel title="Recovery funnel" description="Each stage is a subset of the one above">
        <Funnel stages={MCTB_FUNNEL} />
      </Panel>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Why texts were not sent">
          <BarsChart horizontal data={reasons} xKey="reason" config={{ count: { label: 'Calls', color: 'var(--chart-4)' } }} />
        </Panel>
        <Panel title="By number">
          <BarsChart
            data={byNumber}
            xKey="label"
            config={{ missed: { label: 'Missed', color: 'var(--chart-2)' }, replied: { label: 'Replied', color: 'var(--chart-1)' } }}
          />
        </Panel>
      </div>
    </Page>
  )
}
