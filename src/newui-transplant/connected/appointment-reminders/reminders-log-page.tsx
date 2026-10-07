'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Page, PageHeader, Panel } from '@/newui-transplant/components/app/kit'
import { OPUS_TABLE_HEAD } from '@/newui-transplant/components/app/opus-surfaces'
import { th, td } from '@/newui-transplant/components/app/opus-tables'
import { Button } from '@/newui-transplant/components/ui/button'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'

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

export function AppointmentRemindersLogPage() {
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/appointments/reminders/workspace')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => setRows(json.activity || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return rows
    return rows.filter((r) => r.status.toLowerCase() === statusFilter.toLowerCase())
  }, [rows, statusFilter])

  return (
    <Page>
      <PageHeader
        title="Reminders"
        description="Delivery log for upcoming, sent, delivered, failed, and skipped reminders."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SimpleSelect
              value={statusFilter}
              onChange={setStatusFilter}
              label="Filter by status"
              options={[
                { value: 'all', label: 'All statuses' },
                { value: 'Sent', label: 'Sent' },
                { value: 'Failed', label: 'Failed' },
                { value: 'Skipped', label: 'Skipped' },
                { value: 'Logged', label: 'Scheduled' },
              ]}
            />
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              Refresh
            </Button>
          </div>
        }
      />

      <Panel bodyClassName="p-0">
        {loading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No reminders match this filter.</p>
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
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className={td}>{new Date(row.at).toLocaleString()}</td>
                    <td className={td}>
                      <span className="block font-medium">{row.customerLabel}</span>
                      <span className="text-xs text-muted-foreground">{row.bookingLabel}</span>
                    </td>
                    <td className={td}>{row.reminderLabel}</td>
                    <td className={td}>{row.channel}</td>
                    <td className={td}>
                      {row.status}
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
      </Panel>
    </Page>
  )
}
