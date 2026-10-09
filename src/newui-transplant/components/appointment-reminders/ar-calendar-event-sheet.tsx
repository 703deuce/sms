'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { formatPhone } from '@/lib/utils'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { KeyValueRow } from '@/newui-transplant/components/app/kit'
import { CustomerResponsePill } from '@/newui-transplant/components/appointment-reminders/customer-response-pill'
import type { ArCustomerResponseSummary } from '@/lib/appointment-reminders/ar-sms-customer-outcome'
import { Button } from '@/newui-transplant/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/newui-transplant/components/ui/sheet'

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

  const when = detail?.startsAt
    ? new Date(detail.startsAt).toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: detail.timezone || timezone,
      })
    : '—'

  const endWhen =
    detail?.endsAt && detail.startsAt
      ? new Date(detail.endsAt).toLocaleString('en-US', {
          timeStyle: 'short',
          timeZone: detail.timezone || timezone,
        })
      : null

  const location =
    (detail?.metadata?.location as string) ||
    (detail?.metadata?.meetingUrl as string) ||
    null

  const provider =
    (detail?.metadata?.provider as string) ||
    (detail?.metadata?.connectionId ? 'Connected calendar' : null)

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-left text-base font-semibold">
            {detail?.serviceName || detail?.inviteeName || 'Appointment'}
          </SheetTitle>
          <p className="text-left text-xs text-muted-foreground">Read-only — changes are made in Outlook or Google Calendar.</p>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : detail ? (
          <div className="flex flex-col gap-3 text-sm">
            <KeyValueRow label="When" value={endWhen ? `${when} – ${endWhen}` : when} />
            {detail.inviteeName ? <KeyValueRow label="Customer" value={detail.inviteeName} /> : null}
            {detail.metadata?.inviteePhone ? (
              <KeyValueRow label="Phone" value={formatPhone(String(detail.metadata.inviteePhone))} />
            ) : null}
            {location ? <KeyValueRow label="Location" value={location} /> : null}
            {provider ? <KeyValueRow label="Calendar" value={String(provider)} /> : null}
            {detail.status ? <KeyValueRow label="Status" value={detail.status} /> : null}
            {detail.reminderSchedule?.length ? (
              <KeyValueRow
                label="Reminders"
                value={detail.reminderSchedule.map((r) => r.label).join(' · ')}
              />
            ) : null}
            {detail.customerResponse ? (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">SMS</span>
                <CustomerResponsePill
                  label={detail.customerResponse.label}
                  kind={detail.customerResponse.kind}
                />
              </div>
            ) : null}
            {detail.sourceEventUrl ? (
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
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
              variant="ghost"
              size="sm"
              className="w-fit px-0"
              nativeButton={false}
              render={
                <Link href={`${AR_ROUTES.appointments}?q=${encodeURIComponent(appointmentId || '')}`} />
              }
            >
              View in Appointments list
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Could not load this appointment.</p>
        )}
      </SheetContent>
    </Sheet>
  )
}
