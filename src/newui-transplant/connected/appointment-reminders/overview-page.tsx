'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Calendar } from 'lucide-react'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import {
  Callout,
  Panel,
  TextLink,
} from '@/newui-transplant/components/app/kit'
import { cn } from '@/lib/utils'
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
      const res = await fetch('/api/appointment-reminders/overview', { cache: 'no-store' })
      if (!res.ok) throw new Error('load failed')
      const json = await res.json()
      const data = json.data
      setCounts(data?.counts ?? null)
      setStats(data?.stats ?? null)
      setActivity(data?.activity ?? [])
      setCalendars(data?.calendars ?? [])
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
    calendars.length > 0 &&
    calendars.every((c) => {
      const s = String(c.status || '').toLowerCase()
      return s === 'connected' || s === 'active' || s === 'verified' || s === 'ok'
    })

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-6">
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-[1_1_70%]">
          <h1 className="text-[22px] font-semibold leading-7 tracking-tight">Overview</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Reminders scheduled today, delivery health, and calendar connection status.
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-[34px]" onClick={() => load()} disabled={loading}>
          Refresh
        </Button>
      </header>

      {error ? (
        <Callout tone="danger" icon={AlertTriangle} title="Could not load overview">
          <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={load}>
            Try again
          </Button>
        </Callout>
      ) : null}

      <div
        className="mb-6 grid grid-cols-2 gap-4 border-b pb-4 md:grid-cols-4 md:divide-x md:divide-border"
        aria-label="Overview summary"
      >
        <OverviewMetric label="Appointments today" value={loading ? '—' : String(counts?.todayTotal ?? 0)} />
        <OverviewMetric label="Reminders sent today" value={loading ? '—' : String(stats?.sentToday ?? 0)} />
        <OverviewMetric
          label="Scheduled reminders"
          value={loading ? '—' : String(stats?.scheduledCount ?? 0)}
          hint="Upcoming automated texts"
        />
        <OverviewMetric
          label="Failed (7 days)"
          value={loading ? '—' : String(stats?.failed7d ?? 0)}
          warn={(stats?.failed7d ?? 0) > 0}
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
    </div>
  )
}

function OverviewMetric({
  label,
  value,
  hint,
  warn,
}: {
  label: string
  value: string
  hint?: string
  warn?: boolean
}) {
  return (
    <div className="px-2 md:px-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'text-xl font-semibold tabular-nums',
          warn && 'text-amber-700 dark:text-amber-500',
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
