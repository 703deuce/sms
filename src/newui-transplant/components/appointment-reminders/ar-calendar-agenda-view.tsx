'use client'

import { useMemo } from 'react'
import { CalendarDays, MessageSquare, Send } from 'lucide-react'
import type { CalendarApiAppointment } from '@/features/appointments/kimi/calendar/map-calendar'
import type { CalendarEventEnrichment } from '@/lib/appointment-reminders/calendar/calendar-event-display'
import {
  customerDisplayName,
  eventStatusLine,
  eventVisualTone,
  serviceOrTitleLine,
} from '@/lib/appointment-reminders/calendar/calendar-event-display'
import { dayKeyInTimeZone, formatEventTime } from '@/lib/appointment-reminders/calendar/ar-calendar-layout'
import { compactReminderFeedLine, isWorkflowManagedReminder } from '@/lib/appointment-reminders/calendar/reminder-display-copy'
import { EmptyState, Pill } from '@/newui-transplant/components/app/kit'
import { OPUS_INSET_LIST } from '@/newui-transplant/components/app/opus-surfaces'
import { cn } from '@/lib/utils'

function toneForPill(tone: ReturnType<typeof eventVisualTone>): 'neutral' | 'success' | 'warning' | 'danger' | 'primary' {
  if (tone === 'confirmed') return 'success'
  if (tone === 'attention') return 'warning'
  if (tone === 'failed') return 'danger'
  if (tone === 'scheduled') return 'primary'
  return 'neutral'
}

export function ArCalendarAgendaView({
  events,
  timeZone,
  enrichment,
  selectedId,
  onSelect,
}: {
  events: CalendarApiAppointment[]
  timeZone: string
  enrichment: Map<string, CalendarEventEnrichment>
  selectedId?: string | null
  onSelect: (id: string, tab?: 'details' | 'reminders' | 'activity') => void
}) {
  const grouped = useMemo(() => {
    const sorted = [...events].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )
    const byDay = new Map<string, CalendarApiAppointment[]>()
    for (const ev of sorted) {
      const key = dayKeyInTimeZone(ev.startsAt, timeZone)
      const list = byDay.get(key) || []
      list.push(ev)
      byDay.set(key, list)
    }
    return [...byDay.entries()].map(([key, list]) => ({
      key,
      label: new Date(list[0].startsAt).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        timeZone,
      }),
      list,
    }))
  }, [events, timeZone])

  if (!events.length) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No appointments in this range"
        description="Try another date range or check your calendar filter."
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-background">
      <div className="hidden shrink-0 border-b bg-muted/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[30%_23%_28%_19%] md:gap-2">
        <span>Appointment</span>
        <span>Customer</span>
        <span>Reminders / messages</span>
        <span>Response</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {grouped.map((group) => (
          <section key={group.key} className="border-b border-border/70 last:border-b-0">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-3 py-2 backdrop-blur-sm">
              <p className="text-xs font-semibold text-foreground">{group.label}</p>
              <p className="text-[11px] tabular-nums text-muted-foreground">
                {group.list.length} appointment{group.list.length === 1 ? '' : 's'}
              </p>
            </div>
            <ul className={cn(OPUS_INSET_LIST, 'mx-0 divide-y divide-border/60')}>
              {group.list.map((ev) => {
                const en = enrichment.get(ev.id)
                const tone = eventVisualTone(ev, en)
                const customer = customerDisplayName(ev)
                const phone = ev.inviteePhone?.trim()
                const reminderLine = compactReminderFeedLine({
                  label: en?.nextReminder,
                  secondaryLine: en?.reminderSecondary,
                  status: en?.reminderStatus,
                  attentionReason: en?.attentionReason,
                })
                const workflowManaged = isWorkflowManagedReminder({
                  label: en?.nextReminder,
                  attentionReason: en?.attentionReason,
                  secondaryLine: en?.reminderSecondary,
                })
                const nextSend =
                  !workflowManaged && en?.reminderStatus === 'scheduled' ? en?.reminderSecondary : null
                const response = en?.responseLabel
                const ends = ev.endsAt
                  ? new Date(ev.endsAt).toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZone,
                    })
                  : null

                return (
                  <li key={ev.id}>
                    <button
                      type="button"
                      onClick={() =>
                        onSelect(ev.id, response ? 'activity' : reminderLine ? 'reminders' : 'details')
                      }
                      className={cn(
                        'grid w-full gap-2 px-3 py-2.5 text-left transition-colors md:grid-cols-[30%_23%_28%_19%] md:items-start',
                        'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                        ev.id === selectedId && 'bg-primary/[0.06]',
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold tabular-nums text-foreground">
                          {formatEventTime(ev.startsAt, timeZone)}
                          {ends ? ` – ${ends}` : ''}
                        </p>
                        <p className="truncate text-[12px] font-medium text-foreground">{serviceOrTitleLine(ev)}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {(ev.metadata?.provider as string) === 'microsoft' ? 'Outlook' : 'Calendar'}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium">{customer || '—'}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {phone ? phone : customer ? '' : 'No contact on file'}
                        </p>
                      </div>
                      <div className="min-w-0 flex flex-wrap items-center gap-1">
                        <Pill tone={toneForPill(tone)} className="text-[10px]">
                          {tone === 'off' ? 'Off' : tone === 'scheduled' ? 'Scheduled' : tone}
                        </Pill>
                        <p className="line-clamp-2 text-[11px] text-muted-foreground" title={en?.reminderSecondary || undefined}>
                          {reminderLine || '—'}
                        </p>
                        {nextSend ? (
                          <p className="text-[10px] text-muted-foreground">Next: {nextSend}</p>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex items-start gap-1">
                        {response ? (
                          <>
                            <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            <span className="text-[11px] font-medium text-foreground">{response}</span>
                          </>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">No response yet</span>
                        )}
                        {en?.attentionIssue ? (
                          <Send className="ml-auto size-3.5 text-amber-600" aria-hidden />
                        ) : null}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
