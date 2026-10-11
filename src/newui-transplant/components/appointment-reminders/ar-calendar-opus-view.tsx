'use client'

import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MessageSquare,
  Phone,
  Send,
} from 'lucide-react'
import type { CalendarApiAppointment } from '@/features/appointments/kimi/calendar/map-calendar'
import type { CalendarViewMode } from '@/features/appointments/kimi/calendar/types'
import {
  type ArCalendarGrid,
  buildMonthGrid,
  currentTimeTopPx,
  eventHeightPx,
  eventTopPx,
  formatArCalendarSubtitle,
  formatArCalendarTitle,
  formatEventTime,
  groupEventsByDay,
  hourLabels,
  layoutDayEventColumns,
  startOfWeek,
  weekDayHeaders,
  dayKeyInTimeZone,
  zonedCalendarParts,
} from '@/lib/appointment-reminders/calendar/ar-calendar-layout'
import {
  loadArCalendarDisplayPrefs,
  resolveDisplayGrid,
  type ArCalendarDisplayPrefs,
} from '@/lib/appointment-reminders/calendar/ar-calendar-display-prefs'
import type { CalendarEventEnrichment } from '@/lib/appointment-reminders/calendar/calendar-event-display'
import {
  eventToneClasses,
  eventTooltipTitle,
  eventVisualTone,
  customerDisplayName,
  formatEventBlockLines,
  pickEventBlockLayout,
  pickEventStatusIcon,
  serviceOrTitleLine,
  type EventStatusIconKind,
} from '@/lib/appointment-reminders/calendar/calendar-event-display'
import { ArCalendarAgendaView } from '@/newui-transplant/components/appointment-reminders/ar-calendar-agenda-view'
import { ArCalendarDisplayMenu } from '@/newui-transplant/components/appointment-reminders/ar-calendar-display-menu'
import { OpusDataSurface } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { Segmented } from '@/newui-transplant/components/app/segmented-nav'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'
import { Button } from '@/newui-transplant/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/newui-transplant/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type ArCalendarFilterOption = { value: string; label: string }

const VIEW_OPTIONS: CalendarViewMode[] = ['day', 'week', 'month', 'agenda']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function EventStatusIcon({ kind }: { kind: EventStatusIconKind }) {
  switch (kind) {
    case 'off':
      return <BellOff className="size-3 shrink-0 text-muted-foreground" aria-hidden />
    case 'phone':
      return <Phone className="size-3 shrink-0 text-amber-600" aria-hidden />
    case 'attention':
      return <AlertTriangle className="size-3 shrink-0 text-amber-600" aria-hidden />
    case 'confirmed':
      return <CheckCircle2 className="size-3 shrink-0 text-emerald-600" aria-hidden />
    case 'reply':
      return <MessageSquare className="size-3 shrink-0 text-primary" aria-hidden />
    case 'sent':
      return <Send className="size-3 shrink-0 text-primary" aria-hidden />
    default:
      return <Clock3 className="size-3 shrink-0 text-primary/80" aria-hidden />
  }
}

function CalendarEventBlock({
  ev,
  timeZone,
  heightPx,
  widthHint,
  enrichment,
  selected,
  onSelect,
  className,
  style,
}: {
  ev: CalendarApiAppointment
  timeZone: string
  heightPx: number
  widthHint?: 'narrow' | 'wide'
  enrichment?: CalendarEventEnrichment | null
  selected?: boolean
  onSelect: (id: string) => void
  className?: string
  style?: CSSProperties
}) {
  const canceled = ev.status === 'canceled'
  const statusIcon = ev.status === 'canceled' ? null : pickEventStatusIcon(ev, enrichment)
  const layout = pickEventBlockLayout(heightPx, widthHint)
  const lines = formatEventBlockLines(ev, timeZone, layout, enrichment)
  const tone = eventVisualTone(ev, enrichment)
  const tip = eventTooltipTitle(ev, timeZone, enrichment)
  const phone = ev.inviteePhone?.trim() || (ev.metadata?.inviteePhone as string) || ''

  const block = (
    <button
      type="button"
      onClick={() => onSelect(ev.id)}
      style={style}
      className={cn(
        'overflow-hidden rounded-md border-l-[3px] border px-1.5 py-1 text-left shadow-sm transition-colors',
        'hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        canceled
          ? 'border-border/60 bg-muted/40 text-muted-foreground line-through'
          : eventToneClasses(tone),
        selected && 'ring-2 ring-primary/55',
        className,
      )}
    >
      <span className="flex items-start gap-1 leading-snug">
        {statusIcon ? <EventStatusIcon kind={statusIcon} /> : null}
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold leading-tight">{lines.line1}</span>
          {lines.line2 ? (
            <span className="mt-0.5 block truncate text-[10px] font-medium text-foreground/90">{lines.line2}</span>
          ) : null}
          {lines.line3 ? (
            <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{lines.line3}</span>
          ) : null}
        </span>
      </span>
    </button>
  )

  if (canceled) return block

  return (
    <Tooltip>
      <TooltipTrigger render={block} />
      <TooltipContent side="right" className="max-w-[240px] space-y-1 p-2.5 text-left">
        <p className="font-semibold">{tip.service}</p>
        <p className="text-background/90">{tip.customer}</p>
        <p className="text-background/80">{tip.when}</p>
        {phone ? <p className="text-background/80">SMS: {phone}</p> : null}
        {tip.status ? <p className="text-background/90">{tip.status}</p> : null}
      </TooltipContent>
    </Tooltip>
  )
}

