'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  ChevronRight,
  MoreHorizontal,
  RefreshCw,
  Send,
} from 'lucide-react'
import type { ArAppointmentRow, ArAppointmentsPagePayload } from '@/lib/appointment-reminders/appointments-page-types'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { formatPhone } from '@/lib/utils'
import { AppointmentDetailDrawer } from '@/newui-transplant/components/appointment-reminders/appointment-detail-drawer'
import { ReminderStatusPill } from '@/newui-transplant/components/appointment-reminders/reminder-status-pill'
import { CustomerResponsePill } from '@/newui-transplant/components/appointment-reminders/customer-response-pill'
import {
  ArStatGrid,
  OpusDataSurface,
  OpusSearchField,
  OpusTableSkeleton,
} from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { EmptyState, Initials, Page, PageHeader, Stat } from '@/newui-transplant/components/app/kit'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'
import { OPUS_META_STRIP, OPUS_TABLE_HEAD } from '@/newui-transplant/components/app/opus-surfaces'
import { th, td } from '@/newui-transplant/components/app/opus-tables'
import { Button } from '@/newui-transplant/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/newui-transplant/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const DATE_OPTIONS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'today', label: 'Today' },
  { value: 'next7', label: 'Next 7 days' },
  { value: 'next30', label: 'Next 30 days' },
  { value: 'past', label: 'Past' },
  { value: 'all', label: 'All' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'needs_attention', label: 'Needs attention' },
  { value: 'not_scheduled', label: 'Not scheduled' },
  { value: 'cancelled', label: 'Cancelled' },
]

function buildQueryString(params: Record<string, string | number>) {
  const sp = new URLSearchParams()
  if (params.q) sp.set('q', String(params.q))
  if (params.date && params.date !== 'upcoming') sp.set('date', String(params.date))
  if (params.reminderStatus && params.reminderStatus !== 'all') {
    sp.set('reminderStatus', String(params.reminderStatus))
  }
  if (params.calendarId && params.calendarId !== 'all') {
    sp.set('calendarId', String(params.calendarId))
  }
  if (params.pageSize && Number(params.pageSize) !== 25) {
    sp.set('pageSize', String(params.pageSize))
  }
  if (params.page && Number(params.page) !== 1) sp.set('page', String(params.page))
  return sp.toString()
}

export function AppointmentRemindersAppointmentsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [qInput, setQInput] = useState(searchParams.get('q') || '')
  const [data, setData] = useState<ArAppointmentsPagePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ArAppointmentRow | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const highlightId = searchParams.get('highlight')

  const date = searchParams.get('date') || 'upcoming'
  const reminderStatus = searchParams.get('reminderStatus') || 'all'
  const calendarId = searchParams.get('calendarId') || 'all'
  const page = Number(searchParams.get('page') || '1')
  const pageSize = Number(searchParams.get('pageSize') || '25')

  const replaceParams = useCallback(
    (patch: Record<string, string | number>) => {
      const next = {
        q: patch.q ?? qInput,
        date: patch.date ?? date,
        reminderStatus: patch.reminderStatus ?? reminderStatus,
        calendarId: patch.calendarId ?? calendarId,
        page: patch.page ?? page,
        pageSize: patch.pageSize ?? pageSize,
      }
      if (patch.page === undefined && (patch.q !== undefined || patch.date || patch.reminderStatus || patch.calendarId)) {
        next.page = 1
      }
      const qs = buildQueryString(next)
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [calendarId, date, page, pageSize, pathname, qInput, reminderStatus, router],
  )

  useEffect(() => {
    if (!highlightId || !data?.rows?.length) return
    const row = data.rows.find((r) => r.id === highlightId)
    if (row) {
      setSelected(row)
      setDrawerOpen(true)
    }
  }, [highlightId, data?.rows])

  useEffect(() => {
    const t = setTimeout(() => {
      if (qInput !== (searchParams.get('q') || '')) {
        replaceParams({ q: qInput })
      }
    }, 300)
    return () => clearTimeout(t)
  }, [qInput, replaceParams, searchParams])

  const load = useCallback(async () => {
    setLoading(true)
    setSyncError(null)
    try {
      const params = new URLSearchParams({
        date,
        reminderStatus,
        calendarId,
        page: String(page),
        pageSize: String(pageSize),
      })
      if (qInput.trim()) params.set('q', qInput.trim())
      const res = await fetch(`/api/appointment-reminders/appointments?${params}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not load appointments')
      setData(json.data as ArAppointmentsPagePayload)
    } catch (e) {
      setData(null)
      setSyncError(e instanceof Error ? e.message : 'Could not load appointments')
    } finally {
      setLoading(false)
    }
  }, [calendarId, date, page, pageSize, qInput, reminderStatus])

  useEffect(() => {
    void load()
  }, [load])

  const openAppointmentId = searchParams.get('open')

  useEffect(() => {
    if (!openAppointmentId || !data?.rows?.length || loading) return
    const match = data.rows.find((r) => r.id === openAppointmentId)
    if (match) {
      setSelected(match)
      setDrawerOpen(true)
      return
    }
    void (async () => {
      try {
        const res = await fetch(`/api/appointment-reminders/appointments/${openAppointmentId}`)
        if (!res.ok) return
        const json = await res.json()
        const appt = json.data
        if (!appt?.id) return
        const stub: ArAppointmentRow = {
          id: appt.id,
          customerName: appt.inviteeName || 'Customer',
          appointmentTitle: appt.serviceName || 'Appointment',
          startsAt: appt.startsAt,
          endsAt: appt.endsAt,
          timezone: appt.timezone,
          isAllDay: false,
          phone: null,
          phoneState: 'missing',
          contactEmail: appt.inviteeEmail,
          reminder: { status: 'scheduled', label: 'Scheduled', secondaryLine: '' },
          sourceProvider: null,
          sourceCalendarLabel: null,
          connectionId: null,
          status: appt.status,
          sourceEventUrl: null,
        }
        setSelected(stub)
        setDrawerOpen(true)
      } catch {
        /* ignore */
      }
    })()
  }, [openAppointmentId, data?.rows, loading])

  const syncNow = async () => {
    if (!data?.sync.connected) return
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch('/api/appointment-reminders/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Sync failed')
      const skipped = (json.data?.results || []).find(
        (r: { skippedReason?: string }) => r.skippedReason,
      )?.skippedReason
      if (skipped) setSyncError(skipped)
      await load()
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const calendarOptions = useMemo(() => {
    const base = [{ value: 'all', label: 'All calendars' }]
    for (const c of data?.calendars || []) {
      base.push({
        value: c.id,
        label: `${c.provider === 'google' ? 'Google' : 'Outlook'} · ${c.label}`,
      })
    }
    return base
  }, [data?.calendars])

  const total = data?.total ?? 0
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const syncLabel = data?.sync.lastSyncAt
    ? `Synced ${formatRelative(data.sync.lastSyncAt)}`
    : data?.sync.connected && (data?.total ?? 0) > 0
      ? 'Calendar connected'
      : data?.sync.connected
        ? 'Connected — run Sync now to refresh'
        : 'Not synced yet'

  const emptyKind = !data?.sync.connected
    ? 'no_calendar'
    : data?.sync.syncError
      ? 'sync_error'
      : loading
        ? 'loading'
        : total === 0 && qInput.trim()
          ? 'no_search'
          : total === 0
            ? 'no_rows'
            : null

  return (
    <Page className="max-w-[1440px]">
      <PageHeader
        title="Appointments"
        description="Imported calendar events with reminder readiness, phone quality, and sync status."
        actions={
          <div className="flex flex-col items-end gap-2">
            <span className={cn(OPUS_META_STRIP, 'text-xs text-muted-foreground')}>{syncLabel}</span>
            {data?.sync.connected ? (
              <Button variant="outline" className="h-9" disabled={syncing} onClick={syncNow}>
                <RefreshCw className={cn('mr-1.5 size-3.5', syncing && 'animate-spin')} aria-hidden="true" />
                Sync now
              </Button>
            ) : (
              <Button variant="outline" className="h-9" render={<Link href={AR_ROUTES.calendars} />}>
                Connect calendar
              </Button>
            )}
            {syncError ? (
              <p className="text-xs text-destructive" role="alert">{syncError}</p>
            ) : null}
          </div>
        }
      />

      <ArStatGrid className="mb-6">
        <Stat
          label="Upcoming"
          value={String(data?.summary.upcoming ?? '—')}
          hint={
            date === 'all' && (data?.summary.upcoming ?? 0) === 0 && (data?.total ?? 0) > 0
              ? 'Future only; table shows all dates'
              : undefined
          }
          icon={CalendarClock}
        />
        <Stat label="Scheduled reminders" value={String(data?.summary.scheduled ?? '—')} icon={Calendar} />
        <Stat label="Sent" value={String(data?.summary.sent ?? '—')} hint="Last 30 days" icon={Send} />
        <Stat
          label="Needs attention"
          value={String(data?.summary.needsAttention ?? '—')}
          icon={AlertTriangle}
        />
      </ArStatGrid>

      <OpusDataSurface
        toolbar={
          <>
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <OpusSearchField
                id="ar-appointments-search"
                label="Search appointments"
                value={qInput}
                onChange={setQInput}
                placeholder="Search customer, title, or phone"
                className="sm:max-w-xs"
              />
              <SimpleSelect
                label="Date range"
                value={date}
                onChange={(v) => replaceParams({ date: v, page: 1 })}
                options={DATE_OPTIONS}
                className="w-[140px]"
              />
              <SimpleSelect
                label="Reminder status"
                value={reminderStatus}
                onChange={(v) => replaceParams({ reminderStatus: v, page: 1 })}
                options={STATUS_OPTIONS}
                className="w-[160px]"
              />
              <SimpleSelect
                label="Calendar"
                value={calendarId}
                onChange={(v) => replaceParams({ calendarId: v, page: 1 })}
                options={calendarOptions}
                className="w-[180px]"
              />
            </div>
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              {total > 0 ? `${start}–${end} of ${total}` : 'No appointments'}
            </p>
          </>
        }
        footer={
          total > 0 ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {start}–{end} of {total} appointments
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <SimpleSelect
                  label="Rows per page"
                  value={String(pageSize)}
                  onChange={(v) => replaceParams({ pageSize: Number(v), page: 1 })}
                  options={[
                    { value: '25', label: '25' },
                    { value: '50', label: '50' },
                    { value: '100', label: '100' },
                  ]}
                  className="w-[88px]"
                />
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => replaceParams({ page: page - 1 })}>
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">Page {page} of {pageCount}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pageCount}
                  onClick={() => replaceParams({ page: page + 1 })}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        {emptyKind === 'loading' ? (
          <OpusTableSkeleton label="Loading appointments" />
        ) : emptyKind === 'no_calendar' ? (
          <EmptyState
            icon={Calendar}
            title="Connect your calendar"
            description="Connect Google Calendar or Microsoft Outlook to automatically find appointments and schedule SMS reminders."
            action={<Button render={<Link href={AR_ROUTES.calendars} />}>Connect calendar</Button>}
          />
        ) : emptyKind === 'sync_error' ? (
          <EmptyState
            icon={AlertTriangle}
            title="Calendar needs attention"
            description="We couldn't refresh appointments from your connected calendar."
            action={
              <div className="flex gap-2">
                <Button variant="outline" onClick={syncNow} disabled={syncing}>Retry sync</Button>
                <Button variant="outline" render={<Link href={AR_ROUTES.calendars} />}>Manage connection</Button>
              </div>
            }
          />
        ) : emptyKind === 'no_search' ? (
          <EmptyState
            icon={Calendar}
            title="No matching appointments"
            description="Try another name, appointment title, or phone number."
            action={
              <Button variant="outline" onClick={() => setQInput('')}>Clear search</Button>
            }
          />
        ) : emptyKind === 'no_rows' ? (
          <EmptyState
            icon={CalendarClock}
            title={date === 'upcoming' ? 'No upcoming appointments' : 'No appointments found'}
            description={
              date === 'upcoming' && data?.sync.connected
                ? 'Your calendar is connected. Try All or Past to see imported events, or run Sync now to refresh from Outlook or Google.'
                : 'No appointments match your current date range or selected calendars.'
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {date === 'upcoming' ? (
                  <Button onClick={() => replaceParams({ date: 'all', page: 1 })}>
                    Show all appointments
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={() => replaceParams({ date: date === 'upcoming' ? 'all' : 'upcoming', page: 1 })}
                >
                  {date === 'upcoming' ? 'Change filters' : 'Show upcoming only'}
                </Button>
              </div>
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead className={OPUS_TABLE_HEAD}>
                  <tr>
                    <th scope="col" className={th}>Appointment</th>
                    <th scope="col" className={th}>Date &amp; time</th>
                    <th scope="col" className={th}>Phone</th>
                    <th scope="col" className={th}>Reminder</th>
                    <th scope="col" className={th}>Customer response</th>
                    <th scope="col" className={cn(th, 'hidden lg:table-cell')}>Source</th>
                    <th scope="col" className={cn(th, 'w-8')}>
                      <span className="sr-only">Open</span>
                    </th>
                    <th scope="col" className={cn(th, 'text-right')}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(data?.rows || []).map((row) => (
                    <AppointmentTableRow
                      key={row.id}
                      row={row}
                      timezone={data?.timezone || 'America/New_York'}
                      onOpen={() => {
                        setSelected(row)
                        setDrawerOpen(true)
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y md:hidden">
              {(data?.rows || []).map((row) => (
                <MobileRow
                  key={row.id}
                  row={row}
                  timezone={data?.timezone || 'America/New_York'}
                  onOpen={() => {
                    setSelected(row)
                    setDrawerOpen(true)
                  }}
                />
              ))}
            </div>
          </>
        )}
      </OpusDataSurface>

      <AppointmentDetailDrawer
        row={selected}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        timezone={data?.timezone || 'America/New_York'}
        onPhoneSaved={load}
      />
    </Page>
  )
}

function AppointmentTableRow({
  row,
  timezone,
  onOpen,
}: {
  row: ArAppointmentRow
  timezone: string
  onOpen: () => void
}) {
  return (
    <tr
      className="group cursor-pointer hover:bg-muted/40 focus-within:bg-muted/40"
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      <td className={td}>
        <span className="flex items-center gap-3">
          <Initials name={row.customerName} className="size-8" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{row.customerName}</span>
            {row.appointmentTitle ? (
              <span className="block truncate text-xs text-muted-foreground">{row.appointmentTitle}</span>
            ) : null}
          </span>
        </span>
      </td>
      <td className={td}>
        <span className="block text-[13px]">{formatDay(row.startsAt, timezone)}</span>
        <span className="block text-xs text-muted-foreground">
          {formatTimeSpan(row.startsAt, row.endsAt, timezone, row.isAllDay)}
        </span>
      </td>
      <td className={td}>
        {row.phoneState === 'missing' ? (
          <span className="flex flex-col gap-0.5 text-xs text-amber-700">
            <span className="flex items-center gap-1">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              Missing phone
            </span>
            {row.contactEmail ? (
              <span className="text-muted-foreground">Email on file — add phone for SMS</span>
            ) : null}
          </span>
        ) : row.phoneState === 'invalid' ? (
          <span className="text-xs text-amber-700">Invalid phone</span>
        ) : row.phone ? (
          <span className="text-[13px]">{formatPhone(row.phone)}</span>
        ) : (
          '—'
        )}
      </td>
      <td className={td}>
        <ReminderStatusPill label={row.reminder.label} status={row.reminder.status} />
        <span className="mt-0.5 block text-xs text-muted-foreground">{row.reminder.secondaryLine}</span>
      </td>
      <td className={td}>
        <CustomerResponsePill label={row.customerResponse.label} kind={row.customerResponse.kind} />
        {row.customerResponse.detailLine ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">{row.customerResponse.detailLine}</span>
        ) : null}
        {row.customerResponse.reasonLine ? (
          <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
            {row.customerResponse.reasonLine}
          </span>
        ) : null}
      </td>
      <td className={cn(td, 'hidden text-xs text-muted-foreground lg:table-cell')}>
        {sourceLabel(row)}
      </td>
      <td className={cn(td, 'w-8')}>
        <ChevronRight className="ml-auto size-4 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />
      </td>
      <td className={cn(td, 'text-right')} onClick={(e) => e.stopPropagation()}>
        <RowMenu row={row} onOpen={onOpen} />
      </td>
    </tr>
  )
}

function MobileRow({
  row,
  timezone,
  onOpen,
}: {
  row: ArAppointmentRow
  timezone: string
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-muted/40"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium">{row.customerName}</span>
        <ReminderStatusPill label={row.reminder.label} status={row.reminder.status} />
      </div>
      <span className="text-xs text-muted-foreground">
        {formatDay(row.startsAt, timezone)} · {formatTimeSpan(row.startsAt, row.endsAt, timezone, row.isAllDay)}
      </span>
      <span className="text-xs text-muted-foreground">
        {row.customerResponse.kind !== 'none' ? row.customerResponse.label : row.reminder.secondaryLine}
      </span>
    </button>
  )
}

function RowMenu({ row, onOpen }: { row: ArAppointmentRow; onOpen: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.customerName}`}>
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onOpen}>View details</DropdownMenuItem>
        <DropdownMenuItem onClick={onOpen}>Add or correct reminder phone number</DropdownMenuItem>
        {row.sourceEventUrl ? (
          <DropdownMenuItem
            onClick={() => window.open(row.sourceEventUrl!, "_blank", "noopener,noreferrer")}
          >
            Open in {row.sourceProvider === "microsoft" ? "Outlook" : "Google Calendar"}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function sourceLabel(row: ArAppointmentRow) {
  const p = row.sourceProvider === 'google' ? 'Google' : row.sourceProvider === 'microsoft' ? 'Outlook' : 'Calendar'
  const name = row.sourceCalendarLabel || 'Main calendar'
  return `${p} · ${name}`
}

function formatDay(iso: string, tz: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: tz,
  })
}

function formatTimeSpan(start: string, end: string | null, tz: string, allDay: boolean) {
  if (allDay) return 'All day'
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', timeZone: tz }
  const a = new Date(start).toLocaleTimeString(undefined, opts)
  const b = end ? new Date(end).toLocaleTimeString(undefined, opts) : ''
  return b ? `${a} – ${b}` : a
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 48) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleString()
}
