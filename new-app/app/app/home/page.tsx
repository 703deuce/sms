import Link from 'next/link'
import { ArrowRight, Bot, CheckCircle2, Circle, Phone } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Page, PageHeader, Panel, Stat } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { RecentCalls } from '@/components/calls/recent-calls'
import { BUSINESS, CALLS, INTEGRATIONS, NUMBERS } from '@/lib/data'
import { aiMetrics, inboxMetrics, mctbMetrics, phoneMetrics } from '@/lib/metrics'

export const metadata = { title: 'Home' }

const ONBOARDING = [
  { label: 'Verify forwarding on every line', href: '/app/numbers', done: false },
  { label: 'Add insurance FAQs to the knowledge base', href: '/app/receptionist/knowledge', done: false },
  { label: 'Reconnect Calendly', href: '/app/integrations', done: false },
  { label: 'Set business hours', href: '/app/phone/call-handling', done: true },
  { label: 'Invite your front-desk team', href: '/app/settings?tab=team', done: true },
]

export default function HomePage() {
  const p = phoneMetrics()
  const a = aiMetrics()
  const m = mctbMetrics()
  const inbox = inboxMetrics()
  const attentionCalls = CALLS.filter((c) => c.callbackNeeded && !c.handled)
  const brokenIntegrations = INTEGRATIONS.filter((i) => i.status === 'error').length

  const products = [
    {
      name: 'Phone System',
      icon: Phone,
      href: '/app/phone',
      state: `${NUMBERS.length} numbers`,
      lines: [
        `${p.inbound} inbound`,
        `${p.missed} missed`,
        `${p.callbacksOpen} callbacks open`,
        `MCTB: ${m.sent} texts · ${m.replied} replied`,
      ],
    },
    {
      name: 'AI Receptionist',
      icon: Bot,
      href: '/app/receptionist',
      state: 'Live after hours',
      lines: [`${a.handled} handled`, `${a.booked} booked`, `${a.needsAttention} need follow-up`],
    },
  ]

  return (
    <Page>
      <PageHeader
        eyebrow={BUSINESS.workspace}
        title="Good afternoon, Maya"
        description="Everything that needs you across phone, AI and text-back — each call counted once."
      />

      <section aria-label="Needs attention" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Callbacks open" value={attentionCalls.length} tone="warning" href="/app/phone/calls?filter=callback" />
        <Stat label="Unread messages" value={inbox.unread} href="/app/inbox" />
        <Stat label="Replies waiting" value={inbox.needsReply} tone="warning" href="/app/inbox" />
        <Stat label="Integration issues" value={brokenIntegrations} tone={brokenIntegrations ? 'danger' : 'default'} href="/app/integrations" />
      </section>

      <section aria-label="Products" className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {products.map((prod) => (
          <article key={prod.name} className="flex flex-col gap-4 rounded-xl surface p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <prod.icon className="size-5" />
              </span>
              <StatusBadge tone="success">{prod.state}</StatusBadge>
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="font-semibold">{prod.name}</h2>
              <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground">
                {prod.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
            <Link href={prod.href} className={buttonVariants({ variant: 'outline', className: 'mt-auto w-full' })}>
              Open
              <ArrowRight />
            </Link>
          </article>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentCalls calls={CALLS.slice(0, 8)} basePath="/app/calls" title="Recent activity" viewAllHref="/app/phone/calls" />
        </div>
        <Panel title="Setup checklist" description={`${ONBOARDING.filter((o) => o.done).length} of ${ONBOARDING.length} complete`}>
          <ul className="flex flex-col gap-1">
            {ONBOARDING.map((o) => (
              <li key={o.label}>
                <Link href={o.href} className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-muted">
                  {o.done ? (
                    <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Done" />
                  ) : (
                    <Circle className="size-4 shrink-0 text-muted-foreground" aria-label="To do" />
                  )}
                  <span className={o.done ? 'text-muted-foreground line-through' : ''}>{o.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </Page>
  )
}
