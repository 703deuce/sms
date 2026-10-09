'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, ExternalLink, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { formatPhone } from '@/lib/utils'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { CustomerResponsePill } from '@/newui-transplant/components/appointment-reminders/customer-response-pill'
import type { ArCustomerResponseSummary } from '@/lib/appointment-reminders/ar-sms-customer-outcome'
import { OpusIconBadge, Pill } from '@/newui-transplant/components/app/kit'
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

function OpusDetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 max-w-full">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium leading-snug text-foreground">{value}</dd>
    </div>
  )
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

  const whenLine =
    detail?.startsAt
      ? `${formatDate(detail.startsAt, tz)} · ${formatTimeRange(detail.startsAt, detail.endsAt, tz)}`
      : null

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full max-w-full flex-col gap-0 p-0 sm:max-w-md md:max-w-[28rem]"
      >
        <SheetHeader className="border-b bg-gradient-to-b from-card to-muted/20 px-6 py-5 pr-14 text-left">
          <div className="flex min-w-0 items-start gap-3">
            <OpusIconBadge icon={CalendarClock} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base font-semibold leading-snug break-words">{title}</SheetTitle>
              {subtitle ? <p className="mt-1 text-sm text-muted-foreground break-words">{subtitle}</p> : null}
              {whenLine ? (
                <p className="mt-2 text-sm font-medium leading-snug text-foreground break-words">{whenLine}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
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

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
              Loading details…
            </p>
          ) : detail ? (
            <div className="space-y-6">
              <div className={cn(OPUS_SYSTEM_LOCK_SURFACE, 'text-xs leading-relaxed text-muted-foreground')}>
                Edit this appointment in Outlook or Google Calendar. Transovo syncs changes for reminders and SMS
                rescheduling.
              </div>

              <section aria-labelledby="ar-cal-detail-heading">
                <h2 id="ar-cal-detail-heading" className="mb-3 text-sm font-semibold">
                  Details
                </h2>
                <dl className={cn(OPUS_CONFIG_INSET, 'grid gap-4 p-4 sm:p-5')}>
                  {detail.inviteeName ? (
                    <OpusDetailField label="Customer" value={detail.inviteeName} />
                  ) : null}
                  {detail.metadata?.inviteePhone ? (
                    <OpusDetailField
                      label="Phone"
                      value={formatPhone(String(detail.metadata.inviteePhone))}
                    />
                  ) : null}
                  {location ? <OpusDetailField label="Location" value={location} /> : null}
                  {provider ? <OpusDetailField label="Calendar" value={provider} /> : null}
                  {detail.status ? <OpusDetailField label="Status" value={detail.status} /> : null}
                </dl>
              </section>

              {detail.reminderSchedule?.length ? (
                <section aria-labelledby="ar-cal-reminders-heading">
                  <h2 id="ar-cal-reminders-heading" className="mb-3 text-sm font-semibold">
                    Reminders
                  </h2>
                  <ul className={cn(OPUS_CONFIG_INSET, 'divide-y')}>
                    {detail.reminderSchedule.map((r) => (
                      <li
                        key={r.label}
                        className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                      >
                        <span className="min-w-0 break-words text-sm text-muted-foreground">{r.label}</span>
                        <span className="shrink-0 text-sm font-medium capitalize">{r.status}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Could not load this appointment.</p>
          )}
        </div>

        <SheetFooter className="border-t bg-muted/15 px-6 py-4">
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
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
