'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Calendar, Send } from 'lucide-react'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import {
  Callout,
  Page,
  PageHeader,
  Panel,
  Stat,
  TextLink,
} from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'

type OverviewCounts = {
  todayTotal: number
  reminderFailed: number
}

type WorkspaceStats = {
  scheduledCount: number
  sentToday: number
  failed7d: number
}

type CalendarRow = { id: string; provider: string; status: string; lastSyncAt?: string | null }

export function AppointmentRemindersOverviewPage() {
  const [counts, setCounts] = useState<OverviewCounts | null>(null)
  const [stats, setStats] = useState<WorkspaceStats | null>(null)
  const [calendars, setCalendars] = useState<CalendarRow[]>([])
  const [activity, setActivity] = useState<
    Array<{ id: string; at: string; customerLabel: string; reminderLabel: string; status: string }>
  >([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [overviewRes, workspaceRes, calRes] = await Promise.all([
        fetch('/api/appointments/overview'),
        fetch('/api/appointments/reminders/workspace'),
        fetch('/api/integrations/calendars'),
      ])
      if (!overviewRes.ok || !workspaceRes.ok) throw new Error('load failed')
      const overviewJson = await overviewRes.json()
      const workspaceJson = await workspaceRes.json()
      const calJson = calRes.ok ? await calRes.json() : { data: [] }
      setCounts(overviewJson.data?.counts ?? null)
      setStats(workspaceJson.stats ?? null)
      setActivity((workspaceJson.activity ?? []).slice(0, 6))
      setCalendars(
        (calJson.data ?? []).filter((c: { provider?: string }) =>
          ['google', 'microsoft'].includes(String(c.provider || '')),
        ),
      )
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const calendarHealthy =
    calendars.length > 0 && calendars.every((c) => c.status === 'active' || c.status === 'connected')

  return (
    <Page>
      <PageHeader
        title="Overview"
        description="Reminders scheduled today, delivery health, and calendar connection status."
        actions={
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
            Refresh
          </Button>
        }
      />

      {error ? (
        <Callout tone="danger" icon={AlertTriangle} title="Could not load overview">
          <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={load}>
            Try again
          </Button>
        </Callout>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Appointments today" value={loading ? '—' : String(counts?.todayTotal ?? 0)} icon={Calendar} />
        <Stat
          label="Reminders sent today"
          value={loading ? '—' : String(stats?.sentToday ?? 0)}
          icon={Send}
        />
        <Stat
          label="Scheduled reminders"
          value={loading ? '—' : String(stats?.scheduledCount ?? 0)}
          hint="Upcoming automated texts"
        />
        <Stat
          label="Failed (7 days)"
          value={loading ? '—' : String(stats?.failed7d ?? 0)}
          icon={AlertTriangle}
          href={stats?.failed7d ? AR_ROUTES.reminders : undefined}
        />
      </div>

      {!calendarHealthy && !loading ? (
        <div className="mb-6">
          <Callout tone="warning" icon={Calendar} title="Calendar connection needs attention">
            Connect Google Calendar or Microsoft 365 so appointments can sync.{' '}
            <TextLink href={AR_ROUTES.calendars}>Open calendars</TextLink>
          </Callout>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Recent reminder activity" description="Latest sends, skips, and failures.">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reminder activity yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {activity.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium">{row.customerLabel}</p>
                    <p className="text-muted-foreground">{row.reminderLabel}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(row.at).toLocaleString()} · {row.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <TextLink href={AR_ROUTES.reminders}>View all reminders</TextLink>
          </div>
        </Panel>

        <Panel title="Calendars" description="Import source for read-only appointments.">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : calendars.length === 0 ? (
            <p className="text-sm text-muted-foreground">No calendar connected.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {calendars.map((c) => (
                <li key={c.id} className="rounded-md border bg-muted/30 p-3">
                  <span className="font-medium capitalize">{c.provider}</span>
                  <span className="text-muted-foreground"> · {c.status}</span>
                  {c.lastSyncAt ? (
                    <span className="block text-xs text-muted-foreground">
                      Last sync {new Date(c.lastSyncAt).toLocaleString()}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <Link href={AR_ROUTES.calendars} className="text-sm font-medium text-primary hover:underline">
              Manage calendars
            </Link>
          </div>
        </Panel>
      </div>
    </Page>
  )
}
