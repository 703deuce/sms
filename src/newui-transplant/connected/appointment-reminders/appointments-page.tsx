'use client'

import { useCallback, useEffect, useState } from 'react'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { Page, PageHeader, Panel } from '@/newui-transplant/components/app/kit'
import { OPUS_TABLE_HEAD } from '@/newui-transplant/components/app/opus-surfaces'
import { th, td } from '@/newui-transplant/components/app/opus-tables'
import { Button } from '@/newui-transplant/components/ui/button'

type Row = {
  id: string
  customerName: string
  phone: string | null
  startsAt: string
  serviceName: string
  reminderStatus: string | null
  calendarSource?: string | null
}

export function AppointmentRemindersAppointmentsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [selected, setSelected] = useState<Row | null>(null)
  const [timeline, setTimeline] = useState<Array<{ label: string; status: string; at?: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch('/api/appointments?tab=upcoming&take=50')
      .then((r) => {
        if (!r.ok) throw new Error('fetch')
        return r.json()
      })
      .then((json) => {
        const data = (json.data || []) as Array<Record<string, unknown>>
        setRows(
          data.map((a) => ({
            id: String(a.id),
            customerName: String(a.customerName || a.inviteeName || 'Customer'),
            phone: (a.phone as string) || (a.inviteePhone as string) || null,
            startsAt: String(a.startsAt),
            serviceName: String(a.serviceName || 'Appointment'),
            reminderStatus: (a.reminderStatus as string) || null,
            calendarSource: (a.calendarSource as string) || (a.source as string) || null,
          })),
        )
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!selected) {
      setTimeline([])
      return
    }
    fetch(`/api/appointments/${selected.id}/reminder-timeline`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const steps = json?.data?.steps || json?.data?.timeline || []
        setTimeline(
          (steps as Array<{ label?: string; status?: string; at?: string }>).map((s) => ({
            label: s.label || 'Reminder',
            status: s.status || 'scheduled',
            at: s.at,
          })),
        )
      })
      .catch(() => setTimeline([]))
  }, [selected])

  return (
    <Page>
      <PageHeader
        title="Appointments"
        description="Read-only view of upcoming appointments from connected calendars. This is not a booking editor."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            Refresh
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,360px)]">
        <Panel title="Upcoming" bodyClassName="p-0">
          {error ? (
            <p className="p-5 text-sm text-destructive">Could not load appointments.</p>
          ) : loading ? (
            <p className="p-5 text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              No upcoming appointments.{' '}
              <a href={AR_ROUTES.calendars} className="font-medium text-primary hover:underline">
                Connect a calendar
              </a>
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={OPUS_TABLE_HEAD}>
                  <tr>
                    <th scope="col" className={th}>Customer</th>
                    <th scope="col" className={th}>When</th>
                    <th scope="col" className={th}>Reminder</th>
                    <th scope="col" className={th}>Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setSelected(row)}
                      onKeyDown={(e) => e.key === 'Enter' && setSelected(row)}
                      tabIndex={0}
                    >
                      <td className={td}>
                        <span className="block font-medium">{row.customerName}</span>
                        {row.phone ? (
                          <span className="text-xs text-muted-foreground">{row.phone}</span>
                        ) : null}
                      </td>
                      <td className={td}>{new Date(row.startsAt).toLocaleString()}</td>
                      <td className={td}>{row.reminderStatus || '—'}</td>
                      <td className={td}>{row.calendarSource || 'Calendar'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Appointment details" description="Reminders scheduled for the selected row.">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select an appointment to see reminder steps.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium">{selected.customerName}</p>
                <p className="text-muted-foreground">{selected.serviceName}</p>
                <p className="text-muted-foreground">{new Date(selected.startsAt).toLocaleString()}</p>
              </div>
              <ol className="list-decimal space-y-2 pl-4">
                {timeline.length === 0 ? (
                  <li className="text-muted-foreground">No reminder timeline loaded.</li>
                ) : (
                  timeline.map((step, i) => (
                    <li key={`${step.label}-${i}`}>
                      <span className="font-medium">{step.label}</span>
                      <span className="text-muted-foreground"> — {step.status}</span>
                      {step.at ? (
                        <span className="block text-xs text-muted-foreground">
                          {new Date(step.at).toLocaleString()}
                        </span>
                      ) : null}
                    </li>
                  ))
                )}
              </ol>
            </div>
          )}
        </Panel>
      </div>
    </Page>
  )
}
