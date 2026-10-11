'use client'

import { Bell, BellOff, ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalendarApiAppointment } from '@/features/appointments/kimi/calendar/map-calendar'
import type { CalendarViewMode } from '@/features/appointments/kimi/calendar/types'
import {
  AR_CALENDAR_DAY_END_HOUR,
  AR_CALENDAR_DAY_START_HOUR,
  AR_CALENDAR_HOUR_PX,
  buildMonthGrid,
  eventHeightPx,
  eventTitle,
  eventTopPx,
  formatArCalendarSubtitle,
  formatArCalendarTitle,
  formatEventTime,
  groupEventsByDay,
  hourLabels,
  startOfWeek,
  weekDayHeaders,
  dayKeyInTimeZone,
  zonedCalendarParts,
} from '@/lib/appointment-reminders/calendar/ar-calendar-layout'
import { OpusDataSurface } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { Segmented } from '@/newui-transplant/components/app/segmented-nav'
import { OPUS_INSET_LIST } from '@/newui-transplant/components/app/opus-surfaces'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'
import { Button } from '@/newui-transplant/components/ui/button'
import { cn } from '@/lib/utils'

export type ArCalendarFilterOption = { value: string; label: string }

const VIEW_OPTIONS: CalendarViewMode[] = ['day', 'week', 'month', 'agenda']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function reminderBlockHint(ev: CalendarApiAppointment): 'off' | 'blocked' | 'on' | null {
  const meta = ev.metadata || {}
  if (meta.remindersSuppressed || (meta.reminderOverride as { suppressed?: boolean })?.suppressed) {
    return 'off'
  }
  if (meta.reminderImportIneligibleReason || meta.reminderSmsIneligibleReason) {
    return 'blocked'
  }
  if (ev.status === 'canceled') return null
  return 'on'
}

function ReminderDot({ state }: { state: 'off' | 'blocked' | 'on' }) {
  if (state === 'off') {
    return <BellOff className="size-3 shrink-0 text-muted-foreground" aria-hidden />
  }
  if (state === 'blocked') {
    return (
      <span
        className="size-2 shrink-0 rounded-full bg-amber-500"
        title="Reminder needs attention"
        aria-hidden
      />
    )
  }
  return <Bell className="size-3 shrink-0 text-primary/70" aria-hidden />
}

function EventChip({
  ev,
  timeZone,
  onSelect,
  compact,
}: {
  ev: CalendarApiAppointment
  timeZone: string
  onSelect: (id: string) => void
  compact?: boolean
}) {
  const canceled = ev.status === 'canceled'
  const reminder = reminderBlockHint(ev)
  return (
    <button
      type="button"
      onClick={() => onSelect(ev.id)}
      className={cn(
        'w-full rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        canceled
          ? 'border-border/60 bg-muted/40 text-muted-foreground line-through'
          : 'border-primary/25 bg-primary/10 text-foreground hover:bg-primary/15',
        compact ? 'py-1' : '',
      )}
    >
      <span className={cn('flex items-center gap-1.5 font-medium', compact ? 'truncate' : 'line-clamp-2')}>
        {reminder ? <ReminderDot state={reminder} /> : null}
        <span className="truncate">{eventTitle(ev)}</span>
      </span>
      <span className="mt-0.5 block text-[11px] font-semibold tabular-nums text-muted-foreground">
        {formatEventTime(ev.startsAt, timeZone)}
      </span>
      {!compact && ev.inviteeName && ev.serviceName ? (
        <span className="mt-0.5 block truncate text-muted-foreground">{ev.inviteeName}</span>
      ) : null}
    </button>
  )
}

