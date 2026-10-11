'use client'

import type { CalendarApiAppointment } from '@/features/appointments/kimi/calendar/map-calendar'
import { dayKeyInTimeZone } from '@/lib/appointment-reminders/calendar/ar-calendar-layout'
import { cn } from '@/lib/utils'

type UpcomingLite = {
  appointmentId: string
  customerName: string
  appointmentTitle: string
  startsAt: string
  nextReminder?: string
}

export function ArCalendarTodayPanel({
  cursor,
  view,
  timeZone,
  events,
  upcoming,
  className,
  onSelectAppointment,
}: {
  cursor: Date
  view: string
  timeZone: string
  events: CalendarApiAppointment[]
  upcoming?: UpcomingLite[]
  className?: string
  onSelectAppointment: (id: string) => void
}) {
  const dayKey = dayKeyInTimeZone(cursor, timeZone)
  const onSelectedDay = events.filter((e) => dayKeyInTimeZone(e.startsAt, timeZone) === dayKey)
  const sortedDay = [...onSelectedDay].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )
  const nextOnDay = sortedDay[0]
  const nextUpcoming = upcoming?.[0]

  const dateLabel = cursor.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone,
  })

  return (
    <div className={cn('flex flex-col gap-4 p-4', className)}>
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today</h2>
        <p className="mt-1 text-sm font-semibold text-foreground">{dateLabel}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {view === 'week' ? 'Week view' : view === 'month' ? 'Month view' : `${view} view`} ·{' '}
          {onSelectedDay.length} appointment{onSelectedDay.length === 1 ? '' : 's'} this day
        </p>
      </div>

      {nextOnDay ? (
        <button
          type="button"
          onClick={() => onSelectAppointment(nextOnDay.id)}
          className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Next on this day</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {nextOnDay.inviteeName || nextOnDay.serviceName || 'Appointment'}
          </p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {new Date(nextOnDay.startsAt).toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
              timeZone,
            })}
          </p>
        </button>
      ) : nextUpcoming ? (
        <button
          type="button"
          onClick={() => onSelectAppointment(nextUpcoming.appointmentId)}
          className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Next upcoming</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {nextUpcoming.customerName || nextUpcoming.appointmentTitle}
          </p>
          <p className="text-xs text-muted-foreground">{nextUpcoming.nextReminder || 'Reminders scheduled'}</p>
        </button>
      ) : (
        <p className="text-sm text-muted-foreground">No appointments on this day.</p>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Select an appointment on the calendar or use Activity &amp; attention below to open details, reminders, and
        conversations.
      </p>
    </div>
  )
}
