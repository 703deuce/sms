'use client'

import { useState } from 'react'
import { MessageSquareReply, Percent, PhoneMissed, Send } from 'lucide-react'
import { TrendBars } from '@/components/app/charts'
import { Panel, PageHeader, StatCard, TextLink } from '@/components/app/primitives'
import { td, th } from '@/components/app/tables'
import { Segmented } from '@/components/app/tab-nav'
import { mctbVolume } from '@/lib/data'

const ranges: Record<string, number> = { '7 days': 7, '30 days': 30, '90 days': 90 }

export function MctbAnalytics() {
  const [range, setRange] = useState('30 days')
  const data = mctbVolume(ranges[range])
  const missed = data.reduce((s, d) => s + d.missed, 0)
  const texts = data.reduce((s, d) => s + d.texts, 0)
  const replies = data.reduce((s, d) => s + d.replies, 0)
  const eligible = Math.round(missed * 0.93)
  const pct = (a: number, b: number) => `${Math.round((a / b) * 100)}%`

  const funnel = [
    { label: 'Missed calls', value: missed, note: '100%' },
    { label: 'Eligible', value: eligible, note: pct(eligible, missed) },
    { label: 'Recovery texts sent', value: texts, note: pct(texts, eligible) + ' of eligible' },
    { label: 'Customer replies', value: replies, note: pct(replies, texts) + ' of sent' },
  ]

  const suppression = [
    { reason: 'On exclusions list', count: Math.round((missed - texts) * 0.4) },
    { reason: 'Landline / not textable', count: Math.round((missed - texts) * 0.3) },
    { reason: 'Recently texted (cooldown)', count: Math.round((missed - texts) * 0.2) },
    { reason: 'Opted out', count: Math.round((missed - texts) * 0.1) },
  ]
  const suppressedTotal = suppression.reduce((s, r) => s + r.count, 0) || 1

  return (
    <>
      <PageHeader
        title="Analytics"
        description="How missed-call recovery turns lost calls into conversations."
        actions={<Segmented label="Date range" options={Object.keys(ranges)} value={range} onChange={setRange} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Missed calls" value={String(missed)} icon={PhoneMissed} href="/mctb/missed-calls" />
        <StatCard label="Recovery texts sent" value={String(texts)} icon={Send} href="/mctb/missed-calls" />
        <StatCard label="Customers replied" value={String(replies)} icon={MessageSquareReply} href="/mctb/conversations" />
        <StatCard label="Reply rate" value={pct(replies, texts)} icon={Percent} delta={{ value: '+4 pts', positive: true }} />
      </div>

      <Panel title="Recovery funnel">
        <ol className="grid gap-3 sm:grid-cols-4">
          {funnel.map((f, i) => (
            <li key={f.label} className="flex flex-col gap-2">
              <div className="h-24 overflow-hidden rounded-lg bg-muted">
                <div
                  className="h-full rounded-lg bg-gradient-to-t from-primary to-[oklch(0.66_0.2_285)]"
                  style={{ opacity: 1 - i * 0.15, width: `${(f.value / missed) * 100}%` }}
                />
              </div>
              <span className="text-xl font-semibold tabular-nums">{f.value}</span>
              <span className="text-sm">{f.label}</span>
              <span className="text-xs text-muted-foreground">{f.note}</span>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Missed calls">
          <TrendBars data={data} dataKey="missed" config={{ missed: { label: 'Missed', color: 'var(--chart-4)' } }} />
        </Panel>
        <Panel title="Recovery texts">
          <TrendBars data={data} dataKey="texts" config={{ texts: { label: 'Texts', color: 'var(--chart-1)' } }} />
        </Panel>
        <Panel title="Replies">
          <TrendBars data={data} dataKey="replies" config={{ replies: { label: 'Replies', color: 'var(--chart-2)' } }} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Outcomes & delivery" bodyClassName="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[
            ['Delivery failures', '2'],
            ['Booking links sent', String(Math.round(texts * 0.6))],
            ['Callback requests', String(Math.round(replies * 0.3))],
            ['AI-assisted', String(Math.round(replies * 0.8))],
            ['Link clicks', String(Math.round(texts * 0.34))],
            ['Opt-outs', '1'],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1 rounded-lg border p-3">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-lg font-semibold tabular-nums">{value}</span>
            </div>
          ))}
        </Panel>

        <Panel title="Why some callers weren’t texted" bodyClassName="p-0">
          <table className="w-full">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className={th}>Reason</th>
                <th className={`${th} text-right`}>Count</th>
                <th className={`${th} text-right`}>%</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {suppression.map((r) => (
                <tr key={r.reason}>
                  <td className={td}>{r.reason}</td>
                  <td className={`${td} text-right tabular-nums`}>{r.count}</td>
                  <td className={`${td} text-right text-muted-foreground tabular-nums`}>{Math.round((r.count / suppressedTotal) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Definitions" className="lg:col-span-2">
          <dl className="grid gap-4 sm:grid-cols-2">
            {[
              ['Eligible', 'Missed calls from textable numbers that are not excluded or in cooldown.'],
              ['Recovery texts sent', 'Eligible calls that received a text back from your business line.'],
              ['Customer replies', 'Conversations where the customer sent at least one reply.'],
              ['Reply rate', 'Customer replies divided by recovery texts sent.'],
            ].map(([t, d]) => (
              <div key={t} className="flex flex-col gap-1">
                <dt className="text-sm font-medium">{t}</dt>
                <dd className="text-sm text-muted-foreground text-pretty">{d}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Voicemail">
          <div className="flex h-full flex-col justify-between gap-4">
            <div>
              <p className="text-3xl font-semibold tabular-nums">{Math.round(missed * 0.18)}</p>
              <p className="text-sm text-muted-foreground">voicemails left in this period</p>
            </div>
            <TextLink href="/mctb/voicemail">Open voicemail</TextLink>
          </div>
        </Panel>
      </div>
    </>
  )
}
