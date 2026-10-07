'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Bell,
  Calendar,
  CalendarClock,
  MessagesSquare,
  Send,
  Sparkles,
} from 'lucide-react'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { ArStatGrid } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import {
  Callout,
  EmptyState,
  FeatureEmphasisStrip,
  Initials,
  KeyValueRow,
  Page,
  PageHeader,
  Panel,
  Pill,
  Stat,
  TextLink,
  type Tone,
} from '@/newui-transplant/components/app/kit'
import { buttonVariants } from '@/newui-transplant/components/ui/button'
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

type CalendarRow = {
  id: string
  provider: string
  status: string
  lastSyncAt?: string | null
  label?: string
  accountEmail?: string | null
  importCalendarCount?: number
}

type OverviewReadiness = {
  hasImportCalendars?: boolean
  syncHealthy?: boolean
  smsSenderReady?: boolean
  operationalStatus?: 'active' | 'needs_attention' | 'setup_incomplete'
}

function calendarStatusTone(status: string): Tone {
  const s = String(status || '').toLowerCase()
  if (s === 'connected' || s === 'active' || s === 'verified' || s === 'ok') return 'success'
  if (s === 'needs_reauth') return 'warning'
  return 'neutral'
}

function activityStatusTone(label: string): Tone {
  const t = label.toLowerCase()
  if (t.includes('fail')) return 'danger'
  if (t.includes('sent') || t.includes('deliver')) return 'success'
  if (t.includes('sched')) return 'primary'
  if (t.includes('record')) return 'neutral'
  return 'info'
}

