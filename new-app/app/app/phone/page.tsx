import Link from 'next/link'
import { Bot, ChevronRight, Grid3x3, MessageSquareReply, Plus, Voicemail } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Page, PageHeader, Panel, Stat } from '@/components/app/page-primitives'
import { RoutingSummary } from '@/components/app/routing-summary'
import { StatusBadge } from '@/components/app/status'
import { RecentCalls } from '@/components/calls/recent-calls'
import { formatDuration, formatPhone, formatWhen } from '@/lib/format'
import { mapPhoneCallDtoToCall } from '@/lib/phone-ui-map'
import { getOverviewMetrics } from '@/lib/server/phone/analytics'
import { listCalls } from '@/lib/server/phone/calls-service'
import { listCampaigns } from '@/lib/server/phone/power-dialer'
import { getPhoneReadiness } from '@/lib/server/phone/readiness'
import { loadOwnedNumbers } from '@/lib/server/numbers/inventory'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const metadata = { title: 'Phone' }

/** Avoid static prerender at build time (DB pool + live metrics). */
export const dynamic = 'force-dynamic'

const NUMBER_STATUS = {
  active: { label: 'Active', tone: 'success' as const },
  pending: { label: 'Pending verification', tone: 'warning' as const },
  disconnected: { label: 'Disconnected', tone: 'danger' as const },
}

export default async function PhoneOverview() {
  const workspaceId = await resolveWorkspaceId()
  const [m, readiness, recentRes, campaigns, owned] = await Promise.all([
    getOverviewMetrics(workspaceId),
    getPhoneReadiness(workspaceId),
    listCalls(workspaceId, { limit: 7, page: 0 }),
    listCampaigns(workspaceId),
    loadOwnedNumbers(workspaceId),
  ])

  const recentCalls = recentRes.data.map(mapPhoneCallDtoToCall)
  const pending = recentCalls.filter((c) => (c.outcome === 'voicemail' || c.callbackNeeded) && !c.handled).slice(0, 4)
  const campaign = campaigns.find((c) => c.status === 'active')
  const defaultNumber = readiness.defaultCallerId || owned[0]?.number

  return (
    <Page>
      <PageHeader
        eyebrow={
          <StatusBadge tone={readiness.telnyxConfigured ? 'success' : 'warning'}>
            {readiness.telnyxConfigured ? 'Lines active' : 'Needs Telnyx setup'}
          </StatusBadge>
        }
        title="Phone"
        description={
          defaultNumber ? (
            <>
              Default caller ID <span className="font-mono text-foreground">{formatPhone(defaultNumber)}</span>
            </>
          ) : (
            'Add a number to start calling'
          )
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
        <Stat label="Inbound" value={m.inbound} hint={`${m.uniqueCallers} unique callers`} href="/app/phone/calls?filter=inbound" />
        <Stat label="Outbound" value={m.outbound} hint="Dial attempts" href="/app/phone/calls?filter=outbound" />
        <Stat label="Missed" value={m.missed} tone="danger" href="/app/phone/calls?filter=missed" />
        <Stat label="Voicemail" value={m.voicemail} tone="warning" href="/app/phone/calls?filter=voicemail" />
        <Stat label="Talk time" value={formatDuration(m.talkSec)} hint="Answered calls" />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <RecentCalls calls={recentCalls} basePath="/app/phone/calls" viewAllHref="/app/phone/calls" />
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
                        {c.voicemail?.transcript ?? 'Callback requested'}
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
            description={campaign.name}
            actions={<StatusBadge tone="success">Active</StatusBadge>}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold tabular">{campaign.completedPct}%</span>
                <span className="text-xs text-muted-foreground">{campaign.attempts} attempts</span>
              </div>
              <Link href="/app/phone/power-dialer" className={buttonVariants({ variant: 'outline', className: 'mt-1' })}>
                Continue session
              </Link>
            </div>
          </Panel>
        )}

        <Panel title="Numbers" actions={<Link href="/app/numbers" className="text-xs font-medium text-primary hover:underline">Manage</Link>} bodyClassName="p-0">
          <ul className="divide-y">
            {owned.slice(0, 5).map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{n.nickname}</span>
                  <span className="font-mono text-xs text-muted-foreground">{formatPhone(n.number)}</span>
                </span>
                <StatusBadge tone={NUMBER_STATUS[n.status as keyof typeof NUMBER_STATUS]?.tone ?? 'neutral'}>
                  {NUMBER_STATUS[n.status as keyof typeof NUMBER_STATUS]?.label ?? n.status}
                </StatusBadge>
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
