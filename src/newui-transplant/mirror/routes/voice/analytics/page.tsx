import Link from 'next/link'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { Page, PageHeader, Panel, Stat, TextLink } from '@/newui-transplant/components/app/kit'
import { RangeToggle } from '@/newui-transplant/components/app/range-toggle'
import { TrendArea } from '@/newui-transplant/components/app/charts'
import { CHART_WEEK } from '@/newui-transplant/lib/sandbox-data'


const OUTCOMES = [
  { label: 'Appointments', value: 70 },
  { label: 'Leads captured', value: 41 },
  { label: 'Messages taken', value: 58 },
  { label: 'Transfers', value: 36 },
  { label: 'Voicemail', value: 12 },
  { label: 'Spam blocked', value: 31 },
]

const SENTIMENT = [
  { label: 'Positive', value: 62, className: 'bg-success' },
  { label: 'Neutral', value: 28, className: 'bg-chart-4' },
  { label: 'Negative', value: 6, className: 'bg-destructive' },
  { label: 'Unknown', value: 4, className: 'bg-muted-foreground/30' },
]

export function TransplantVoiceAnalyticsPage() {
  const max = Math.max(...OUTCOMES.map((o) => o.value))
  return (
    <Page>
      <PageHeader title="Analytics" description="How your receptionist is performing." actions={<RangeToggle />} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Calls" value="308" delta={12} />
        <Stat label="Appointments booked" value="70" delta={8} />
        <Stat label="Transfers answered" value="33" delta={4} />
        <Stat label="Callbacks requested" value="14" delta={-5} />
        <Stat label="Avg. duration" value="2:34" delta={-2} />
        <Stat label="Voicemail" value="12" delta={-18} />
      </div>

      <Link
        href="/voice/knowledge"
        className="mt-4 flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-sm transition hover:bg-warning/10"
      >
        <HelpCircle className="size-4 text-warning" aria-hidden="true" />
        <span className="flex-1">3 open knowledge gaps are causing callers to leave messages instead of booking.</span>
        <span className="text-xs font-medium text-primary">Review</span>
      </Link>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Call volume over time" className="lg:col-span-2">
          <TrendArea
            data={CHART_WEEK}
            series={[
              { key: 'calls', label: 'Calls', color: 'var(--chart-1)' },
              { key: 'booked', label: 'Booked', color: 'var(--chart-3)' },
            ]}
            height={240}
          />
        </Panel>
        <Panel title="Call outcomes" description="A call can have more than one outcome">
          <ul className="flex flex-col gap-3">
            {OUTCOMES.map((o) => (
              <li key={o.label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{o.label}</span>
                  <span className="font-medium tabular-nums">{o.value}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(o.value / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Receptionist performance">
          <dl className="grid grid-cols-3 gap-3">
            {[
              ['Median response', '0.7s'],
              ['Transfers failed', '3'],
              ['Voicemail (inbound)', '3.9%'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Caller sentiment" description="Based on 289 analyzed calls">
          <div className="flex h-2.5 overflow-hidden rounded-full">
            {SENTIMENT.map((s) => (
              <div key={s.label} className={s.className} style={{ width: `${s.value}%` }} />
            ))}
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2">
            {SENTIMENT.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-xs">
                <span className={`size-2 rounded-full ${s.className}`} aria-hidden="true" />
                <span className="text-muted-foreground">{s.label}</span>
                <span className="ml-auto font-medium tabular-nums">{s.value}%</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Usage" action={<TextLink href="/settings/billing">Billing</TextLink>}>
          {[
            { label: 'AI minutes', used: 1284, total: 2000 },
            { label: 'Phone minutes', used: 1702, total: 3000 },
          ].map((u) => (
            <div key={u.label} className="mb-4 last:mb-0">
              <div className="mb-1 flex justify-between text-xs">
                <span>{u.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {u.used.toLocaleString()} / {u.total.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(u.used / u.total) * 100}%` }} />
              </div>
            </div>
          ))}
        </Panel>
      </div>

      <details className="group mt-4 rounded-xl border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold">
          Advanced
          <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="border-t px-5 py-4 text-sm">
          <p className="text-muted-foreground">Response latency p95</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">1.42s</p>
        </div>
      </details>
    </Page>
  )
}
