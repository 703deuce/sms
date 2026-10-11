'use client'

import { AlertTriangle, CalendarDays, MessageSquare, Send } from 'lucide-react'
import type { CalendarApiAppointment } from '@/features/appointments/kimi/calendar/map-calendar'
import { dayKeyInTimeZone } from '@/lib/appointment-reminders/calendar/ar-calendar-layout'
import { customerDisplayName, serviceOrTitleLine } from '@/lib/appointment-reminders/calendar/calendar-event-display'
import type { ArOverviewFeedShape } from '@/lib/appointment-reminders/calendar/overview-feed-appointment-row'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { TextLink } from '@/newui-transplant/components/app/kit'
import { cn } from '@/lib/utils'

function contextDateHeading(focusDayKey: string, timeZone: string) {
  const todayKey = dayKeyInTimeZone(new Date(), timeZone)
  const label = new Date(`${focusDayKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone,
  })
  if (focusDayKey === todayKey) return { title: 'Today', subtitle: label }
  return { title: 'Selected day', subtitle: label }
}

function StatCell({
  label,
  value,
  icon,
  tone = 'neutral',
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  tone?: 'neutral' | 'warning' | 'primary'
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border/80 bg-muted/10 px-2.5 py-2',
        tone === 'warning' && 'border-amber-500/30 bg-amber-500/5',
        tone === 'primary' && 'border-primary/25 bg-primary/5',
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="text-muted-foreground/90" aria-hidden>{icon}</span>
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

export function ArCalendarRightContextPanel({
  focusDayKey,
  view,
  timeZone,
  events,
  overview,
  overviewLoading,
  onSelectAppointment,
  className,
}: {
  focusDayKey: string
  view: string
  timeZone: string
  events: CalendarApiAppointment[]
  overview: ArOverviewFeedShape | null
  overviewLoading?: boolean
  onSelectAppointment: (id: string, tab?: 'details' | 'reminders' | 'activity') => void
  className?: string
}) {
  const onSelectedDay = events.filter((e) => dayKeyInTimeZone(e.startsAt, timeZone) === focusDayKey)
  const sortedDay = [...onSelectedDay].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )
  const nextOnDay = sortedDay[0]
  const { title, subtitle } = contextDateHeading(focusDayKey, timeZone)
  const ops = overview?.operationalSummary
  const sends = overview?.upcomingScheduledSends ?? []

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="shrink-0 border-b px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Reminder operations
        </p>
        {overviewLoading ? (
          <div className="mt-2 h-20 animate-pulse rounded-lg bg-muted/40" aria-busy="true" />
        ) : ops ? (
          <>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{ops.rangeLabel}</p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <StatCell label="Appointments" value={ops.appointments} icon={<CalendarDays className="size-3.5" />} />
              <StatCell
                label="Scheduled"
                value={ops.scheduledSends}
                icon={<Send className="size-3.5" />}
                tone="primary"
              />
              <StatCell label="Replies" value={ops.replies} icon={<MessageSquare className="size-3.5" />} />
              <StatCell
                label="Attention"
                value={ops.attention}
                icon={<AlertTriangle className="size-3.5" />}
                tone={ops.attention > 0 ? 'warning' : 'neutral'}
              />
            </div>
          </>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {onSelectedDay.length} on calendar
          </span>
        </div>
        <p className="mt-0.5 text-sm font-semibold text-foreground">{subtitle}</p>
        <p className="text-[11px] text-muted-foreground">{view} view</p>
        {nextOnDay ? (
          <button
            type="button"
            onClick={() => onSelectAppointment(nextOnDay.id)}
            className="mt-2 w-full rounded-lg border border-border bg-muted/15 px-3 py-2 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upcoming sends</h3>
          <span className="text-[11px]">
            <TextLink href={AR_ROUTES.reminders}>View all</TextLink>
          </span>
        </div>
        {overviewLoading ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : sends.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 px-3 py-2.5 text-xs text-muted-foreground">
            No platform reminder sends are scheduled in the upcoming window. Workflow-managed appointments are shown
            on each appointment&apos;s Reminders tab.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {sends.map((row) => (
              <li key={row.appointmentId}>
                <button
                  type="button"
                  onClick={() => onSelectAppointment(row.appointmentId, 'reminders')}
                  className="w-full rounded-lg border border-border/80 bg-card px-2.5 py-2 text-left transition-colors hover:border-primary/30 hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {row.customerName || row.appointmentTitle}
                  </p>
                  <p className="mt-0.5 text-[11px] text-foreground">
                    {row.stepLabel} · {row.channel}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{row.sendAtLabel}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