export function AppointmentRemindersOverviewPage() {
  const [counts, setCounts] = useState<OverviewCounts | null>(null)
  const [stats, setStats] = useState<WorkspaceStats | null>(null)
  const [calendars, setCalendars] = useState<CalendarRow[]>([])
  const [activity, setActivity] = useState<
    Array<{ id: string; at: string; customerLabel: string; reminderLabel: string; status: string }>
  >([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [readiness, setReadiness] = useState<OverviewReadiness | null>(null)

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
      setReadiness(data?.readiness ?? null)
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

  const operational = readiness?.operationalStatus
  const activeLabel =
    operational === 'active'
      ? 'Active'
      : operational === 'needs_attention'
        ? 'Needs attention'
        : calendarHealthy && readiness?.hasImportCalendars
          ? 'Needs attention'
          : calendars.length
            ? 'Needs attention'
            : 'Setup incomplete'
  const activeTone: Tone =
    operational === 'active' ? 'success' : operational === 'setup_incomplete' ? 'neutral' : 'warning'

  return (
    <Page className="max-w-[1440px]">
      <PageHeader
        title="Overview"
        meta={<Pill tone={activeTone}>{activeLabel}</Pill>}
        description="Calendar-synced SMS reminders for upcoming appointments — delivery health and connection status at a glance."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={AR_ROUTES.settings} className={cn(buttonVariants({ variant: 'outline' }), 'h-9')}>
              Reminder settings
            </Link>
            <Button variant="outline" className="h-9" onClick={() => load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        }
      />

      {error ? (
        <Callout tone="danger" icon={AlertTriangle} title="Could not load overview">
          <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={load}>
            Try again
          </Button>
        </Callout>
      ) : null}

      <ArStatGrid className="mb-6">
        <Stat
          label="Appointments today"
          value={loading ? '—' : String(counts?.todayTotal ?? 0)}
          icon={CalendarClock}
          href={AR_ROUTES.appointments}
        />
        <Stat
          label="Reminders sent today"
          value={loading ? '—' : String(stats?.sentToday ?? 0)}
          icon={Send}
          href={AR_ROUTES.reminders}
        />
        <Stat
          label="Scheduled reminders"
          value={loading ? '—' : String(stats?.scheduledCount ?? 0)}
          hint="Upcoming automated texts"
          icon={Bell}
          href={`${AR_ROUTES.reminders}?status=scheduled`}
        />
        <Stat
          label="Failed (7 days)"
          value={loading ? '—' : String(stats?.failed7d ?? 0)}
          icon={MessagesSquare}
          href={`${AR_ROUTES.reminders}?status=failed`}
        />
      </ArStatGrid>

      {!calendarHealthy && !loading ? (
        <div className="mb-6">
          <Callout tone="warning" icon={Calendar} title="Calendar connection needs attention">
            Connect Google Calendar or Microsoft 365 and select import calendars.{' '}
            <TextLink href={AR_ROUTES.calendars}>Open calendars</TextLink>
          </Callout>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <FeatureEmphasisStrip
            icon={Sparkles}
            title="Automatic SMS from your calendar"
            badge={
              <Pill tone="primary" dot={false}>
                Import only
              </Pill>
            }
            description="Transovo reads appointments from calendars you choose and sends timed SMS reminders. This is not a booking or availability product — connect, import, and remind."
            action={
              <Link
                href={AR_ROUTES.calendars}
                className="inline-flex h-9 items-center rounded-md bg-sidebar-foreground px-3.5 text-xs font-semibold text-sidebar transition-opacity hover:opacity-90"
              >
                Manage calendars
              </Link>
            }
          />

          <Panel
            title="Recent reminder activity"
            description="Latest sends, recorded events, skips, and failures."
            action={<TextLink href={AR_ROUTES.reminders}>View all</TextLink>}
            bodyClassName="p-0"
          >
            {loading ? (
              <p className="p-5 text-sm text-muted-foreground">Loading…</p>
            ) : activity.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="No reminder activity yet"
                description="After calendars import appointments and reminders send, activity appears here."
                action={
                  <Button variant="outline" nativeButton={false} render={<Link href={AR_ROUTES.calendars} />}>
                    Connect calendar
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y">
                {activity.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={AR_ROUTES.reminders}
                      className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40"
                    >
                      <Initials name={row.customerLabel} className="size-8" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{row.customerLabel}</span>
                          <Pill tone={activityStatusTone(row.status)}>{row.status}</Pill>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{row.reminderLabel}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                          {new Date(row.at).toLocaleString()}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel
            title="Connected calendars"
            description="Accounts and import selection for appointment sync."
            action={<TextLink href={AR_ROUTES.calendars}>Manage</TextLink>}
            bodyClassName="divide-y py-0"
          >
            {loading ? (
              <p className="py-4 text-sm text-muted-foreground">Loading…</p>
            ) : calendars.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No calendar connected"
                description="Authorize Google or Microsoft and pick calendars that hold customer appointments."
                action={
                  <Button nativeButton={false} render={<Link href={AR_ROUTES.calendars} />}>
                    Connect calendar
                  </Button>
                }
              />
            ) : (
              calendars.map((c) => (
                <div key={c.id} className="px-1">
                  <KeyValueRow
                    label={c.provider === 'microsoft' ? 'Microsoft 365' : 'Google Calendar'}
                    value={c.label || c.provider}
                    tone={calendarStatusTone(c.status)}
                    href={AR_ROUTES.calendars}
                  />
                  <div className="border-b border-dashed px-5 pb-3 text-xs text-muted-foreground last:border-0">
                    {c.accountEmail ? <p>{c.accountEmail}</p> : null}
                    <p>
                      {(c.importCalendarCount ?? 0) > 0
                        ? `${c.importCalendarCount} calendar(s) selected for import`
                        : 'No import calendars selected yet'}
                    </p>
                    <p>
                      {c.lastSyncAt
                        ? `Last sync ${new Date(c.lastSyncAt).toLocaleString()}`
                        : 'Not synced yet — run Sync on Appointments after selecting import calendars'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </Panel>

          <Panel title="Quick links" bodyClassName="divide-y py-0">
            <KeyValueRow label="Appointments" value="View imported events" href={AR_ROUTES.appointments} />
            <KeyValueRow label="Reminder log" value="Delivery outcomes" href={AR_ROUTES.reminders} />
            <KeyValueRow label="SMS sequence" value="Timing and templates" href={AR_ROUTES.settings} />
          </Panel>
        </div>
      </div>
    </Page>
  )
}
