'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { OPUS_TABLE_HEAD } from '@/newui-transplant/components/app/opus-surfaces'
import { th, td } from '@/newui-transplant/components/app/opus-tables'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'
import { Button } from '@/newui-transplant/components/ui/button'
import { Input } from '@/newui-transplant/components/ui/input'
import { ReminderStatusPill } from '@/newui-transplant/components/appointment-reminders/reminder-status-pill'
import type { AggregateReminderStatus } from '@/lib/appointment-reminders/aggregate-reminder-status'
import { cn } from '@/lib/utils'

type ActivityRow = {
  id: string
  at: string
  customerLabel: string
  bookingLabel: string
  reminderLabel: string
  channel: string
  status: string
  detail?: string
}

type WorkspaceStats = {
  scheduledCount: number
  sentToday: number
  failed7d: number
}

const PAGE_SIZE = 25

function statusToPill(status: string): { label: string; status: AggregateReminderStatus } {
  const s = status.toLowerCase()
  if (s.includes('fail')) return { label: status, status: 'failed' }
  if (s.includes('deliver')) return { label: status, status: 'delivered' }
  if (s.includes('sent') || s === 'logged') return { label: status, status: 'sent' }
  if (s.includes('skip')) return { label: status, status: 'not_scheduled' }
  return { label: status, status: 'scheduled' }
}

export function AppointmentRemindersLogPage() {
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [stats, setStats] = useState<WorkspaceStats | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/appointments/reminders/workspace')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => {
        setRows(json.activity || [])
        setStats(json.stats ?? null)
      })
      .catch(() => {
        setRows([])
        setStats(null)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    let list = rows
    if (statusFilter !== 'all') {
      list = list.filter((r) => r.status.toLowerCase() === statusFilter.toLowerCase())
    }
    const needle = q.trim().toLowerCase()
    if (needle) {
      list = list.filter(
        (r) =>
          r.customerLabel.toLowerCase().includes(needle) ||
          r.bookingLabel.toLowerCase().includes(needle) ||
          r.reminderLabel.toLowerCase().includes(needle),
      )
    }
    return list
  }, [rows, statusFilter, q])

  const total = filtered.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const end = Math.min(safePage * PAGE_SIZE, total)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [statusFilter, q])

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-6">
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-[1_1_70%]">
          <h1 className="text-[22px] font-semibold leading-7 tracking-tight">Reminders</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Delivery log for scheduled, sent, delivered, failed, and skipped reminder messages.
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
        <SummaryMetric label="Scheduled" value={loading ? '—' : String(stats?.scheduledCount ?? 0)} />
        <SummaryMetric label="Sent today" value={loading ? '—' : String(stats?.sentToday ?? 0)} />
        <SummaryMetric label="Failed (7 days)" value={loading ? '—' : String(stats?.failed7d ?? 0)} warn={(stats?.failed7d ?? 0) > 0} />
        <SummaryMetric label="Log entries" value={loading ? '—' : String(rows.length)} hint="All time in view" />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search reminders"
              className="h-9 pl-9"
              aria-label="Search reminders"
            />
          </div>
          <SimpleSelect
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'Sent', label: 'Sent' },
              { value: 'Failed', label: 'Failed' },
              { value: 'Skipped', label: 'Skipped' },
              { value: 'Logged', label: 'Scheduled' },
            ]}
            className="w-[160px]"
          />
        </div>
        <p className="text-xs text-muted-foreground whitespace-nowrap">
          {total > 0 ? `Showing ${start}–${end} of ${total} entries` : 'No entries'}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        {loading ? (
          <div className="space-y-0 divide-y p-2" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse bg-muted/30" />
            ))}
          </div>
        ) : pageRows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <h2 className="text-sm font-semibold">No reminders match this view</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {q.trim() ? 'Try another search term or clear filters.' : 'Reminder activity will appear here after sends.'}
            </p>
            {q.trim() ? (
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setQ('')}>
                Clear search
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={OPUS_TABLE_HEAD}>
                <tr>
                  <th scope="col" className={th}>When</th>
                  <th scope="col" className={th}>Customer</th>
                  <th scope="col" className={th}>Reminder</th>
                  <th scope="col" className={th}>Channel</th>
                  <th scope="col" className={th}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pageRows.map((row) => {
                  const pill = statusToPill(row.status)
                  return (
                    <tr key={row.id} className="hover:bg-muted/40">
                      <td className={td}>
                        <span className="block text-[13px]">{new Date(row.at).toLocaleString()}</span>
                      </td>
                      <td className={td}>
                        <span className="block text-[13px] font-medium">{row.customerLabel}</span>
                        <span className="block text-xs text-muted-foreground">{row.bookingLabel}</span>
                      </td>
                      <td className={td}>
                        <span className="text-[13px]">{row.reminderLabel}</span>
                      </td>
                      <td className={td}>
                        <span className="text-[13px]">{row.channel}</span>
                      </td>
                      <td className={td}>
                        <ReminderStatusPill label={pill.label} status={pill.status} />
                        {row.detail ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">{row.detail}</span>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > PAGE_SIZE ? (
        <footer className="flex flex-col gap-3 border-t px-2 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {start}–{end} of {total} entries
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {safePage} of {pageCount}</span>
            <Button variant="outline" size="sm" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>
              Next
            </Button>
          </div>
        </footer>
      ) : null}
    </div>
  )
}

function SummaryMetric({
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
