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
  UserCheck,
} from 'lucide-react'
import { AR_ROUTES, AR_SETTINGS_INTEGRATIONS } from '@/lib/appointment-reminders/routes'
import { ArUpcomingAppointmentsPanel } from '@/newui-transplant/components/appointment-reminders/ar-upcoming-appointments-panel'
import { ArOverviewConversationsPanel } from '@/newui-transplant/components/appointment-reminders/ar-overview-conversations-panel'
import {
  ArOpusPage,
  ArStatGrid,
} from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import {
  Callout,
  EmptyState,
  FeatureEmphasisStrip,
  KeyValueRow,
  PageHeader,
  Panel,
  Pill,
  Stat,
  TextLink,
  type Tone,
} from '@/newui-transplant/components/app/kit'
import { OPUS_TABLE_HEAD } from '@/newui-transplant/components/app/opus-surfaces'
import { th, td } from '@/newui-transplant/components/app/opus-tables'
import { buttonVariants } from '@/newui-transplant/components/ui/button'
import { cn } from '@/lib/utils'
import { Button } from '@/newui-transplant/components/ui/button'

type OverviewCounts = {
  todayTotal: number
  reminderFailed: number
  upcoming?: number
  awaitingConfirmation?: number
  confirmed?: number
  needsAttention?: number
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
  emailSenderReady?: boolean
  remindersActivated?: boolean
  remindersPaused?: boolean
  operationalStatus?: 'active' | 'needs_attention' | 'setup_incomplete'
}

type ProductStatusItem = {
  id: string
  label: string
  status: 'ready' | 'needs_setup'
  detail: string
  href: string
}

type NeedsAttentionRow = {
  appointmentId: string
  customerName: string
  appointmentTitle: string
  startsAt: string
  issue: string
  lastActivityAt: string | null
  lastActivityLabel: string
}

