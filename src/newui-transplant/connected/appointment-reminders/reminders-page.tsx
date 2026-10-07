'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, RefreshCw, Search } from 'lucide-react'
import type {
  ArReminderOperationalRow,
  ArRemindersPagePayload,
} from '@/lib/appointment-reminders/reminders-page-types'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { ReminderStatusPill } from '@/newui-transplant/components/appointment-reminders/reminder-status-pill'
import type { AggregateReminderStatus } from '@/lib/appointment-reminders/aggregate-reminder-status'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'
import { OPUS_TABLE_HEAD } from '@/newui-transplant/components/app/opus-surfaces'
import { th, td } from '@/newui-transplant/components/app/opus-tables'
import { Button } from '@/newui-transplant/components/ui/button'
import { Input } from '@/newui-transplant/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/newui-transplant/components/ui/sheet'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'needs_attention', label: 'Needs attention' },
  { value: 'skipped', label: 'Skipped' },
]

const HORIZON_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming only' },
]

function toPillStatus(status: string): AggregateReminderStatus {
  if (status === 'blocked' || status === 'past_due') return 'needs_attention'
  if (status === 'delivered') return 'delivered'
  if (status === 'failed') return 'failed'
  if (status === 'skipped') return 'not_scheduled'
  if (status === 'sent') return 'sent'
  return 'scheduled'
}

