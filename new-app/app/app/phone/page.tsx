import Link from 'next/link'
import { Bot, ChevronRight, Grid3x3, MessageSquareReply, Plus, Voicemail } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Page, PageHeader, Panel, Stat } from '@/components/app/page-primitives'
import { RoutingSummary } from '@/components/app/routing-summary'
import { StatusBadge } from '@/components/app/status'
import { RecentCalls } from '@/components/calls/recent-calls'
import { CALLS, CAMPAIGNS, LISTS, NUMBERS } from '@/lib/data'
import { formatDuration, formatPhone, formatWhen } from '@/lib/format'
import { phoneMetrics } from '@/lib/metrics'

export const metadata = { title: 'Phone' }

const NUMBER_STATUS = {
  active: { label: 'Active', tone: 'success' },
  partial: { label: 'Partially verified', tone: 'warning' },
  pending_verification: { label: 'Pending verification', tone: 'warning' },
  disconnected: { label: 'Disconnected', tone: 'danger' },
} as const

export default function PhoneOverview() {
  const m = phoneMetrics()
  const pending = CALLS.filter((c) => (c.outcome === 'voicemail' || c.callbackNeeded) && !c.handled).slice(0, 4)
  const campaign = CAMPAIGNS.find((c) => c.status === 'active')
  const list = LISTS.find((l) => l.id === campaign?.listId)

  return (
    <Page>
      <PageHeader
        eyebrow={<StatusBadge tone="success">Lines active</StatusBadge>}
        title="Phone"
        description={
          <>
            Default caller ID <span className="font-mono text-foreground">{formatPhone(NUMBERS[0].number)}</span> · Main line
          </>
        }
        actions={
          <>
            <Link href="/app/numbers" className={buttonVariants({ variant: 'outline' })}>
              <Plus />
              Set up number
            </Link>
            <Link href="/app/phone/dialer" className={buttonVariants()}>
              <Grid3x3 />
              Make call
            </Link>
          </>
        }
      />

      <section aria-label="Last 7 days" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Inbound" value={m.inbound} hint={`${m.uniqueCallers} unique callers`} href="/app/phone/calls?filter=incoming" />
        <Stat label="Outbound" value={m.outbound} hint="Dial attempts" href="/app/phone/calls?filter=outgoing" />
        <Stat label="Missed" value={m.missed} tone="danger" href="/app/phone/calls?filter=missed" />
        <Stat label="Voicemail" value={m.voicemail} tone="warning" href="/app/phone/calls?filter=voicemail" />
        <Stat label="Talk time" value={formatDuration(m.talkSec)} hint="Answered calls" />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <RecentCalls calls={CALLS.slice(0, 7)} basePath="/app/phone/calls" viewAllHref="/app/phone/calls" />
        </div>
        <div className="flex flex-col gap-6">
          <RoutingSummary manageHref="/app/phone/call-handling" />
          <Panel
            title="Needs follow-up"
            description={`${m.callbacksOpen} open callbacks`}
            actions={
              <Link href="/app/phone/calls?filter=voicemail" className="text-xs font-medium text-primary hover:underline">
                Voicemail
              </Link>
            }
            bodyClassName="p-0"
          >
            <ul className="divide-y">
              {pending.map((c) => (
                <li key={c.id}>
                  <Link href={`/app/phone/calls/${c.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/60">
                    <Voicemail className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium">{c.caller}</span>
                      <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {c.voicemail?.transcript ?? c.ai?.summary ?? 'Callback requested'}
                      </span>
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{formatWhen(c.startedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {campaign && (
          <Panel
            title="Power dialer"
            description={`${campaign.name} · ${list?.name}`}
            actions={<StatusBadge tone="success">Active</StatusBadge>}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold tabular">{campaign.completedPct}%</span>
                <span className="text-xs text-muted-foreground">{campaign.attempts} attempts</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={campaign.completedPct} aria-valuemin={0} aria-valuemax={100} aria-label="Campaign progress">
                <div className="h-full rounded-full bg-primary" style={{ width: `${campaign.completedPct}%` }} />
              </div>
              <Link href="/app/phone/power-dialer" className={buttonVariants({ variant: 'outline', className: 'mt-1' })}>
                Continue session
              </Link>
            </div>
          </Panel>
        )}

        <Panel title="Numbers" actions={<Link href="/app/numbers" className="text-xs font-medium text-primary hover:underline">Manage</Link>} bodyClassName="p-0">
          <ul className="divide-y">
            {NUMBERS.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{n.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{formatPhone(n.number)}</span>
                </span>
                <StatusBadge tone={NUMBER_STATUS[n.status].tone}>{NUMBER_STATUS[n.status].label}</StatusBadge>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Works with Phone">
          <div className="flex flex-col gap-2">
            {[
              { icon: Bot, title: 'AI Receptionist', body: 'Answering after-hours and overflow on Main line', href: '/app/receptionist/call-handling' },
              { icon: MessageSquareReply, title: 'Missed Call Text Back', body: 'Texts consenting callers when calls go unanswered', href: '/app/mctb/recovery' },
            ].map((p) => (
              <Link key={p.title} href={p.href} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/60">
                <span className="flex size-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <p.icon className="size-4" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">{p.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{p.body}</span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </Page>
  )
}
