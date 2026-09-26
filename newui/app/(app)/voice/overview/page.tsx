import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, CalendarCheck, Globe, Phone, Settings2 } from 'lucide-react'
import { Page, PageHeader, Panel, Pill, Rows, Stat, TextLink } from '@/components/app/kit'
import { ButtonLink } from '@/components/app/button-link'
import { RecentCallsTable } from '@/components/voice/recent-calls-table'
import { BUSINESS, VOICE_CALLS } from '@/lib/data'

export const metadata: Metadata = { title: 'Receptionist Overview' }

const ATTENTION = [
  { text: '3 unanswered questions from callers this week', href: '/voice/knowledge' },
  { text: 'Derek Hall requested a callback after 4 PM', href: '/voice/calls/c_1041' },
]

const DEPENDENCIES = [
  { icon: Phone, label: 'Phone line', value: 'Forwarding verified', tone: 'success' as const },
  { icon: CalendarCheck, label: 'Calendar', value: 'Google Calendar synced', tone: 'success' as const },
  { icon: Globe, label: 'Website import', value: 'Last crawled 2 days ago', tone: 'neutral' as const },
  { icon: Settings2, label: 'Transfers', value: '1 on-call target unverified', tone: 'warning' as const },
]

export default function VoiceOverviewPage() {
  return (
    <Page>
      <PageHeader
        title="Overview"
        description="How your receptionist is running, recent activity, and anything that needs your attention."
        actions={<ButtonLink href="/voice/receptionist" variant="outline">Manage receptionist</ButtonLink>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title={
            <span className="flex items-center gap-2">
              AI Receptionist <Pill tone="success">Active</Pill>
            </span>
          }
          description="Published configuration is active"
          action={<TextLink href="/voice/receptionist">Manage receptionist</TextLink>}
        >
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-accent text-base font-semibold text-accent-foreground">
              A
            </span>
            <div>
              <p className="text-sm font-semibold">Ava</p>
              <p className="text-xs text-muted-foreground">Warm · American English · Female voice</p>
            </div>
          </div>
          <Rows
            items={[
              { label: 'Phone', value: <span className="font-mono text-xs">{BUSINESS.line}</span>, href: '/voice/numbers' },
              { label: 'Calendar', value: 'Google Calendar · Service team', href: '/integrations/calendars' },
              { label: 'Business knowledge', value: <Pill tone="warning">3 gaps</Pill>, href: '/voice/knowledge' },
              { label: 'Business hours', value: 'Mon–Fri 7a–6p · Sat 8a–2p', href: '/voice/call-handling' },
            ]}
          />
        </Panel>

        <Panel title="Needs attention" description={`${ATTENTION.length} items to review`}>
          <ul className="flex flex-col gap-2">
            {ATTENTION.map((item) => (
              <li key={item.text}>
                <Link
                  href={item.href}
                  className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm transition hover:bg-warning/10"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                  <span className="flex-1 text-pretty">{item.text}</span>
                  <span className="shrink-0 text-xs font-medium text-primary">Review</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-6 mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          Last 7 days
        </h2>
        <TextLink href="/voice/analytics">View analytics</TextLink>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Calls" value="308" delta={12} hint="94% answered by AI" href="/voice/calls" />
        <Stat label="Appointments booked" value="70" delta={8} hint="Booked directly to calendar" href="/voice/calls" />
        <Stat label="Callbacks requested" value="14" delta={-5} hint="4 still open" href="/voice/calls" />
      </div>

      <Panel
        className="mt-6"
        title="Recent calls"
        action={<TextLink href="/voice/calls">View all calls</TextLink>}
        bodyClassName="p-0"
      >
        <RecentCallsTable calls={VOICE_CALLS.slice(0, 6)} />
      </Panel>

      <h2 className="mt-8 mb-3 text-sm font-semibold">Setup health</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {DEPENDENCIES.map((dep) => (
          <div key={dep.label} className="flex items-start gap-3 rounded-xl border bg-card p-4">
            <dep.icon className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{dep.label}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{dep.value}</p>
            </div>
            <Pill tone={dep.tone}>{dep.tone === 'success' ? 'OK' : dep.tone === 'warning' ? 'Fix' : 'Info'}</Pill>
          </div>
        ))}
      </div>
    </Page>
  )
}
