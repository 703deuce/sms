'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { CalendarApiAppointment } from '@/features/appointments/kimi/calendar/map-calendar'
import { KeyValueRow } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { ArNativeAppointmentSheet } from '@/newui-transplant/components/appointment-reminders/ar-native-appointment-sheet'
import { ArCalendarRescheduleSheet } from '@/newui-transplant/components/appointment-reminders/ar-calendar-reschedule-sheet'

type SchedulingDetail = {
  id: string
  inviteeName: string | null
  serviceName: string | null
  staffName: string | null
  startsAt: string
  endsAt: string | null
  status: string
  timezone?: string | null
  contactId: string | null
  metadata?: Record<string, unknown>
  source?: string | null
}

function metaString(meta: Record<string, unknown>, key: string): string | null {
  const v = meta[key]
  return typeof v === 'string' && v.trim() ? v : null
}

function metaCents(meta: Record<string, unknown>, key: string): number | null {
  const v = meta[key]
  return typeof v === 'number' && v > 0 ? v : null
}

export function ArAppointmentSchedulingPanel({
  appointmentId,
  returnTo,
  onRefresh,
}: {
  appointmentId: string
  returnTo: string
  onRefresh: () => void
}) {
  const [detail, setDetail] = useState<SchedulingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fullEditorOpen, setFullEditorOpen] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/appointments/${encodeURIComponent(appointmentId)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not load booking details')
      setDetail(json.data as SchedulingDetail)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [appointmentId])

  useEffect(() => {
    void load()
  }, [load])

  const calendarEvent: CalendarApiAppointment | null = useMemo(() => {
    if (!detail) return null
    const meta = detail.metadata || {}
    return {
      id: detail.id,
      eventKind: 'appointment',
      domainType: 'service',
      inviteeName: detail.inviteeName,
      serviceName: detail.serviceName,
      startsAt: detail.startsAt,
      endsAt: detail.endsAt,
      status: detail.status,
      timezone: detail.timezone || null,
      contactId: detail.contactId,
      staffLabel: detail.staffName || undefined,
      metadata: meta,
    }
  }, [detail])

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading booking details…
      </p>
    )
  }

  if (error) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-destructive">{error}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()}>Retry</Button>
      </div>
    )
  }

  if (!detail) return null

  const meta = detail.metadata || {}
  const location =
    metaString(meta, 'location') ||
    metaString(meta, 'locationName') ||
    (meta.locationId ? `Location ${meta.locationId}` : null)
  const balance =
    metaCents(meta, 'balanceDueCents') ?? metaCents(meta, 'amountDueCents')
  const classOcc = metaString(meta, 'classOccurrenceId') || meta.classOccurrenceId
  const workshop = metaString(meta, 'workshopId')
  const pendingForms = meta.pendingFormsCount as number | undefined
  const paymentStatus = metaString(meta, 'paymentStatus')

  return (
    <div className="space-y-4 text-sm">
      <KeyValueRow label="Service" value={detail.serviceName || '—'} />
      <KeyValueRow label="Staff" value={detail.staffName || '—'} />
      <KeyValueRow label="Location" value={location || '—'} />
      <KeyValueRow label="Booking source" value={detail.source || metaString(meta, 'bookingSource') || '—'} />
      {paymentStatus || balance ? (
        <KeyValueRow
          label="Payment"
          value={
            balance
              ? `$${(balance / 100).toFixed(2)} due · ${paymentStatus || 'pending'}`
              : paymentStatus || '—'
          }
        />
      ) : null}
      {classOcc ? <KeyValueRow label="Class" value="Enrollment linked" /> : null}
      {workshop ? <KeyValueRow label="Workshop" value="Enrollment linked" /> : null}
      {typeof pendingForms === 'number' && pendingForms > 0 ? (
        <KeyValueRow label="Intake / forms" value={`${pendingForms} pending`} />
      ) : null}

      <div className="flex flex-col gap-2 pt-2">
        <Button type="button" size="sm" onClick={() => setFullEditorOpen(true)}>
          Manage booking (reschedule, cancel, notes)
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setRescheduleOpen(true)}>
          Reschedule
        </Button>
      </div>

      {fullEditorOpen && calendarEvent ? (
        <ArNativeAppointmentSheet
          open={fullEditorOpen}
          event={calendarEvent}
          onClose={() => setFullEditorOpen(false)}
          onRefresh={() => {
            void load()
            onRefresh()
          }}
          returnTo={returnTo}
        />
      ) : null}

      {rescheduleOpen && calendarEvent ? (
        <ArCalendarRescheduleSheet
          open={rescheduleOpen}
          appointmentId={calendarEvent.id}
          currentStartsAt={calendarEvent.startsAt}
          recurringSeriesId={
            ((detail.metadata || {}) as { recurringSeriesId?: string }).recurringSeriesId
          }
          onClose={() => setRescheduleOpen(false)}
          onDone={() => {
            setRescheduleOpen(false)
            void load()
            onRefresh()
          }}
        />
      ) : null}
    </div>
  )
}
