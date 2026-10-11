'use client'

import { Bell } from 'lucide-react'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { TextLink } from '@/newui-transplant/components/app/kit'
import { cn } from '@/lib/utils'

type OverviewPayload = {
  upcomingAppointments?: Array<{
    appointmentId: string
    customerName: string
    appointmentTitle: string
    startsAt: string
    nextReminder?: string
  }>
  customerResponses?: Array<{
    appointmentId: string
    customerName: string
    appointmentTitle: string
    responseAt: string
    customerResponse?: { label?: string }
  }>
  needsAttentionRows?: Array<{
    appointmentId: string
    customerName: string
    title?: string
    appointmentTitle?: string
    reason?: string
    issue?: string
  }>
  activity?: Array<{
    appointmentId: string
    customerLabel: string
    reminderLabel: string
    status: string
    channel?: string
    at: string
  }>
}

function Section({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function FeedRow({
  primary,
  secondary,
  meta,
  onClick,
}: {
  primary: string
  secondary: string
  meta?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-lg border border-transparent px-2 py-2 text-left transition-colors',
        'hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <p className="truncate text-[13px] font-medium text-foreground">{primary}</p>
      <p className="truncate text-[11px] text-muted-foreground">{secondary}</p>
      {meta ? <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{meta}</p> : null}
    </button>
  )
}

export function ArCalendarActivityPanel({
  data,
  loading,
  onSelectAppointment,
  className,
  variant = 'full',
}: {
  data: OverviewPayload | null
  loading?: boolean
  onSelectAppointment: (id: string, tab?: 'details' | 'reminders' | 'activity') => void
  className?: string
  /** Right panel: fewer rows, no duplicate activity feed */
  variant?: 'full' | 'context'
}) {
  if (loading) {
    return (
      <div className={cn('space-y-4 p-4', className)} aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/50" />
        ))}
      </div>
    )
  }

  const isContext = variant === 'context'
  const upcoming = data?.upcomingAppointments?.slice(0, isContext ? 4 : 6) ?? []
  const replies = data?.customerResponses?.slice(0, isContext ? 3 : 5) ?? []
  const attention = data?.needsAttentionRows?.slice(0, isContext ? 3 : 6) ?? []
  const activity = data?.activity?.slice(0, 5) ?? []

  return (
    <div className={cn('flex flex-col gap-4 p-4', isContext && 'gap-3.5 pt-2', className)}>
      <Section
        title="Upcoming reminders"
        action={
          <span className="text-[11px]">
            <TextLink href={AR_ROUTES.reminders}>View all</TextLink>
          </span>
        }
      >
        {upcoming.length === 0 ? (
          <p className="text-xs text-muted-foreground">No upcoming appointments in the next few days.</p>
        ) : (
          <ul className="space-y-1">
            {upcoming.map((row) => (
              <li key={row.appointmentId}>
                <FeedRow
                  primary={row.customerName || row.appointmentTitle}
                  secondary={row.nextReminder || 'Reminders scheduled'}
                  meta={new Date(row.startsAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  onClick={() => onSelectAppointment(row.appointmentId, 'reminders')}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Recent replies">
        {replies.length === 0 ? (
          <p className="text-xs text-muted-foreground">No recent customer replies.</p>
        ) : (
          <ul className="space-y-1">
            {replies.map((row) => (
              <li key={`${row.appointmentId}-${row.responseAt}`}>
                <FeedRow
                  primary={row.customerName}
                  secondary={row.customerResponse?.label || 'Reply'}
                  meta={new Date(row.responseAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  onClick={() => onSelectAppointment(row.appointmentId, 'activity')}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Needs attention"
        action={
          <span className="text-[11px]">
            <TextLink href={AR_ROUTES.appointments}>Appointments</TextLink>
          </span>
        }
      >
        {attention.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing needs attention right now.</p>
        ) : (
          <ul className="space-y-1">
            {attention.map((row) => (
              <li key={row.appointmentId}>
                <FeedRow
                  primary={row.customerName || row.title || row.appointmentTitle || 'Appointment'}
                  secondary={row.reason || row.issue || ''}
                  onClick={() => onSelectAppointment(row.appointmentId)}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {!isContext ? (
        <Section title="Recent reminder activity">
          {activity.length === 0 ? (
            <p className="text-xs text-muted-foreground">No recent reminder sends.</p>
          ) : (
            <ul className="space-y-1">
              {activity.map((row, i) => (
                <li key={`${row.appointmentId}-${row.at}-${i}`}>
                  <FeedRow
                    primary={row.customerLabel}
                    secondary={`${row.reminderLabel} · ${row.status}`}
                    meta={
                      row.channel
                        ? `${row.channel.toUpperCase()} · ${new Date(row.at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}`
                        : undefined
                    }
                    onClick={() => onSelectAppointment(row.appointmentId, 'activity')}
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      {!isContext ? (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Bell className="size-3.5 shrink-0" aria-hidden />
          Operational feed — select a row to manage that appointment.
        </p>
      ) : null}
    </div>
  )
}