function MonthView({
  cursor,
  events,
  timeZone,
  onSelect,
  onSelectDay,
}: {
  cursor: Date
  events: CalendarApiAppointment[]
  timeZone: string
  onSelect: (id: string) => void
  onSelectDay?: (date: Date, dayKey: string) => void
}) {
  const cells = buildMonthGrid(cursor, timeZone)
  const byDay = groupEventsByDay(events, timeZone)

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {DOW.map((label) => (
          <div
            key={label}
            className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const dayEvents = byDay.get(cell.key) || []
          return (
            <div
              key={cell.key}
              className={cn(
                'min-h-[120px] border-b border-r border-border/70 p-2 last:border-r-0',
                !cell.inMonth && 'bg-muted/20',
                cell.isToday && 'bg-primary/[0.06]',
              )}
            >
              <div className="mb-1.5 flex justify-end">
                <button
                  type="button"
                  onClick={() => onSelectDay?.(cell.date, cell.key)}
                  className={cn(
                    'inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
                    'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    cell.isToday
                      ? 'bg-primary text-primary-foreground'
                      : cell.inMonth
                        ? 'text-foreground'
                        : 'text-muted-foreground',
                  )}
                  aria-label={`View day ${cell.key}`}
                >
                  {cell.dayNum}
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {dayEvents.slice(0, 3).map((ev) => (
                  <EventChip key={ev.id} ev={ev} timeZone={timeZone} onSelect={onSelect} compact />
                ))}
                {dayEvents.length > 3 ? (
                  <p className="px-1 text-[10px] font-medium text-muted-foreground">
                    +{dayEvents.length - 3} more
                  </p>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TimeGridView({
  cursor,
  view,
  events,
  timeZone,
  onSelect,
  fillViewport,
  selectedEventId,
}: {
  cursor: Date
  view: 'day' | 'week'
  events: CalendarApiAppointment[]
  timeZone: string
  onSelect: (id: string) => void
  fillViewport?: boolean
  selectedEventId?: string | null
}) {
  const hours = hourLabels()
  const totalHeight = (AR_CALENDAR_DAY_END_HOUR - AR_CALENDAR_DAY_START_HOUR) * AR_CALENDAR_HOUR_PX
  const days =
    view === 'day'
      ? [
          {
            key: dayKeyInTimeZone(cursor, timeZone),
            date: cursor,
            weekday: cursor.toLocaleDateString('en-US', { weekday: 'short', timeZone }),
            dayNum: String(zonedCalendarParts(cursor, timeZone).day),
            isToday: dayKeyInTimeZone(cursor, timeZone) === dayKeyInTimeZone(new Date(), timeZone),
          },
        ]
      : weekDayHeaders(cursor, timeZone)

  const eventsForDay = (dayKey: string) =>
    events.filter((ev) => dayKeyInTimeZone(ev.startsAt, timeZone) === dayKey)

  const grid = (
      <div
        className="grid min-w-[640px]"
        style={{
          gridTemplateColumns: `4.5rem repeat(${days.length}, minmax(0, 1fr))`,
          minHeight: totalHeight,
        }}
      >
        <div className="border-b bg-muted/40" />
        {days.map((d) => (
          <div
            key={d.key}
            className={cn(
              'border-b border-l px-2 py-3 text-center',
              d.isToday ? 'bg-primary/[0.06]' : 'bg-muted/40',
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{d.weekday}</p>
            <p
              className={cn(
                'mt-0.5 text-lg font-semibold tabular-nums',
                d.isToday ? 'text-primary' : 'text-foreground',
              )}
            >
              {d.dayNum}
            </p>
          </div>
        ))}

        <div className="relative border-r bg-muted/20">
          {hours.map((label, i) => (
            <div
              key={label}
              className="border-b pr-2 text-right text-[11px] font-medium text-muted-foreground"
              style={{ height: AR_CALENDAR_HOUR_PX }}
            >
              <span className="-mt-2 inline-block">{i === 0 ? label : label}</span>
            </div>
          ))}
        </div>

        {days.map((d) => (
          <div key={d.key} className="relative border-l" style={{ height: totalHeight }}>
            {hours.map((_, i) => (
              <div
                key={i}
                className="border-b border-border/50"
                style={{ height: AR_CALENDAR_HOUR_PX }}
                aria-hidden="true"
              />
            ))}
            {eventsForDay(d.key).map((ev) => {
              const reminder = reminderBlockHint(ev)
              return (
              <button
                key={ev.id}
                type="button"
                onClick={() => onSelect(ev.id)}
                className={cn(
                  'absolute inset-x-1 z-10 overflow-hidden rounded-lg border px-2 py-1.5 text-left text-xs shadow-sm',
                  'border-primary/30 bg-primary/10 hover:bg-primary/15',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  ev.id === selectedEventId && 'ring-2 ring-primary/50 border-primary/50 bg-primary/15',
                  reminder === 'blocked' && 'border-amber-500/40 bg-amber-500/10',
                )}
                style={{
                  top: eventTopPx(ev.startsAt, timeZone),
                  height: eventHeightPx(ev.startsAt, ev.endsAt, timeZone),
                  minHeight: 28,
                }}
              >
                <span className="flex items-center gap-1 font-medium leading-snug">
                  {reminder ? <ReminderDot state={reminder} /> : null}
                  <span className="line-clamp-2">{eventTitle(ev)}</span>
                </span>
                <span className="mt-0.5 truncate text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {formatEventTime(ev.startsAt, timeZone)}
                </span>
              </button>
            )})}
          </div>
        ))}
      </div>
  )

  if (fillViewport) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-background">
        <div className="h-full min-h-0 overflow-auto overscroll-contain">
          {grid}
        </div>
      </div>
    )
  }

  return <div className="overflow-x-auto rounded-lg border bg-background">{grid}</div>
}

function AgendaView({
  cursor,
  events,
  timeZone,
  onSelect,
}: {
  cursor: Date
  events: CalendarApiAppointment[]
  timeZone: string
  onSelect: (id: string) => void
}) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )
  if (!sorted.length) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">No appointments in this range.</p>
    )
  }
  return (
    <ul className={cn(OPUS_INSET_LIST, 'mx-0')}>
      {sorted.map((ev) => (
        <li key={ev.id}>
          <button
            type="button"
            onClick={() => onSelect(ev.id)}
            className="flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <span className="text-sm font-semibold">{eventTitle(ev)}</span>
            <span className="text-sm text-muted-foreground">
              {new Date(ev.startsAt).toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone,
              })}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function ArCalendarOpusView({
  view,
  cursor,
  events,
  timeZone,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onSelectEvent,
  onSelectDay,
  calendarFilter,
  calendarFilterOptions,
  onCalendarFilterChange,
  compactChrome,
  fillHeight,
  selectedEventId,
}: {
  view: CalendarViewMode
  cursor: Date
  events: CalendarApiAppointment[]
  timeZone: string
  onViewChange: (view: CalendarViewMode) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onSelectEvent: (id: string) => void
  /** Month grid: open day view for the selected date. */
  onSelectDay?: (date: Date, dayKey: string) => void
  calendarFilter?: string
  calendarFilterOptions?: ArCalendarFilterOption[]
  onCalendarFilterChange?: (connectionId: string) => void
  /** Workspace layout: toolbar only, no duplicate page title. */
  compactChrome?: boolean
  fillHeight?: boolean
  selectedEventId?: string | null
}) {
  const title = formatArCalendarTitle(cursor, view, timeZone)
  const subtitle = formatArCalendarSubtitle(cursor, view, timeZone)

  return (
    <OpusDataSurface
      className={cn('overflow-hidden', fillHeight ? 'flex min-h-0 flex-1 flex-col' : '')}
    >
      <div
        className={cn(
          'border-b bg-gradient-to-b from-card to-muted/25 px-4 py-3 md:px-5',
          compactChrome ? 'py-2.5' : 'px-5 py-5 md:px-6',
        )}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {!compactChrome ? (
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Calendar</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-balance md:text-3xl">{title}</h2>
              {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
          ) : (
            <div className="min-w-0">
              <p className="text-sm font-semibold tabular-nums text-foreground">{title}</p>
              {subtitle ? <p className="text-[11px] text-muted-foreground">{subtitle}</p> : null}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onToday}>
              Today
            </Button>
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="icon-sm" onClick={onPrev} aria-label="Previous">
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
              <Button type="button" variant="outline" size="icon-sm" onClick={onNext} aria-label="Next">
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <Segmented
              label="Calendar view"
              options={VIEW_OPTIONS}
              value={view}
              onChange={(v) => onViewChange(v as CalendarViewMode)}
              formatLabel={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
            />
            {calendarFilterOptions && calendarFilterOptions.length > 1 && onCalendarFilterChange ? (
              <SimpleSelect
                id="ar-calendar-connection-filter"
                label="Calendars"
                value={calendarFilter || 'all'}
                onChange={onCalendarFilterChange}
                options={calendarFilterOptions}
                className="w-[min(220px,100%)] shrink-0"
              />
            ) : null}
          </div>
        </div>
      </div>

      <div
        className={cn(
          'p-3 md:p-4',
          fillHeight ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : '',
        )}
      >
        {view === 'month' ? (
          <div className={fillHeight ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain' : undefined}>
          <MonthView
            cursor={cursor}
            events={events}
            timeZone={timeZone}
            onSelect={onSelectEvent}
            onSelectDay={onSelectDay}
          />
          </div>
        ) : null}
        {view === 'week' || view === 'day' ? (
          <div className={fillHeight ? 'flex min-h-0 flex-1 flex-col' : undefined}>
          <TimeGridView
            cursor={view === 'week' ? startOfWeek(cursor) : cursor}
            view={view}
            events={events}
            timeZone={timeZone}
            onSelect={onSelectEvent}
            fillViewport={fillHeight}
            selectedEventId={selectedEventId}
          />
          </div>
        ) : null}
        {view === 'agenda' ? (
          <div className={fillHeight ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain' : undefined}>
          <AgendaView cursor={cursor} events={events} timeZone={timeZone} onSelect={onSelectEvent} />
          </div>
        ) : null}
      </div>
    </OpusDataSurface>
  )
}
