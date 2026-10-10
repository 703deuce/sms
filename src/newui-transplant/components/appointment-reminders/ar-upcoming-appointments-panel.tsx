'use client'

import Link from 'next/link'
import { AlertTriangle, CalendarClock, ChevronRight, Sparkles } from 'lucide-react'
import type { ArCustomerResponseKind } from '@/lib/appointment-reminders/ar-sms-customer-outcome'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { CustomerResponsePill } from '@/newui-transplant/components/appointment-reminders/customer-response-pill'
import { OpusDataSurface } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { EmptyState, Initials, Pill, TextLink } from '@/newui-transplant/components/app/kit'
import { OPUS_CARD } from '@/newui-transplant/components/app/opus-surfaces'
import { cn } from '@/lib/utils'

export type UpcomingAppointmentRow = {
  appointmentId: string
  customerName: string
  appointmentTitle: string
  startsAt: string
  nextReminder?: string
  responseStatus: string
  responseKind: string
  needsAttention?: boolean
}

function attentionKind(kind: string): boolean {
  return (
    kind === 'cancel_pending' ||
    kind === 'reschedule_pending' ||
    kind === 'reschedule_requested' ||
    kind === 'awaiting_reply'
  )
}

export function ArUpcomingAppointmentsPanel({
  rows,
  loading,
  className,
}: {
  rows: UpcomingAppointmentRow[]
  loading?: boolean
  className?: string
}) {
  return (
    <OpusDataSurface
      className={cn('bg-gradient-to-br from-card via-card to-primary/[0.03]', className)}
      toolbar={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm"
              aria-hidden="true"
            >
              <CalendarClock className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold tracking-tight">Upcoming appointments</h2>
              <p className="text-sm text-muted-foreground">
                Next visits with response status — open any row for reminders and history.
              </p>
            </div>
          </div>
          <TextLink href={AR_ROUTES.appointments} className="shrink-0 text-sm font-medium">
            View all appointments
          </TextLink>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-2 p-4" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/50" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon={CalendarClock}
            title="No upcoming appointments"
            description="Connect a calendar under Settings → Integrations or add appointments manually."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((row) => {
            const kind = (row.responseKind || 'awaiting_reply') as ArCustomerResponseKind
            const hot = row.needsAttention ?? attentionKind(kind)
            return (
              <li key={row.appointmentId}>
                <Link
                  href={`${AR_ROUTES.appointments}?highlight=${encodeURIComponent(row.appointmentId)}`}
                  className={cn(
                    'flex flex-col gap-3 px-4 py-4 transition-colors sm:flex-row sm:items-center sm:gap-4',
                    'hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                    hot && 'bg-amber-500/[0.04] hover:bg-amber-500/[0.07]',
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Initials name={row.customerName} className="size-10 shrink-0 ring-2 ring-background shadow-sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{row.customerName}</p>
                      <p className="truncate text-sm text-muted-foreground">{row.appointmentTitle}</p>
                      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                        {new Date(row.startsAt).toLocaleString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {row.nextReminder ? (
                      <span className={cn(OPUS_CARD, 'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground')}>
                        <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
                        {row.nextReminder}
                      </span>
                    ) : null}
                    <CustomerResponsePill label={row.responseStatus} kind={kind} />
                    {hot ? (
                      <Pill tone="warning" dot={false}>
                        <AlertTriangle className="mr-1 inline size-3" aria-hidden="true" />
                        Needs attention
                      </Pill>
                    ) : null}
                    <ChevronRight className="ml-auto size-4 text-muted-foreground sm:ml-2" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </OpusDataSurface>
  )
}
