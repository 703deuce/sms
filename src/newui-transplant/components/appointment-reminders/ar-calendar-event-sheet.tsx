'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, ExternalLink, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { formatPhone } from '@/lib/utils'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { KeyValueRow, OpusIconBadge, Pill } from '@/newui-transplant/components/app/kit'
import { CustomerResponsePill } from '@/newui-transplant/components/appointment-reminders/customer-response-pill'
import type { ArCustomerResponseSummary } from '@/lib/appointment-reminders/ar-sms-customer-outcome'
import { OPUS_CONFIG_INSET, OPUS_SYSTEM_LOCK_SURFACE } from '@/newui-transplant/components/app/opus-surfaces'
import { Button } from '@/newui-transplant/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/newui-transplant/components/ui/sheet'
import { cn } from '@/lib/utils'

type DetailPayload = {
  serviceName?: string
  inviteeName?: string
  startsAt: string
  endsAt?: string | null
  timezone?: string | null
  status?: string
  metadata?: Record<string, unknown>
  sourceEventUrl?: string | null
  customerResponse?: ArCustomerResponseSummary
  reminderSchedule?: Array<{ label: string; status: string }>
}

function formatDate(iso: string, tz: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: tz,
  })
}

function formatTimeRange(startIso: string, endIso: string | null | undefined, tz: string) {
  const start = new Date(startIso).toLocaleTimeString('en-US', {
    timeStyle: 'short',
    timeZone: tz,
  })
  if (!endIso) return start
  const end = new Date(endIso).toLocaleTimeString('en-US', {
    timeStyle: 'short',
    timeZone: tz,
  })
  return `${start} – ${end}`
}

function providerLabel(provider: string | null) {
  if (!provider) return null
  const p = provider.toLowerCase()
  if (p === 'google') return 'Google Calendar'
  if (p === 'microsoft') return 'Microsoft Outlook'
  return provider
}

export function ArCalendarEventSheet({
  appointmentId,
  open,
  onClose,
  timezone,
}: {
  appointmentId: string | null
  open: boolean
  onClose: () => void
  timezone: string
}) {
  const [detail, setDetail] = useState<DetailPayload | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!appointmentId) return
    setLoading(true)
    try {
      const [apptRes, tlRes] = await Promise.all([
        fetch(`/api/appointment-reminders/appointments/${appointmentId}`),
        fetch(`/api/appointment-reminders/appointments/${appointmentId}/reminder-timeline`),
      ])
      const json = apptRes.ok ? await apptRes.json() : null
      const tlJson = tlRes.ok ? await tlRes.json() : null
      const row = json?.data
      if (!row) {
        setDetail(null)
        return
      }
      setDetail({
        serviceName: row.serviceName,
        inviteeName: row.inviteeName,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        timezone: row.timezone,
        status: row.status,
        metadata: row.metadata,
        sourceEventUrl: row.sourceEventUrl ?? (row.metadata as { sourceEventUrl?: string })?.sourceEventUrl,
        customerResponse: tlJson?.data?.customerResponse as ArCustomerResponseSummary | undefined,
        reminderSchedule: row.reminderSchedule,
      })
    } finally {
      setLoading(false)
    }
  }, [appointmentId])

  useEffect(() => {
    if (open && appointmentId) load()
    if (!open) setDetail(null)
  }, [open, appointmentId, load])

  const tz = detail?.timezone || timezone
  const title = detail?.serviceName || detail?.inviteeName || 'Appointment'
  const subtitle = detail?.inviteeName && detail?.serviceName ? detail.inviteeName : null

  const location =
    (detail?.metadata?.location as string) ||
    (detail?.metadata?.meetingUrl as string) ||
    null

  const provider = providerLabel(
    (detail?.metadata?.provider as string) ||
      (detail?.metadata?.connectionId ? 'Connected calendar' : null),
  )

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md md:max-w-[480px]"
      >
        <SheetHeader className="border-b bg-gradient-to-b from-card to-muted/20 px-5 py-4 pr-12 text-left">
          <div className="flex items-start gap-3">
            <OpusIconBadge icon={CalendarClock} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base font-semibold leading-snug">{title}</SheetTitle>
              {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
              {detail?.startsAt ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(detail.startsAt, tz)} · {formatTimeRange(detail.startsAt, detail.endsAt, tz)}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Pill tone="neutral">Read-only</Pill>
                {detail?.customerResponse ? (
                  <CustomerResponsePill
                    label={detail.customerResponse.label}
                    kind={detail.customerResponse.kind}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading details…
            </p>
          ) : detail ? (
            <div className="space-y-6">
              <div className={cn(OPUS_SYSTEM_LOCK_SURFACE, 'text-xs text-muted-foreground')}>
                Changes are made in Outlook or Google Calendar. Transovo syncs updates for reminders and SMS
                rescheduling.
              </div>

              <section>
                <h2 className="mb-3 text-sm font-semibold">Appointment details</h2>
                <div className={cn(OPUS_CONFIG_INSET, 'px-4 py-1')}>
                  {detail.inviteeName ? <KeyValueRow label="Customer" value={detail.inviteeName} /> : null}
                  {detail.metadata?.inviteePhone ? (
                    <KeyValueRow
                      label="Phone"
                      value={formatPhone(String(detail.metadata.inviteePhone))}
                    />
                  ) : null}
                  {location ? <KeyValueRow label="Location" value={location} /> : null}
                  {provider ? <KeyValueRow label="Calendar" value={provider} /> : null}
                  {detail.status ? (
                    <KeyValueRow label="Status" value={detail.status} tone="neutral" />
                  ) : null}
                </div>
              </section>

              {detail.reminderSchedule?.length ? (
                <section>
                  <h2 className="mb-3 text-sm font-semibold">Reminders</h2>
                  <div className={cn(OPUS_CONFIG_INSET, 'px-4 py-3 text-sm')}>
                    <ul className="space-y-2">
                      {detail.reminderSchedule.map((r) => (
                        <li key={r.label} className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">{r.label}</span>
                          <span className="font-medium capitalize">{r.status}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Could not load this appointment.</p>
          )}
        </div>

        <SheetFooter className="border-t bg-muted/15 px-5 py-4">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
            {detail?.sourceEventUrl ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                nativeButton={false}
                render={
                  <a href={detail.sourceEventUrl} target="_blank" rel="noopener noreferrer" />
                }
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Open in calendar
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto"
              nativeButton={false}
              render={
                <Link
                  href={`${AR_ROUTES.appointments}?q=${encodeURIComponent(appointmentId || '')}`}
                />
              }
            >
              View in Appointments list
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
