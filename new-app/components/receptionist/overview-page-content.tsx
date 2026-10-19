'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AlertTriangle, BookOpen, CalendarCheck } from 'lucide-react'
import { OverviewStatus } from '@/components/receptionist/overview-status'
import { Page, PageHeader, Panel, Stat } from '@/components/app/page-primitives'
import { RoutingSummary } from '@/components/app/routing-summary'
import { AI_OUTCOME, StatusBadge } from '@/components/app/status'
import { RecentCalls } from '@/components/calls/recent-calls'
import type { Call } from '@/lib/data'
import { formatDuration, formatWhen } from '@/lib/format'
import { fetchReceptionistOverview } from '@/lib/receptionist-api'

export function ReceptionistOverviewContent() {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    handled: 0,
    booked: 0,
    transferred: 0,
    needsAttention: 0,
    avgSec: 0,
    openGaps: 0,
  })
  const [recentCalls, setRecentCalls] = useState<Call[]>([])
  const [readiness, setReadiness] = useState({
    calendarConnected: false,
    failedSources: 0,
  })

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchReceptionistOverview()
        setMetrics(data.metrics)
        setRecentCalls(data.recentCalls)
        setReadiness(data.readiness)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const attention = recentCalls.filter((c) => c.ai?.followUp === 'open').slice(0, 4)

  return (
    <Page>
      <PageHeader
        title="AI Receptionist"
        description="Ava answers, books, transfers and takes messages. Edits stay in a draft until you publish."
      />
      <OverviewStatus />

      <section aria-label="Last 7 days" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Calls handled" value={loading ? '—' : metrics.handled} href="/app/receptionist/calls" />
        <Stat label="Booked" value={loading ? '—' : metrics.booked} tone="success" href="/app/receptionist/calls?filter=booked" />
        <Stat label="Transferred" value={loading ? '—' : metrics.transferred} href="/app/receptionist/calls?filter=transferred" />
        <Stat
          label="Needs attention"
          value={loading ? '—' : metrics.needsAttention}
          tone="warning"
          href="/app/receptionist/calls?filter=open"
        />
        <Stat label="Avg handle time" value={loading ? '—' : formatDuration(metrics.avgSec)} />
      </section>

      {readiness.failedSources > 0 && (
        <div role="status" className="flex flex-col gap-2 rounded-xl border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center">
          <AlertTriangle className="size-4 shrink-0 text-warning-foreground" aria-hidden />
          <p className="flex-1 text-sm">{readiness.failedSources} knowledge source(s) need attention.</p>
          <Link href="/app/receptionist/knowledge" className="text-sm font-medium text-primary hover:underline">
            Knowledge
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Panel title="Needs attention" description="Unresolved, failed, or callback requested" bodyClassName="p-0">
            <ul className="divide-y">
              {attention.length === 0 && (
                <li className="px-5 py-6 text-sm text-muted-foreground">No open follow-ups in recent calls.</li>
              )}
              {attention.map((c) => (
                <li key={c.id}>
                  <Link href={`/app/receptionist/calls/${c.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/60">
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium">{c.caller}</span>
                        {c.ai && <StatusBadge tone={AI_OUTCOME[c.ai.outcome].tone}>{AI_OUTCOME[c.ai.outcome].label}</StatusBadge>}
                      </span>
                      <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{c.ai?.summary}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatWhen(c.startedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          <RecentCalls
            calls={recentCalls.slice(0, 6)}
            basePath="/app/receptionist/calls"
            viewAllHref="/app/receptionist/calls"
            title="Recent AI calls"
            focus="receptionist"
          />
        </div>
        <div className="flex flex-col gap-6">
          <RoutingSummary title="When Ava answers" manageHref="/app/receptionist/call-handling" manageLabel="Coverage" />
          <Panel title="Readiness">
            <ul className="flex flex-col gap-3 text-sm">
              <li className="flex items-center gap-3">
                <CalendarCheck className="size-4 text-muted-foreground" aria-hidden />
                <span className="flex-1">Booking calendar</span>
                <StatusBadge tone={readiness.calendarConnected ? 'success' : 'danger'}>
                  {readiness.calendarConnected ? 'Connected' : 'Not connected'}
                </StatusBadge>
              </li>
              <li className="flex items-center gap-3">
                <BookOpen className="size-4 text-muted-foreground" aria-hidden />
                <span className="flex-1">Open knowledge gaps</span>
                <StatusBadge tone={metrics.openGaps ? 'warning' : 'success'}>{metrics.openGaps}</StatusBadge>
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </Page>
  )
}
