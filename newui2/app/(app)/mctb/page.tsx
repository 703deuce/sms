import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, MessageSquareReply, MessagesSquare, PhoneMissed, Send, Sparkles, Wrench } from 'lucide-react'
import { Avatar, KeyValueRow, Panel, PageHeader, StatCard, StatusPill, TextLink } from '@/components/app/primitives'
import { MissedCallsCompactTable } from '@/components/app/tables'
import { buttonVariants } from '@/components/ui/button'
import { business, conversations, missedCalls } from '@/lib/data'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Missed Call Text Back' }

const attention = [
  { label: '3 customers are waiting on a reply', href: '/mctb/conversations?filter=needs_reply', tone: 'primary' as const },
  { label: '1 recovery text failed to deliver to (737) 555-0137', href: '/mctb/missed-calls/m_2205', tone: 'danger' as const },
  { label: 'Toll-free number verification is still pending', href: '/voice/numbers', tone: 'warning' as const },
]

const activity = [
  { text: 'Olivia Martinez replied to a recovery text', time: '2 min ago' },
  { text: 'Recovery text sent to Ben Carter', time: '18 min ago' },
  { text: 'Consent prompt played for (512) 555-0199', time: '42 min ago' },
  { text: 'AI Recovery collected service address from Aisha Rahman', time: '1 hr ago' },
]

export default function MctbOverviewPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        meta={<StatusPill tone="success">Active</StatusPill>}
        description="Every missed call gets a text back within seconds. Here’s how recovery is performing today."
        actions={
          <Link href="/mctb/setup" className={cn(buttonVariants({ variant: 'outline' }), 'h-9')}>
            <Wrench aria-hidden="true" /> Manage setup
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Missed calls" value="24" sub="Last 7 days" delta={{ value: '-8%', positive: true }} icon={PhoneMissed} href="/mctb/missed-calls" />
        <StatCard label="Recovery texts sent" value="21" sub="88% of missed calls" icon={Send} href="/mctb/missed-calls" />
        <StatCard label="Customer replies" value="11" sub="52% reply rate" delta={{ value: '+6%', positive: true }} icon={MessageSquareReply} href="/mctb/conversations" />
        <StatCard label="Needs reply" value="3" sub="Oldest 1 day ago" icon={MessagesSquare} href="/mctb/conversations?filter=needs_reply" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className="relative overflow-hidden rounded-xl border bg-sidebar p-5 text-sidebar-foreground">
            <div
              className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full bg-[oklch(0.6_0.2_280)] opacity-25 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/25 text-[oklch(0.85_0.1_277)]">
                <Sparkles className="size-5" aria-hidden="true" />
              </span>
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">AI Recovery is on</p>
                  <span className="rounded-full bg-success/20 px-2 text-[11px] font-medium text-[oklch(0.82_0.12_158)]">5 fields collected</span>
                </div>
                <p className="text-sm text-sidebar-foreground/70 text-pretty">
                  Replies are handled by AI until a teammate takes over. It collects name, need, location, urgency and callback time.
                </p>
              </div>
              <Link
                href="/mctb/ai-recovery"
                className="inline-flex h-8 items-center rounded-md bg-sidebar-foreground px-3 text-xs font-semibold text-sidebar transition-opacity hover:opacity-90"
              >
                Manage
              </Link>
            </div>
          </section>

          <Panel title="Needs attention" description="Items that could cost you a customer." bodyClassName="p-0">
            <ul className="divide-y">
              {attention.map((a) => (
                <li key={a.label}>
                  <Link href={a.href} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-muted/50">
                    <AlertTriangle
                      className={cn(
                        'size-4 shrink-0',
                        a.tone === 'danger' ? 'text-destructive' : a.tone === 'warning' ? 'text-warning' : 'text-primary',
                      )}
                      aria-hidden="true"
                    />
                    <span className="flex-1">{a.label}</span>
                    <span className="text-xs font-medium text-primary">Review</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Recent missed calls" action={<TextLink href="/mctb/missed-calls">View all</TextLink>} bodyClassName="p-0">
            <MissedCallsCompactTable rows={missedCalls.slice(0, 5)} />
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Recent conversations" action={<TextLink href="/mctb/conversations">Open inbox</TextLink>} bodyClassName="p-0">
            <ul className="divide-y">
              {conversations.slice(0, 4).map((c) => (
                <li key={c.id}>
                  <Link href={`/mctb/conversations?conversation=${c.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/50">
                    <Avatar name={c.name} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{c.time}</span>
                      </div>
                      <span className="truncate text-xs text-muted-foreground">{c.preview}</span>
                    </div>
                    {c.needsReply && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Needs reply" />}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Setup status" action={<TextLink href="/mctb/setup">Setup</TextLink>} bodyClassName="py-0 divide-y">
            <KeyValueRow label="Business line" value={business.line} href="/mctb/setup/phone" />
            <KeyValueRow label="Forwarding" value="Verified" tone="success" href="/mctb/setup/phone" />
            <KeyValueRow label="Sender" value="Registered" tone="success" href="/mctb/setup/text-back" />
            <KeyValueRow label="Consent mode" value="Press 1" href="/mctb/setup/consent" />
            <KeyValueRow label="Recovery pause" value="Not paused" tone="neutral" href="/mctb/setup/recovery" />
          </Panel>

          <Panel title="Recent activity">
            <ol className="flex flex-col gap-4">
              {activity.map((a) => (
                <li key={a.text} className="flex gap-3">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  <div className="flex flex-col">
                    <span className="text-sm">{a.text}</span>
                    <span className="text-xs text-muted-foreground">{a.time}</span>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  )
}
