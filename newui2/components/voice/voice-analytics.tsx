'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BookOpen, ChevronDown } from 'lucide-react'
import { Callout, Panel, StatCard, TextLink } from '@/components/app/primitives'
import { Segmented } from '@/components/app/tab-nav'
import { TrendArea } from '@/components/app/charts'
import { Progress } from '@/components/ui/progress'
import { voiceVolume } from '@/lib/data'

const ranges = { '7 days': 7, '30 days': 30, '90 days': 90 } as const
type Range = keyof typeof ranges

const outcomes = [
  { label: 'Appointments booked', value: 61, pct: 21 },
  { label: 'Leads captured', value: 47, pct: 17 },
  { label: 'Messages taken', value: 58, pct: 20 },
  { label: 'Transfers', value: 39, pct: 14 },
  { label: 'Questions answered', value: 132, pct: 46 },
]

const sentiment = [
  { label: 'Positive', pct: 64, color: 'bg-success' },
  { label: 'Neutral', pct: 27, color: 'bg-chart-2' },
  { label: 'Negative', pct: 6, color: 'bg-destructive' },
  { label: 'Unknown', pct: 3, color: 'bg-muted-foreground/40' },
]

export function VoiceAnalytics() {
  const [range, setRange] = useState<Range>('30 days')
  const data = voiceVolume(ranges[range])
  const scale = ranges[range] / 7

  return (
    <>
      <div className="flex justify-end">
        <Segmented label="Date range" options={Object.keys(ranges)} value={range} onChange={(v) => setRange(v as Range)} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Calls" value={String(Math.round(284 * scale))} />
        <StatCard label="Appointments" value={String(Math.round(61 * scale))} />
        <StatCard label="Transfers answered" value={String(Math.round(33 * scale))} />
        <StatCard label="Callbacks" value={String(Math.round(23 * scale))} />
        <StatCard label="Avg. duration" value="2:28" />
        <StatCard label="Voicemail" value={String(Math.round(9 * scale))} />
      </div>

      <Callout
        tone="primary"
        icon={BookOpen}
        title="2 questions your receptionist couldn’t answer"
        action={<TextLink href="/voice/knowledge#knowledge-gaps">Review gaps</TextLink>}
      >
        Adding answers improves booking rates by resolving questions on the first call.
      </Callout>

      <Panel title="Call volume over time" description="Calls answered and appointments booked">
        <TrendArea
          data={data}
          keys={['calls', 'booked']}
          config={{ calls: { label: 'Calls', color: 'var(--chart-1)' }, booked: { label: 'Booked', color: 'var(--chart-2)' } }}
          height={260}
        />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Call outcomes" description="A call can have multiple outcomes" className="lg:col-span-2" bodyClassName="flex flex-col gap-4">
          {outcomes.map((o) => (
            <div key={o.label} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm">
                <span>{o.label}</span>
                <span className="font-medium tabular-nums">
                  {Math.round(o.value * scale)} <span className="text-muted-foreground">· {o.pct}%</span>
                </span>
              </div>
              <Progress value={o.pct * 2} aria-label={o.label} />
            </div>
          ))}
        </Panel>

        <Panel title="Caller sentiment" description="From 241 analyzed calls">
          <div className="flex h-3 overflow-hidden rounded-full" aria-hidden="true">
            {sentiment.map((s) => (
              <span key={s.label} className={s.color} style={{ width: `${s.pct}%` }} />
            ))}
          </div>
          <ul className="mt-4 flex flex-col gap-2.5">
            {sentiment.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-sm">
                <span className={`size-2 rounded-full ${s.color}`} aria-hidden="true" />
                <span className="flex-1">{s.label}</span>
                <span className="font-medium tabular-nums">{s.pct}%</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Receptionist performance" bodyClassName="grid grid-cols-3 gap-4">
          {[
            ['Median response', '0.62s'],
            ['Transfers failed', '4'],
            ['Voicemail (inbound)', String(Math.round(9 * scale))],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{k}</span>
              <span className="text-xl font-semibold tabular-nums">{v}</span>
            </div>
          ))}
        </Panel>
        <Panel title="Usage" action={<Link href="/settings/billing" className="text-sm font-medium text-primary">Billing →</Link>} bodyClassName="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm">
              <span>AI minutes</span>
              <span className="tabular-nums">
                1,412 <span className="text-muted-foreground">/ 2,000</span>
              </span>
            </div>
            <Progress value={70} aria-label="AI minutes used" />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm">
              <span>Phone minutes</span>
              <span className="tabular-nums">
                1,688 <span className="text-muted-foreground">/ 3,000</span>
              </span>
            </div>
            <Progress value={56} aria-label="Phone minutes used" />
          </div>
        </Panel>
      </div>

      <details className="group rounded-xl border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold">
          Advanced
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="grid grid-cols-2 gap-4 border-t px-5 py-4 sm:grid-cols-4">
          {[
            ['Latency p50', '620 ms'],
            ['Latency p95', '1.14 s'],
            ['Interruptions / call', '0.8'],
            ['Silence timeouts', '12'],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{k}</span>
              <span className="text-base font-semibold tabular-nums">{v}</span>
            </div>
          ))}
        </div>
      </details>
    </>
  )
}
