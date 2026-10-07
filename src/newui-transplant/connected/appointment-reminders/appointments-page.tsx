'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  Calendar,
  MoreHorizontal,
  RefreshCw,
  Search,
} from 'lucide-react'
import type { ArAppointmentRow, ArAppointmentsPagePayload } from '@/lib/appointment-reminders/appointments-page-types'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { formatPhone } from '@/lib/utils'
import { AppointmentDetailDrawer } from '@/newui-transplant/components/appointment-reminders/appointment-detail-drawer'
import { ReminderStatusPill } from '@/newui-transplant/components/appointment-reminders/reminder-status-pill'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'
import { OPUS_TABLE_HEAD } from '@/newui-transplant/components/app/opus-surfaces'
import { th, td } from '@/newui-transplant/components/app/opus-tables'
import { Button } from '@/newui-transplant/components/ui/button'
import { Input } from '@/newui-transplant/components/ui/input'
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

  const syncNow = async () => {
    if (!data?.sync.connected) return
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch('/api/appointment-reminders/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Sync failed')
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
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-6">
      {/* Section 1 — Header */}
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-[1_1_70%]">
          <h1 className="text-[22px] font-semibold leading-7 tracking-tight">Appointments</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            View appointments from your connected calendars and track reminder readiness.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <p className="text-xs text-muted-foreground">{syncLabel}</p>
          {data?.sync.connected ? (
            <Button
              variant="outline"
              size="sm"
              className="h-[34px]"
              disabled={syncing}
              onClick={syncNow}
            >
              <RefreshCw className={cn('mr-1.5 size-3.5', syncing && 'animate-spin')} aria-hidden="true" />
              Sync now
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="h-[34px]" render={<Link href={AR_ROUTES.calendars} />}>
              Connect calendar
            </Button>
          )}
          {syncError ? (
            <p className="text-xs text-destructive" role="alert">{syncError}</p>
          ) : null}
        </div>
      </header>

      {/* Section 2 — Summary strip */}
      <div
        className="mb-5 grid grid-cols-2 gap-4 border-b pb-4 md:grid-cols-4 md:divide-x md:divide-border"
        aria-label="Appointment summary"
      >
        <Metric label="Upcoming" value={data?.summary.upcoming ?? '—'} />
        <Metric label="Scheduled" value={data?.summary.scheduled ?? '—'} />
        <Metric label="Sent" value={data?.summary.sent ?? '—'} hint="Last 30 days" />
        <Metric
          label="Needs attention"
          value={data?.summary.needsAttention ?? '—'}
          warn={(data?.summary.needsAttention ?? 0) > 0}
        />
      </div>

      {/* Section 3 — Toolbar */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search appointments"
              className="h-9 pl-9"
              aria-label="Search appointments"
            />
          </div>
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
          {total > 0 ? `Showing ${start}–${end} of ${total} appointments` : 'No appointments'}
        </p>
      </div>

      {/* Section 4 — Table */}
      <div className="overflow-hidden rounded-lg border bg-card">
        {emptyKind === 'loading' ? (
          <TableSkeleton />
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
            title="No matching appointments"
            description="Try another name, appointment title, or phone number."
            action={
              <Button variant="outline" onClick={() => setQInput('')}>Clear search</Button>
            }
          />
        ) : emptyKind === 'no_rows' ? (
          <EmptyState
            title="No appointments found"
            description="No appointments match your current date range or selected calendars."
            action={
              <Button variant="outline" onClick={() => replaceParams({ date: 'all', page: 1 })}>
                Change filters
              </Button>
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
                    <th scope="col" className={cn(th, 'hidden lg:table-cell')}>Source</th>
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
      </div>

      {/* Section 5 — Pagination */}
      {total > 0 ? (
        <footer className="mt-0 flex flex-col gap-3 border-t px-2 py-3 sm:flex-row sm:items-center sm:justify-between">
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
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => replaceParams({ page: page - 1 })}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => replaceParams({ page: page + 1 })}
            >
              Next
            </Button>
          </div>
        </footer>
      ) : null}

      <AppointmentDetailDrawer
        row={selected}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        timezone={data?.timezone || 'America/New_York'}
        onPhoneSaved={load}
      />
    </div>
  )
}

function Metric({
  label,
  value,
  hint,
  warn,
}: {
  label: string
  value: string | number
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
        <span className="block text-[13px] font-medium">{row.customerName}</span>
        {row.appointmentTitle ? (
          <span className="block text-xs text-muted-foreground">{row.appointmentTitle}</span>
        ) : null}
      </td>
      <td className={td}>
        <span className="block text-[13px]">{formatDay(row.startsAt, timezone)}</span>
        <span className="block text-xs text-muted-foreground">
          {formatTimeSpan(row.startsAt, row.endsAt, timezone, row.isAllDay)}
        </span>
      </td>
      <td className={td}>
        {row.phoneState === 'missing' ? (
          <span className="flex items-center gap-1 text-xs text-amber-700">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            Missing phone
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
      <td className={cn(td, 'hidden text-xs text-muted-foreground lg:table-cell')}>
        {sourceLabel(row)}
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
      {row.phoneState !== 'ok' ? (
        <span className="text-xs text-amber-700">{row.reminder.secondaryLine}</span>
      ) : null}
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

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: typeof Calendar
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {Icon ? <Icon className="mb-3 size-8 text-muted-foreground" aria-hidden="true" /> : null}
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-0 divide-y p-2" aria-busy="true" aria-label="Loading appointments">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[60px] animate-pulse bg-muted/30" />
      ))}
    </div>
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