type UpcomingRow = {
  appointmentId: string
  customerName: string
  appointmentTitle: string
  startsAt: string
  nextReminder: string
  responseStatus: string
  responseKind: string
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
    Array<{
      id: string
      at: string
      customerLabel: string
      reminderLabel: string
      status: string
      detail?: string | null
      actionHint?: string | null
    }>
  >([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [readiness, setReadiness] = useState<OverviewReadiness | null>(null)
  const [productStatus, setProductStatus] = useState<ProductStatusItem[]>([])
  const [needsAttentionRows, setNeedsAttentionRows] = useState<NeedsAttentionRow[]>([])
  const [upcomingAppointments, setUpcomingAppointments] = useState<UpcomingRow[]>([])
  const [pauseBusy, setPauseBusy] = useState(false)

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
      setProductStatus(data?.productStatus ?? [])
      setNeedsAttentionRows(data?.needsAttentionRows ?? [])
      setUpcomingAppointments(data?.upcomingAppointments ?? [])
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
  async function setWorkspacePause(paused: boolean) {
    setPauseBusy(true)
    try {
      const res = await fetch('/api/appointment-reminders/operational-pause', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paused ? { action: 'pause', indefinite: true } : { action: 'resume' }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error || 'Could not update pause state')
      }
      await load()
    } catch (err) {
      console.error('[ar-overview] pause', err)
    } finally {
      setPauseBusy(false)
    }
  }

  const activeLabel = readiness?.remindersPaused
    ? 'Paused'
    : operational === 'active'
      ? 'Active'
      : operational === 'needs_attention'
        ? 'Needs attention'
        : calendarHealthy && readiness?.hasImportCalendars
          ? 'Needs attention'
          : calendars.length
            ? 'Needs attention'
            : 'Setup incomplete'
  const activeTone: Tone = readiness?.remindersPaused
    ? 'warning'
    : operational === 'active'
      ? 'success'
      : operational === 'setup_incomplete'
        ? 'neutral'
        : 'warning'

  return (
    <ArOpusPage>
      <PageHeader
        title="Appointment Reminders"
        meta={<Pill tone={activeTone}>{activeLabel}</Pill>}
        description="Your upcoming appointments and customer responses — who is confirmed, who needs attention, and whether reminders are active."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={AR_ROUTES.appointments} className={cn(buttonVariants({ variant: 'default' }), 'h-9')}>
              Add appointment
            </Link>
            <Link href={AR_ROUTES.settings} className={cn(buttonVariants({ variant: 'outline' }), 'h-9')}>
              Settings
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

      {readiness?.remindersPaused ? (
        <Callout tone="warning" icon={Bell} title="Automated reminders are paused for this workspace">
          <p className="text-sm text-muted-foreground">
            No new reminder texts or emails will send until you resume. Calendar sync continues.
          </p>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="mt-3"
            disabled={pauseBusy}
            onClick={() => void setWorkspacePause(false)}
          >
            Resume reminders
          </Button>
        </Callout>
      ) : readiness?.remindersActivated ? (
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pauseBusy}
            onClick={() => void setWorkspacePause(true)}
          >
            Pause all reminders
          </Button>
        </div>
      ) : null}

      <ArUpcomingAppointmentsPanel
        className="mb-6"
        loading={loading}
        rows={upcomingAppointments.map((row) => ({
          ...row,
          needsAttention:
            row.responseKind === 'cancel_pending' ||
            row.responseKind === 'reschedule_pending' ||
            row.responseKind === 'reschedule_requested' ||
            row.responseKind === 'awaiting_reply',
        }))}
      />

      <ArStatGrid className="mb-6">
        <Stat
          label="Upcoming appointments"
          value={loading ? '—' : String(counts?.upcoming ?? stats?.scheduledCount ?? 0)}
          icon={CalendarClock}
          href={`${AR_ROUTES.appointments}?engagement=upcoming`}
        />
        <Stat
          label="Awaiting reply"
          value={loading ? '—' : String(counts?.awaitingConfirmation ?? 0)}
          icon={UserCheck}
          href={`${AR_ROUTES.appointments}?engagement=awaiting_confirmation`}
        />
        <Stat
          label="Confirmed"
          value={loading ? '—' : String(counts?.confirmed ?? 0)}
          icon={Send}
          href={`${AR_ROUTES.appointments}?engagement=confirmed`}
        />
        <Stat
          label="Needs attention"
          value={loading ? '—' : String(counts?.needsAttention ?? 0)}
          icon={AlertTriangle}
          href={`${AR_ROUTES.responses}?view=needs_attention`}
        />
      </ArStatGrid>

      <ArOverviewConversationsPanel />

      {productStatus.length > 0 ? (
        <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {productStatus.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-muted/40"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                <Pill tone={item.status === 'ready' ? 'success' : 'warning'} dot={false}>
                  {item.status === 'ready' ? 'Ready' : 'Action needed'}
                </Pill>
              </p>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.detail}</p>
            </Link>
          ))}
        </div>
      ) : null}

      <Panel
        title="Needs attention"
        description="Missing details, delivery issues, and open customer requests."
        action={<TextLink href={`${AR_ROUTES.responses}?view=needs_attention`}>View responses</TextLink>}
        bodyClassName="p-0"
        className="mb-6"
      >
        {loading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : needsAttentionRows.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title="Nothing needs attention"
            description="Upcoming appointments have recipient details and no open requests."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className={OPUS_TABLE_HEAD}>
                <tr>
                  <th scope="col" className={th}>Customer</th>
                  <th scope="col" className={th}>Appointment</th>
                  <th scope="col" className={th}>Issue</th>
                  <th scope="col" className={th}>Last activity</th>
                  <th scope="col" className={th}><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {needsAttentionRows.map((row) => (
                  <tr key={row.appointmentId} className="hover:bg-muted/30">
                    <td className={`${td} font-medium`}>{row.customerName}</td>
                    <td className={td}>
                      <span className="block truncate">{row.appointmentTitle}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {new Date(row.startsAt).toLocaleString()}
                      </span>
                    </td>
                    <td className={td}>{row.issue}</td>
                    <td className={`${td} text-muted-foreground`}>
                      {row.lastActivityAt
                        ? new Date(row.lastActivityAt).toLocaleString()
                        : row.lastActivityLabel || '—'}
                    </td>
                    <td className={td}>
                      <Link
                        href={`${AR_ROUTES.appointments}?highlight=${encodeURIComponent(row.appointmentId)}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {!calendarHealthy && !loading ? (
        <div className="mb-6">
          <Callout tone="warning" icon={Calendar} title="Calendar connection needs attention">
            Connect Google Calendar or Microsoft 365 and select import calendars.{' '}
            <TextLink href={AR_SETTINGS_INTEGRATIONS}>Manage connections</TextLink>
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
                href={AR_SETTINGS_INTEGRATIONS}
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
                  <Button variant="outline" nativeButton={false} render={<Link href={AR_SETTINGS_INTEGRATIONS} />}>
                    Connect calendar
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className={OPUS_TABLE_HEAD}>
                    <tr>
                      <th scope="col" className={th}>Recipient</th>
                      <th scope="col" className={th}>Channel</th>
                      <th scope="col" className={th}>Message</th>
                      <th scope="col" className={th}>Status</th>
                      <th scope="col" className={th}>Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activity.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/30">
                        <td className={`${td} font-medium`}>{row.customerLabel}</td>
                        <td className={td}>{(row as { channel?: string }).channel || '—'}</td>
                        <td className={`${td} max-w-[200px] truncate text-muted-foreground`}>{row.reminderLabel}</td>
                        <td className={td}>
                          <Pill tone={activityStatusTone(row.status)}>{row.status}</Pill>
                          {row.detail ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">{row.detail}</span>
                          ) : null}
                          {row.actionHint ? (
                            <span className="mt-0.5 block text-xs text-foreground/80">{row.actionHint}</span>
                          ) : null}
                        </td>
                        <td className={`${td} tabular-nums text-muted-foreground`}>
                          {new Date(row.at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel
            title="Connected calendars"
            description="Accounts and import selection for appointment sync."
            action={<TextLink href={AR_SETTINGS_INTEGRATIONS}>Manage</TextLink>}
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
                  <Button nativeButton={false} render={<Link href={AR_SETTINGS_INTEGRATIONS} />}>
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
                    href={AR_SETTINGS_INTEGRATIONS}
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
            <KeyValueRow label="Responses" value="Customer replies and requests" href={AR_ROUTES.responses} />
            <KeyValueRow label="Reminder log" value="Delivery outcomes" href={AR_ROUTES.reminders} />
            <KeyValueRow label="SMS sequence" value="Timing and templates" href={AR_ROUTES.settings} />
          </Panel>
        </div>
      </div>
    </ArOpusPage>
  )
}