export function AppointmentRemindersLogPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [qInput, setQInput] = useState(searchParams.get('q') || '')
  const [data, setData] = useState<ArRemindersPagePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ArReminderOperationalRow | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const status = searchParams.get('status') || 'all'
  const horizon = searchParams.get('horizon') || 'all'
  const page = Number(searchParams.get('page') || '1')
  const pageSize = Number(searchParams.get('pageSize') || '25')

  const replaceParams = useCallback(
    (patch: Record<string, string | number>) => {
      const sp = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (v === '' || v === 'all' && k !== 'q') sp.delete(k)
        else sp.set(k, String(v))
      }
      if (!patch.page && (patch.q !== undefined || patch.status || patch.horizon)) {
        sp.set('page', '1')
      }
      const qs = sp.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  useEffect(() => {
    const t = setTimeout(() => {
      if (qInput !== (searchParams.get('q') || '')) replaceParams({ q: qInput })
    }, 300)
    return () => clearTimeout(t)
  }, [qInput, replaceParams, searchParams])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        status,
        horizon,
        page: String(page),
        pageSize: String(pageSize),
      })
      if (qInput.trim()) params.set('q', qInput.trim())
      const res = await fetch(`/api/appointment-reminders/reminders?${params}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'load failed')
      setData(json.data as ArRemindersPagePayload)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [horizon, page, pageSize, qInput, status])

  useEffect(() => {
    void load()
  }, [load])

  const total = data?.total ?? 0
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-6">
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-[1_1_70%]">
          <h1 className="text-[22px] font-semibold leading-7 tracking-tight">Reminders</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Upcoming scheduled reminders, delivery outcomes, failures, and blocked sends — with clear next steps.
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-[34px]" onClick={load} disabled={loading}>
          <RefreshCw className={cn('mr-1.5 size-3.5', loading && 'animate-spin')} aria-hidden="true" />
          Refresh
        </Button>
      </header>

      <div
        className="mb-5 grid grid-cols-2 gap-4 border-b pb-4 md:grid-cols-4 md:divide-x md:divide-border"
        aria-label="Reminder summary"
      >
        <Metric label="Scheduled" value={data?.summary.scheduled ?? '—'} />
        <Metric label="Sent" value={data?.summary.sent30d ?? '—'} hint="Last 30 days" />
        <Metric label="Failed" value={data?.summary.failed7d ?? '—'} hint="Last 7 days" warn={(data?.summary.failed7d ?? 0) > 0} />
        <Metric label="Blocked" value={data?.summary.blocked ?? '—'} warn={(data?.summary.blocked ?? 0) > 0} />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search reminders"
              className="h-9 pl-9"
              aria-label="Search reminders"
            />
          </div>
          <SimpleSelect
            label="Status"
            value={status}
            onChange={(v) => replaceParams({ status: v, page: 1 })}
            options={STATUS_OPTIONS}
            className="w-[160px]"
          />
          <SimpleSelect
            label="Horizon"
            value={horizon}
            onChange={(v) => replaceParams({ horizon: v, page: 1 })}
            options={HORIZON_OPTIONS}
            className="w-[150px]"
          />
        </div>
        <p className="text-xs text-muted-foreground whitespace-nowrap">
          {total > 0 ? `Showing ${start}–${end} of ${total} reminders` : 'No reminders'}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        {loading ? (
          <TableSkeleton />
        ) : total === 0 ? (
          <div className="px-6 py-16 text-center">
            <h2 className="text-sm font-semibold">No reminders in this view</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect a calendar and configure your reminder sequence in settings.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" render={<Link href={AR_ROUTES.calendars} />}>Calendars</Button>
              <Button variant="outline" render={<Link href={AR_ROUTES.settings} />}>Reminder settings</Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={OPUS_TABLE_HEAD}>
                <tr>
                  <th scope="col" className={th}>Appointment</th>
                  <th scope="col" className={th}>Reminder</th>
                  <th scope="col" className={th}>When</th>
                  <th scope="col" className={th}>Channel</th>
                  <th scope="col" className={th}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data?.rows || []).map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => {
                      setSelected(row)
                      setDrawerOpen(true)
                    }}
                  >
                    <td className={td}>
                      <span className="block text-[13px] font-medium">{row.customerLabel}</span>
                      <span className="block text-xs text-muted-foreground">{row.appointmentLabel}</span>
                    </td>
                    <td className={td}>
                      <span className="text-[13px]">{row.reminderLabel}</span>
                    </td>
                    <td className={td}>
                      <span className="text-[13px]">
                        {row.occurredAt
                          ? new Date(row.occurredAt).toLocaleString()
                          : row.scheduledFor
                            ? new Date(row.scheduledFor).toLocaleString()
                            : '—'}
                      </span>
                    </td>
                    <td className={td}>{row.channel}</td>
                    <td className={td}>
                      <ReminderStatusPill label={row.statusLabel} status={toPillStatus(row.status)} />
                      {row.detail ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">{row.detail}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > 0 ? (
        <footer className="flex flex-col gap-3 border-t px-2 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">Showing {start}–{end} of {total} reminders</p>
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
            <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => replaceParams({ page: page + 1 })}>
              Next
            </Button>
          </div>
        </footer>
      ) : null}

      <Sheet open={drawerOpen} onOpenChange={(v) => !v && setDrawerOpen(false)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.reminderLabel}</SheetTitle>
              </SheetHeader>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Customer</dt>
                  <dd className="font-medium">{selected.customerLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Appointment</dt>
                  <dd>{selected.appointmentLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd>
                    <ReminderStatusPill label={selected.statusLabel} status={toPillStatus(selected.status)} />
                  </dd>
                </div>
                {selected.detail ? (
                  <div>
                    <dt className="text-xs text-muted-foreground">Details</dt>
                    <dd>{selected.detail}</dd>
                  </div>
                ) : null}
                {selected.actionHint ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    <AlertTriangle className="mb-1 inline size-3.5" aria-hidden="true" />
                    {selected.actionHint}
                  </div>
                ) : null}
              </dl>
              <div className="mt-6 flex flex-col gap-2">
                <Button variant="outline" render={<Link href={`${AR_ROUTES.appointments}?open=${selected.appointmentId}`} />}>
                  Open appointment
                </Button>
                <Button variant="outline" onClick={() => setDrawerOpen(false)}>Close</Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
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
      <p className={cn('text-xl font-semibold tabular-nums', warn && 'text-amber-700 dark:text-amber-500')}>
        {value}
      </p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-0 divide-y p-2" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[60px] animate-pulse bg-muted/30" />
      ))}
    </div>
  )
}
