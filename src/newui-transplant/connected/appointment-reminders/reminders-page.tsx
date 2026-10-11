'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, Bell, RefreshCw, Send, ShieldAlert } from 'lucide-react'
import type {
  ArReminderOperationalRow,
  ArRemindersPagePayload,
} from '@/lib/appointment-reminders/reminders-page-types'
import { AR_ROUTES, AR_SETTINGS_INTEGRATIONS } from '@/lib/appointment-reminders/routes'
import {
  ArStatGrid,
  OpusDataSurface,
  OpusSearchField,
  OpusTableSkeleton,
} from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { ArRemindersHubShell } from '@/newui-transplant/components/appointment-reminders/ar-reminders-hub-shell'
import { ReminderStatusPill } from '@/newui-transplant/components/appointment-reminders/reminder-status-pill'
import type { AggregateReminderStatus } from '@/lib/appointment-reminders/aggregate-reminder-status'
import { EmptyState, Initials, Stat } from '@/newui-transplant/components/app/kit'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'
import { OPUS_TABLE_HEAD } from '@/newui-transplant/components/app/opus-surfaces'
import { th, td } from '@/newui-transplant/components/app/opus-tables'
import { Button } from '@/newui-transplant/components/ui/button'
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
  if (status === 'logged') return 'cancelled'
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
    <ArRemindersHubShell
      tab="activity"
      title="Activity & delivery"
      description="Scheduled SMS, confirmed sends, recorded internal events, failures, and blocked delivery."
    >
      <div className="mb-4 flex flex-wrap justify-end gap-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="h-9" render={<Link href={AR_ROUTES.remindersSequences} />}>
              Edit sequence
            </Button>
            <Button variant="outline" className="h-9" onClick={load} disabled={loading}>
              <RefreshCw className={cn('mr-1.5 size-3.5', loading && 'animate-spin')} aria-hidden="true" />
              Refresh
            </Button>
            <Button
              variant="outline"
              className="h-9"
              onClick={() => {
                window.location.href = '/api/appointment-reminders/export/reminders?days=30'
              }}
            >
              Export CSV
            </Button>
          </div>
      </div>

      <ArStatGrid className="mb-6">
        <Stat label="Scheduled" value={String(data?.summary.scheduled ?? '—')} icon={Bell} />
        <Stat label="Sent" value={String(data?.summary.sent30d ?? '—')} hint="Last 30 days" icon={Send} />
        <Stat label="Failed" value={String(data?.summary.failed7d ?? '—')} hint="Last 7 days" icon={AlertTriangle} />
        <Stat label="Blocked" value={String(data?.summary.blocked ?? '—')} icon={ShieldAlert} />
      </ArStatGrid>

      <OpusDataSurface
        toolbar={
          <>
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <OpusSearchField
                id="ar-reminders-search"
                label="Search reminders"
                value={qInput}
                onChange={setQInput}
                placeholder="Search customer or reminder"
                className="sm:max-w-xs"
              />
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
              {total > 0 ? `${start}–${end} of ${total}` : 'No reminders'}
            </p>
          </>
        }
        footer={
          total > 0 ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            </div>
          ) : undefined
        }
      >
        {loading ? (
          <OpusTableSkeleton label="Loading reminders" />
        ) : total === 0 ? (
          <EmptyState
            icon={Bell}
            title="No reminders in this view"
            description="Connect a calendar, select import calendars, and configure your SMS sequence."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" render={<Link href={AR_SETTINGS_INTEGRATIONS} />}>Connections</Button>
                <Button render={<Link href={AR_ROUTES.remindersSequences} />}>Configure sequence</Button>
              </div>
            }
          />
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
                      <span className="flex items-center gap-3">
                        <Initials name={row.customerLabel} className="size-8" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{row.customerLabel}</span>
                          <span className="block truncate text-xs text-muted-foreground">{row.appointmentLabel}</span>
                        </span>
                      </span>
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
      </OpusDataSurface>

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
    </ArRemindersHubShell>
  )
}
