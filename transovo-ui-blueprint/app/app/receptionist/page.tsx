import Link from 'next/link'
import { AlertTriangle, BookOpen, CalendarCheck } from 'lucide-react'
import { OverviewStatus } from '@/components/receptionist/overview-status'
import { Page, PageHeader, Panel, Stat } from '@/components/app/page-primitives'
import { RoutingSummary } from '@/components/app/routing-summary'
import { AI_OUTCOME, StatusBadge } from '@/components/app/status'
import { RecentCalls } from '@/components/calls/recent-calls'
import { CALLS, GAPS, INTEGRATIONS, SOURCES } from '@/lib/data'
import { formatDuration, formatWhen } from '@/lib/format'
import { aiMetrics } from '@/lib/metrics'

export const metadata = { title: 'AI Receptionist' }

export default function ReceptionistOverview() {
  const m = aiMetrics()
  const aiCalls = CALLS.filter((c) => c.ai)
  const attention = aiCalls.filter((c) => c.ai?.followUp === 'open').slice(0, 4)
  const calendar = INTEGRATIONS.find((i) => i.id === 'google-calendar')
  const calendly = INTEGRATIONS.find((i) => i.id === 'calendly')
  const failedSource = SOURCES.find((s) => s.status === 'failed')

  return (
    <Page>
      <PageHeader
        title="AI Receptionist"
        description="Ava answers, books, transfers and takes messages. Edits stay in a draft until you publish."
      />
      <OverviewStatus />

      <section aria-label="Last 7 days" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Calls handled" value={m.handled} href="/app/receptionist/calls" />
        <Stat label="Booked" value={m.booked} tone="success" href="/app/receptionist/calls?filter=booked" />
        <Stat label="Transferred" value={m.transferred} href="/app/receptionist/calls?filter=transferred" />
        <Stat label="Needs attention" value={m.needsAttention} tone="warning" href="/app/receptionist/calls?filter=attention" />
        <Stat label="Avg handle time" value={formatDuration(m.avgSec)} />
      </section>

      {(calendly?.status === 'error' || failedSource) && (
        <div role="status" className="flex flex-col gap-2 rounded-xl border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center">
          <AlertTriangle className="size-4 shrink-0 text-warning-foreground" aria-hidden />
          <p className="flex-1 text-sm">
            {calendly?.status === 'error' && <>Calendly disconnected — booking links may fail. </>}
            {failedSource && <>“{failedSource.name}” failed to process.</>}
          </p>
          <div className="flex gap-3 text-sm font-medium">
            <Link href="/app/integrations" className="text-primary hover:underline">Integrations</Link>
            <Link href="/app/receptionist/knowledge" className="text-primary hover:underline">Knowledge</Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Panel title="Needs attention" description="Unresolved, failed, or callback requested" bodyClassName="p-0">
            <ul className="divide-y">
              {attention.map((c) => (
                <li key={c.id}>
                  <Link href={`/app/receptionist/calls/${c.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/60">
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium">{c.caller}</span>
                        <StatusBadge tone={AI_OUTCOME[c.ai!.outcome].tone}>{AI_OUTCOME[c.ai!.outcome].label}</StatusBadge>
                      </span>
                      <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{c.ai!.summary}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatWhen(c.startedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          <RecentCalls calls={aiCalls.slice(0, 6)} basePath="/app/receptionist/calls" viewAllHref="/app/receptionist/calls" title="Recent AI calls" focus="receptionist" />
        </div>
        <div className="flex flex-col gap-6">
          <RoutingSummary title="When Ava answers" manageHref="/app/receptionist/call-handling" manageLabel="Coverage" />
          <Panel title="Readiness">
            <ul className="flex flex-col gap-3 text-sm">
              <li className="flex items-center gap-3">
                <CalendarCheck className="size-4 text-muted-foreground" aria-hidden />
                <span className="flex-1">Booking calendar</span>
                <StatusBadge tone={calendar?.status === 'connected' ? 'success' : 'danger'}>{calendar?.status === 'connected' ? 'Connected' : 'Disconnected'}</StatusBadge>
              </li>
              <li className="flex items-center gap-3">
                <BookOpen className="size-4 text-muted-foreground" aria-hidden />
                <span className="flex-1">Knowledge sources</span>
                <StatusBadge tone={failedSource ? 'warning' : 'success'}>
                  {SOURCES.filter((s) => s.status === 'synced').length}/{SOURCES.length} synced
                </StatusBadge>
              </li>
              <li className="flex items-center gap-3">
                <AlertTriangle className="size-4 text-muted-foreground" aria-hidden />
                <span className="flex-1">Open knowledge gaps</span>
                <Link href="/app/receptionist/knowledge" className="text-xs font-medium text-primary hover:underline">{GAPS.length} to review</Link>
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </Page>
  )
}
