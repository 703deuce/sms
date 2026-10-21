'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AlertTriangle, BookOpen, CalendarCheck, MessageSquare, PhoneForwarded, Route } from 'lucide-react'
import { OverviewStatus } from '@/components/receptionist/overview-status'
import { OperatingModeSelector } from '@/components/receptionist/operating-mode-selector'
import { Page, PageHeader, Panel, Stat } from '@/components/app/page-primitives'
import { RoutingSummary } from '@/components/app/routing-summary'
import { AI_OUTCOME, StatusBadge } from '@/components/app/status'
import { RecentCalls } from '@/components/calls/recent-calls'
import type { Call } from '@/lib/data'
import { formatDuration, formatWhen } from '@/lib/format'
import { fetchReceptionistOverview } from '@/lib/receptionist-api'
import {
  AI_RECEPTIONIST_PRODUCT_TITLE,
  CONVERSATIONAL_IVR_MODE_DESCRIPTION,
  FULL_RECEPTIONIST_MODE_DESCRIPTION,
  isConversationalIvrEditor,
} from '@/lib/receptionist/runtime-profile'
import { useAgent } from '@/components/providers/agent-provider'

export function ReceptionistOverviewContent() {
  const { draft } = useAgent()
  const ivr = isConversationalIvrEditor(draft)
  const schedulingEnabled =
    !ivr &&
    (draft.capabilities.book ||
      draft.capabilities.reschedule ||
      draft.capabilities.cancel ||
      draft.appointments.strategy !== 'none')

  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    handled: 0,
    booked: 0,
    transferred: 0,
    callbacks: 0,
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
  const routeCount = (draft.conversationalRoutes ?? []).filter((r) => r.enabled).length
  const messageOn = draft.messageTaking?.enabled ?? draft.messages.takeMessage
  const intakeLabel = ivr ? 'Message taking' : 'Caller intake'

  return (
    <Page>
      <PageHeader
        title={AI_RECEPTIONIST_PRODUCT_TITLE}
        description={ivr ? CONVERSATIONAL_IVR_MODE_DESCRIPTION : FULL_RECEPTIONIST_MODE_DESCRIPTION}
      />
      <Panel title="Operating mode" description="Applies to published calls after you review and publish.">
        <OperatingModeSelector compact />
      </Panel>
      <OverviewStatus />

      <section
        aria-label="Call outcomes"
        className={`grid grid-cols-2 gap-3 ${ivr ? 'md:grid-cols-4' : schedulingEnabled ? 'md:grid-cols-4 lg:grid-cols-7' : 'md:grid-cols-5'}`}
      >
        <Stat label="Calls handled" value={loading ? '—' : metrics.handled} href="/app/receptionist/calls" />
        <Stat label="Transferred" value={loading ? '—' : metrics.transferred} href="/app/receptionist/calls?filter=transferred" />
        {!ivr && (
          <Stat
            label="Callback requests"
            value={loading ? '—' : metrics.callbacks}
            href="/app/receptionist/calls?filter=open"
          />
        )}
        {schedulingEnabled && (
          <Stat
            label="Appointments booked"
            value={loading ? '—' : metrics.booked}
            tone="success"
            href="/app/receptionist/calls?filter=booked"
          />
        )}
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
            Business Knowledge
          </Link>
        </div>
      )}

      <Panel
        title="How your calls are handled"
        description={
          ivr
            ? 'Phone decides when the AI answers → route, answer, or message.'
            : 'Phone decides when the AI answers → knowledge, intake, appointments, transfer, or message.'
        }
      >
        <RoutingSummary title="Phone answering policy" manageHref="/app/phone/call-handling" manageLabel="Phone routing" />
      </Panel>

      <Panel title="Setup readiness">
        <ul className="flex flex-col divide-y text-sm">
          <li className="flex items-center gap-3 py-3">
            <BookOpen className="size-4 text-muted-foreground" aria-hidden />
            <Link href="/app/receptionist/knowledge" className="flex-1 font-medium hover:underline">Business knowledge</Link>
            <StatusBadge tone={metrics.openGaps ? 'warning' : 'success'}>
              {metrics.openGaps ? `${metrics.openGaps} gaps` : 'Ready'}
            </StatusBadge>
          </li>
          <li className="flex items-center gap-3 py-3">
            <Route className="size-4 text-muted-foreground" aria-hidden />
            <Link href="/app/receptionist/call-routing" className="flex-1 font-medium hover:underline">Call routing</Link>
            <StatusBadge tone={routeCount ? 'success' : 'warning'}>{routeCount ? `${routeCount} routes` : 'Add routes'}</StatusBadge>
          </li>
          <li className="flex items-center gap-3 py-3">
            <MessageSquare className="size-4 text-muted-foreground" aria-hidden />
            <Link href="/app/receptionist/message-taking" className="flex-1 font-medium hover:underline">{intakeLabel}</Link>
            <StatusBadge tone={messageOn ? 'success' : 'neutral'}>{messageOn ? 'Enabled' : 'Off'}</StatusBadge>
          </li>
          {!ivr && draft.capabilities.book && draft.appointments.strategy === 'live' && (
            <li className="flex items-center gap-3 py-3">
              <CalendarCheck className="size-4 text-muted-foreground" aria-hidden />
              <Link href="/app/receptionist/appointments" className="flex-1 font-medium hover:underline">Calendar & booking</Link>
              <StatusBadge tone={readiness.calendarConnected ? 'success' : 'warning'}>
                {readiness.calendarConnected ? 'Connected' : 'Connect calendar'}
              </StatusBadge>
            </li>
          )}
          <li className="flex items-center gap-3 py-3">
            <PhoneForwarded className="size-4 text-muted-foreground" aria-hidden />
            <span className="flex-1 font-medium">Phone assignment</span>
            <Link href="/app/receptionist/call-routing" className="text-xs font-medium text-primary hover:underline">Manage</Link>
          </li>
        </ul>
      </Panel>

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
            title="Recent calls"
            focus="receptionist"
          />
        </div>
      </div>
    </Page>
  )
}