function MonthEventPill({
  ev,
  timeZone,
  enrichment,
  onSelect,
}: {
  ev: CalendarApiAppointment
  timeZone: string
  enrichment?: CalendarEventEnrichment | null
  onSelect: (id: string) => void
}) {
  const time = formatEventTime(ev.startsAt, timeZone)
  const customer = customerDisplayName(ev)
  const service = serviceOrTitleLine(ev)
  const primary = customer || service
  const tone = eventVisualTone(ev, enrichment)
  const tip = `${time} · ${service} · ${customer || '—'}`

  return (
    <button
      type="button"
      onClick={() => onSelect(ev.id)}
      title={tip}
      className={cn(
        'flex w-full max-w-full items-center gap-1 overflow-hidden rounded px-1.5 py-0.5 text-left',
        'border-l-2 text-[10px] leading-tight',
        eventToneClasses(tone),
        'hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      )}
    >
      <span className="shrink-0 font-semibold tabular-nums">{time}</span>
      <span className="min-w-0 truncate font-medium">{primary}</span>
    </button>
  )
}

function MonthView({
  cursor,
  events,
  timeZone,
  onSelect,
  onSelectDay,
  enrichment,
}: {
  cursor: Date
  events: CalendarApiAppointment[]
  timeZone: string
  onSelect: (id: string) => void
  onSelectDay?: (date: Date, dayKey: string) => void
  enrichment?: Map<string, CalendarEventEnrichment>
}) {
  const cells = buildMonthGrid(cursor, timeZone)
  const byDay = groupEventsByDay(events, timeZone)

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-background">
      <div className="grid shrink-0 grid-cols-7 border-b bg-muted/40">
        {DOW.map((label) => (
          <div
            key={label}
            className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 overflow-y-auto overscroll-contain">
        {cells.map((cell) => {
          const dayEvents = byDay.get(cell.key) || []
          return (
            <div
              key={cell.key}
              className={cn(
                'flex min-h-[108px] flex-col overflow-hidden border-b border-r border-border/70 p-1 last:border-r-0',
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
              <div className="mt-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 2).map((ev) => (
                  <MonthEventPill
                    key={ev.id}
                    ev={ev}
                    timeZone={timeZone}
                    onSelect={onSelect}
                    enrichment={enrichment?.get(ev.id)}
                  />
                ))}
                {dayEvents.length > 2 ? (
                  <button
                    type="button"
                    onClick={() => onSelectDay?.(cell.date, cell.key)}
                    className="px-1 py-0.5 text-left text-[10px] font-medium text-primary hover:underline"
                  >
                    +{dayEvents.length - 2} more
                  </button>
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
  enrichment,
  grid: displayGrid,
}: {
  cursor: Date
  view: 'day' | 'week'
  events: CalendarApiAppointment[]
  timeZone: string
  onSelect: (id: string) => void
  fillViewport?: boolean
  selectedEventId?: string | null
  enrichment?: Map<string, CalendarEventEnrichment>
  grid: ArCalendarGrid
}) {
  const hours = hourLabels(displayGrid)
  const totalHeight = (displayGrid.endHour - displayGrid.startHour) * displayGrid.hourPx
  const nowLine = currentTimeTopPx(timeZone, displayGrid)
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

  const timeGrid = (
      <div
        className="grid min-w-[640px]"
        style={{
          gridTemplateColumns: `3.75rem repeat(${days.length}, minmax(0, 1fr))`,
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
              style={{ height: displayGrid.hourPx }}
            >
              <span className="-mt-2 inline-block">{i === 0 ? label : label}</span>
            </div>
          ))}
        </div>

        {days.map((d) => {
          const dayEvents = eventsForDay(d.key)
          const layout = layoutDayEventColumns(dayEvents)
          return (
          <div key={d.key} className="relative border-l" style={{ height: totalHeight }}>
            {hours.map((_, i) => (
              <div
                key={i}
                className="border-b border-border/50"
                style={{ height: displayGrid.hourPx }}
                aria-hidden="true"
              />
            ))}
            {nowLine && nowLine.dayKey === d.key ? (
              <div
                className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-primary"
                style={{ top: nowLine.top }}
                aria-hidden
              >
                <span className="absolute -left-1 -top-2 rounded bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                  Now
                </span>
              </div>
            ) : null}
            {dayEvents.map((ev) => {
              const h = eventHeightPx(ev.startsAt, ev.endsAt, timeZone, displayGrid)
              const slot = layout.get(ev.id) || { col: 0, cols: 1 }
              const widthPct = 100 / slot.cols
              const leftPct = slot.col * widthPct
              return (
                <CalendarEventBlock
                  key={ev.id}
                  ev={ev}
                  timeZone={timeZone}
                  heightPx={h}
                  widthHint={view === 'week' ? 'narrow' : 'wide'}
                  enrichment={enrichment?.get(ev.id)}
                  selected={ev.id === selectedEventId}
                  onSelect={onSelect}
                  className="absolute z-10"
                  style={{
                    top: eventTopPx(ev.startsAt, timeZone, displayGrid),
                    height: h,
                    minHeight: 34,
                    left: `calc(${leftPct}% + 2px)`,
                    width: `calc(${widthPct}% - 4px)`,
                  }}
                />
              )
            })}
          </div>
          )
        })}
      </div>
  )

  if (fillViewport) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-background">
        <div className="h-full min-h-0 overflow-auto overscroll-contain">
          {timeGrid}
        </div>
      </div>
    )
  }

  return <div className="overflow-x-auto rounded-lg border bg-background">{timeGrid}</div>
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
  enrichment,
  onSelectEventWithTab,
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
  enrichment?: Map<string, CalendarEventEnrichment>
  onSelectEventWithTab?: (id: string, tab?: 'details' | 'reminders' | 'activity') => void
}) {
  const handleAgendaSelect = (id: string, tab?: 'details' | 'reminders' | 'activity') => {
    if (onSelectEventWithTab) onSelectEventWithTab(id, tab)
    else onSelectEvent(id)
  }
  const title = formatArCalendarTitle(cursor, view, timeZone)
  const subtitle = formatArCalendarSubtitle(cursor, view, timeZone)
  const [displayPrefs, setDisplayPrefs] = useState<ArCalendarDisplayPrefs>(() => loadArCalendarDisplayPrefs())
  const grid = useMemo(() => resolveDisplayGrid(displayPrefs), [displayPrefs])

  useEffect(() => {
    setDisplayPrefs(loadArCalendarDisplayPrefs())
  }, [])

  return (
    <TooltipProvider delay={400}>
    <OpusDataSurface
      className={cn('overflow-hidden', fillHeight ? 'flex min-h-0 flex-1 flex-col' : '')}
    >
      <div
        className={cn(
          'border-b bg-gradient-to-b from-card to-muted/25 px-3 py-2.5 md:px-4',
          compactChrome ? '' : 'px-5 py-5 md:px-6',
        )}
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
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
          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={onToday}>
              Today
            </Button>
            <div className="flex items-center gap-0.5">
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
                className="h-8 w-[min(200px,100%)] shrink-0 text-xs"
              />
            ) : null}
            <ArCalendarDisplayMenu prefs={displayPrefs} onChange={setDisplayPrefs} />
          </div>
        </div>
      </div>

      <div
        className={cn(
          'p-2 md:p-3',
          fillHeight ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : '',
        )}
      >
        {view === 'month' ? (
          <div className={fillHeight ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : undefined}>
          <MonthView
            cursor={cursor}
            events={events}
            timeZone={timeZone}
            onSelect={onSelectEvent}
            onSelectDay={onSelectDay}
            enrichment={enrichment}
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
            enrichment={enrichment}
            grid={grid}
          />
          </div>
        ) : null}
        {view === 'agenda' ? (
          <div className={fillHeight ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : undefined}>
            <ArCalendarAgendaView
              events={events}
              timeZone={timeZone}
              enrichment={enrichment ?? new Map()}
              selectedId={selectedEventId}
              onSelect={handleAgendaSelect}
            />
          </div>
        ) : null}
      </div>
    </OpusDataSurface>
    </TooltipProvider>
  )
}
