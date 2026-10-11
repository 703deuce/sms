'use client'

import type { CalendarApiAppointment } from '@/features/appointments/kimi/calendar/map-calendar'
import { dayKeyInTimeZone } from '@/lib/appointment-reminders/calendar/ar-calendar-layout'
import { customerDisplayName, serviceOrTitleLine } from '@/lib/appointment-reminders/calendar/calendar-event-display'
import { ArCalendarActivityPanel } from '@/newui-transplant/components/appointment-reminders/ar-calendar-activity-panel'
import type { ArOverviewFeedShape } from '@/lib/appointment-reminders/calendar/overview-feed-appointment-row'
import { cn } from '@/lib/utils'

function contextDateHeading(cursor: Date, timeZone: string) {
  const todayKey = dayKeyInTimeZone(new Date(), timeZone)
  const cursorKey = dayKeyInTimeZone(cursor, timeZone)
  const label = cursor.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone,
  })
  if (cursorKey === todayKey) return { title: 'Today', subtitle: label }
  return { title: 'Selected day', subtitle: label }
}

export function ArCalendarRightContextPanel({
  cursor,
  view,
  timeZone,
  events,
  overview,
  overviewLoading,
  onSelectAppointment,
  className,
}: {
  cursor: Date
  view: string
  timeZone: string
  events: CalendarApiAppointment[]
  overview: ArOverviewFeedShape | null
  overviewLoading?: boolean
  onSelectAppointment: (id: string, tab?: 'details' | 'reminders' | 'activity') => void
  className?: string
}) {
  const dayKey = dayKeyInTimeZone(cursor, timeZone)
  const onSelectedDay = events.filter((e) => dayKeyInTimeZone(e.startsAt, timeZone) === dayKey)
  const sortedDay = [...onSelectedDay].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )
  const nextOnDay = sortedDay[0]
  const { title, subtitle } = contextDateHeading(cursor, timeZone)

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="shrink-0 border-b px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        <p className="mt-1 text-sm font-semibold text-foreground">{subtitle}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {view} view · {onSelectedDay.length} appointment{onSelectedDay.length === 1 ? '' : 's'}
        </p>
        {nextOnDay ? (
          <button
            type="button"
            onClick={() => onSelectAppointment(nextOnDay.id)}
            className="mt-3 w-full rounded-lg border border-border bg-muted/15 px-3 py-2 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Next on this day</p>
            <p className="mt-1 truncate text-sm font-semibold">
              {customerDisplayName(nextOnDay) || serviceOrTitleLine(nextOnDay)}
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {new Date(nextOnDay.startsAt).toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
                timeZone,
              })}
            </p>
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ArCalendarActivityPanel
          data={overview}
          loading={overviewLoading}
          onSelectAppointment={onSelectAppointment}
          variant="context"
        />
      </div>
    </div>
  )
}
