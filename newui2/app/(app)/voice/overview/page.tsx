import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, CalendarCheck, PhoneCall, PhoneIncoming, Settings2 } from 'lucide-react'
import { Panel, PageHeader, StatCard, StatusPill, TextLink } from '@/components/app/primitives'
import { CallsTable } from '@/components/app/tables'
import { buttonVariants } from '@/components/ui/button'
import { business, calls } from '@/lib/data'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'AI Receptionist Overview' }

const attention = [
  { label: '2 unanswered questions from callers this week', href: '/voice/knowledge#knowledge-gaps' },
  { label: 'Priya Natarajan requested a quote — no follow-up yet', href: '/voice/calls/c_1041' },
  { label: 'Google Calendar token expires in 3 days', href: '/integrations?tab=calendars' },
]

const dependencies = [
  { label: 'Phone line', status: 'Connected', tone: 'success' as const },
  { label: 'Google Calendar', status: 'Expiring soon', tone: 'warning' as const },
  { label: 'Transfer targets', status: '3 configured', tone: 'success' as const },
  { label: 'SMS sender', status: 'Registered', tone: 'success' as const },
]

export default function VoiceOverviewPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="How the receptionist is running, recent activity, and anything that needs your attention."
        actions={
          <Link href="/voice/receptionist" className={cn(buttonVariants({ variant: 'outline' }), 'h-9')}>
            <Settings2 aria-hidden="true" /> Manage receptionist
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="relative overflow-hidden rounded-xl border bg-sidebar p-6 text-sidebar-foreground lg:col-span-2">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[oklch(0.55_0.22_277/0.35)] blur-3xl"
          />
          <div className="relative flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.66_0.2_285)] to-[oklch(0.5_0.22_265)] text-lg font-semibold text-white">
                  {business.receptionist[0]}
                </span>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{business.receptionist}</h2>
                    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-success/15 px-2.5 text-xs font-medium text-[oklch(0.8_0.14_158)] ring-1 ring-inset ring-success/30">
                      <span className="size-1.5 rounded-full bg-success" aria-hidden="true" /> Active
                    </span>
                  </div>
                  <p className="text-sm text-sidebar-muted">{business.voice}</p>
                </div>
              </div>
              <Link href="/voice/receptionist" className="text-sm font-medium text-[oklch(0.82_0.1_277)] hover:underline underline-offset-4">
                Manage receptionist →
              </Link>
            </div>
            <p className="text-sm text-sidebar-muted">Published configuration is active · last published Sep 21, 2026</p>
            <dl className="grid gap-px overflow-hidden rounded-lg border border-sidebar-border bg-sidebar-border sm:grid-cols-4">
              {[
                ['Phone', business.line],
                ['Calendar', 'Google · 3 days left'],
                ['Business knowledge', '42 facts · 2 gaps'],
                ['Business hours', 'Mon–Sat, 7a–7p'],
              ].map(([k, v], i) => (
                <div key={k} className="flex flex-col gap-1 bg-sidebar px-4 py-3">
                  <dt className="text-xs text-sidebar-muted">{k}</dt>
                  <dd className={cn('text-sm font-medium', i === 1 && 'text-[oklch(0.82_0.14_70)]')}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <Panel title="Needs attention" description="3 items to review" bodyClassName="p-0">
          <ul className="divide-y">
            {attention.map((a) => (
              <li key={a.label}>
                <Link href={a.href} className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/50">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                  <span className="flex-1 text-sm">{a.label}</span>
                  <span className="text-xs font-medium whitespace-nowrap text-primary">Review →</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="metrics-heading">
        <div className="flex items-center justify-between">
          <h2 id="metrics-heading" className="text-sm font-semibold">
            Last 7 days
          </h2>
          <TextLink href="/voice/analytics">View analytics</TextLink>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Calls" value="284" delta={{ value: '+12%', positive: true }} sub="vs. previous 7 days" icon={PhoneIncoming} />
          <StatCard label="Appointments booked" value="61" delta={{ value: '+8%', positive: true }} sub="21% of calls" icon={CalendarCheck} />
          <StatCard label="Callbacks requested" value="23" delta={{ value: '-4%', positive: true }} sub="18 completed" icon={PhoneCall} />
        </div>
      </section>

      <Panel title="Recent calls" action={<TextLink href="/voice/calls">View all calls</TextLink>} bodyClassName="p-0">
        <CallsTable calls={calls.slice(0, 6)} />
      </Panel>

      <Panel title="Setup health" description="Services your receptionist depends on" bodyClassName="p-0">
        <ul className="grid divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          {dependencies.map((d) => (
            <li key={d.label} className="flex items-center justify-between gap-3 px-5 py-4">
              <span className="text-sm font-medium">{d.label}</span>
              <StatusPill tone={d.tone}>{d.status}</StatusPill>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
