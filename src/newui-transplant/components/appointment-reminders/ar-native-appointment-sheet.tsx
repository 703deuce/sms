'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  CalendarClock,
  DollarSign,
  ExternalLink,
  FileWarning,
  Loader2,
  MessageSquare,
  MoreHorizontal,
} from 'lucide-react'
import type { CalendarApiAppointment } from '@/features/appointments/kimi/calendar/map-calendar'
import { appendReturnTo } from '@/lib/navigation/return-context'
import type { OpenSlotSummary } from '@/newui-transplant/components/appointment-reminders/ar-calendar-waitlist-sheet'
import { ArCalendarRescheduleSheet } from '@/newui-transplant/components/appointment-reminders/ar-calendar-reschedule-sheet'
import { OpusIconBadge, Pill } from '@/newui-transplant/components/app/kit'
import { OPUS_CONFIG_INSET } from '@/newui-transplant/components/app/opus-surfaces'
import { Button } from '@/newui-transplant/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/newui-transplant/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/newui-transplant/components/ui/sheet'
import { cn } from '@/lib/utils'

type AppointmentDetail = {
  id: string
  inviteeName: string | null
  serviceName: string | null
  startsAt: string
  endsAt: string | null
  status: string
  staffName: string | null
  contactId: string | null
  metadata: Record<string, unknown>
  contact?: { phone?: string; email?: string } | null
  policySnapshot?: {
    cancellation?: { allowed?: string; cutoffHours?: number }
    reschedule?: { allowed?: string; cutoffHours?: number }
  }
  reminderSchedule?: Array<{ label?: string; status?: string }>
  contracts?: Array<{ status: string }>
  source?: string | null
}

type Props = {
  event: CalendarApiAppointment | null
  open: boolean
  onClose: () => void
  onRefresh: () => void
  onReschedule?: (appointmentId: string, startsAt: string) => void
  onCanceled?: (slot: OpenSlotSummary) => void
  returnTo?: string
}

function fmtRange(startsAt: string, endsAt: string | null, tz: string | null) {
  const start = new Date(startsAt)
  const end = endsAt ? new Date(endsAt) : null
  const d = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  const t1 = start.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz || undefined,
  })
  const t2 = end?.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz || undefined,
  })
  return `${d} · ${t1}${t2 ? ` – ${t2}` : ''}`
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

export function ArNativeAppointmentSheet({
  event,
  open,
  onClose,
  onRefresh,
  onReschedule,
  onCanceled,
  returnTo,
}: Props) {
  const [detail, setDetail] = useState<AppointmentDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)

  useEffect(() => {
    if (!open || !event || event.id.startsWith('class:') || event.id.startsWith('video:') || event.id.startsWith('meeting:')) {
      setDetail(null)
      return
    }
    setLoading(true)
    setError('')
    fetch(`/api/appointments/${encodeURIComponent(event.id)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.data) throw new Error(json.error || 'Load failed')
        setDetail(json.data as AppointmentDetail)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false))
  }, [open, event])

  if (!event) return null

  const isClass = event.id.startsWith('class:')
  const classOccId = event.occurrenceId || event.id.replace('class:', '')

  async function patchStatus(status: string) {
    if (!event || isClass) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/appointments/${encodeURIComponent(event.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Update failed')
      }
      onRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  async function cancelAppt() {
    if (!event || isClass) return
    setBusy(true)
    try {
      const res = await fetch(`/api/appointments/${encodeURIComponent(event.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Cancel failed')
      }
      onCanceled?.({
        startsAt: event.startsAt,
        endsAt: event.endsAt || undefined,
        serviceName: event.serviceName || undefined,
        staffLabel: event.staffLabel,
        locationLabel: event.locationLabel || undefined,
      })
      onRefresh()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed')
    } finally {
      setBusy(false)
    }
  }

  const meta = (detail?.metadata || event.metadata || {}) as Record<string, unknown>
  const balance = event.balanceDueCents ?? (meta.balanceDueCents as number) ?? (meta.amountDueCents as number)
  const contactId = event.contactId || detail?.contactId
  const phone = detail?.contact?.phone || event.inviteePhone
  const email = detail?.contact?.email
  const pendingForms = event.pendingFormsCount ?? (meta.pendingFormsCount as number) ?? 0
  const sourceLabel = (detail?.source || meta.source || meta.bookingSource || '—') as string
  const videoUrl = event.meeting?.videoJoinUrl
  const title = event.serviceName || event.inviteeName || 'Scheduled event'

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          side="right"
          className="flex w-full max-w-full flex-col gap-0 p-0 sm:max-w-md md:max-w-[28rem]"
        >
          <SheetHeader className="border-b bg-gradient-to-b from-card to-muted/20 px-6 py-5 pr-14 text-left">
            <div className="flex min-w-0 items-start gap-3">
              <OpusIconBadge icon={CalendarClock} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {(event.domainType || 'booking').replace('_', ' ')}
                </p>
                <SheetTitle className="text-base font-semibold leading-snug break-words">{title}</SheetTitle>
                {event.inviteeName ? (
                  <p className="mt-1 text-sm text-muted-foreground break-words">{event.inviteeName}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Pill tone="neutral">{event.status}</Pill>
                </div>
              </div>
            </div>
          </SheetHeader>

          {!isClass && !event.id.startsWith('video:') ? (
            <div className="flex flex-wrap gap-2 border-b px-6 py-3">
              {contactId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={
                    <Link
                      href={appendReturnTo(`/conversations?contactId=${encodeURIComponent(contactId)}`, returnTo ?? null)}
                    />
                  }
                >
                  <MessageSquare className="mr-1.5 size-3.5" aria-hidden />
                  Message
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="outline" onClick={() => setRescheduleOpen(true)}>
                Reschedule
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button type="button" size="sm" variant="outline" disabled={busy}>
                      <MoreHorizontal className="size-4" aria-hidden />
                      More
                    </Button>
                  }
                />
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => void patchStatus('confirmed')}>Mark confirmed</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void patchStatus('checked_in')}>Check in</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void patchStatus('completed')}>Mark complete</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void patchStatus('no_show')}>Mark no-show</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => void cancelAppt()}>
                    Cancel appointment
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading details…
              </p>
            ) : (
              <div className="space-y-6">
                <section className={cn(OPUS_CONFIG_INSET, 'space-y-3 p-4')}>
                  <DetailRow label="When" value={fmtRange(event.startsAt, event.endsAt || null, event.timezone)} />
                  {event.staffLabel ? <DetailRow label="Staff" value={event.staffLabel} /> : null}
                  {event.locationLabel ? <DetailRow label="Location" value={event.locationLabel} /> : null}
                  <DetailRow label="Source" value={String(sourceLabel)} />
                </section>

                {(contactId || event.inviteeName) && (
                  <section>
                    <h2 className="mb-2 text-sm font-semibold">Customer</h2>
                    <div className={cn(OPUS_CONFIG_INSET, 'space-y-2 p-4')}>
                      <p className="text-sm font-medium">{event.inviteeName || 'Client'}</p>
                      {phone ? <p className="text-sm text-muted-foreground">{phone}</p> : null}
                      {email ? <p className="text-sm text-muted-foreground">{email}</p> : null}
                      {contactId ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          nativeButton={false}
                          render={
                            <Link href={appendReturnTo(`/contacts/${contactId}`, returnTo ?? null)} />
                          }
                        >
                          Open client
                        </Button>
                      ) : null}
                    </div>
                  </section>
                )}

                {!isClass && (
                  <section>
                    <h2 className="mb-2 text-sm font-semibold">Payment</h2>
                    <div className={cn(OPUS_CONFIG_INSET, 'space-y-2 p-4')}>
                      {balance && balance > 0 ? (
                        <p className="flex items-center gap-1 text-sm">
                          <DollarSign className="size-4" aria-hidden />
                          ${(balance / 100).toFixed(2)} balance due
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">{event.paymentLabel || 'No payment due'}</p>
                      )}
                      {balance && balance > 0 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          nativeButton={false}
                          render={
                            <Link href={`/appointments/point-of-sale?appointmentId=${encodeURIComponent(event.id)}`} />
                          }
                        >
                          Collect / POS
                        </Button>
                      ) : null}
                    </div>
                  </section>
                )}

                {!isClass && pendingForms > 0 && (
                  <section>
                    <h2 className="mb-2 text-sm font-semibold">Forms</h2>
                    <p className="flex items-center gap-1 text-sm text-amber-800">
                      <FileWarning className="size-4" aria-hidden />
                      {pendingForms} outstanding
                    </p>
                  </section>
                )}

                {videoUrl && (
                  <Button
                    type="button"
                    size="sm"
                    nativeButton={false}
                    render={<a href={videoUrl} target="_blank" rel="noreferrer" />}
                  >
                    <ExternalLink className="mr-1.5 size-3.5" aria-hidden />
                    Join video
                  </Button>
                )}
              </div>
            )}
          </div>

          <SheetFooter className="border-t bg-muted/15 px-6 py-4">
            {isClass ? (
              <Button
                type="button"
                className="w-full"
                nativeButton={false}
                render={<Link href={`/appointments/classes?occurrence=${classOccId}`} />}
              >
                Open class
              </Button>
            ) : event.id.startsWith('video:') ? (
              <Button
                type="button"
                className="w-full"
                nativeButton={false}
                render={<Link href={`/video/rooms/${event.id.slice(6)}/host`} />}
              >
                Open video room
              </Button>
            ) : (
              <Button
                type="button"
                className="w-full"
                nativeButton={false}
                render={
                  <Link href={appendReturnTo(`/appointments/${event.id}`, returnTo ?? null)} />
                }
              >
                Open full appointment
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ArCalendarRescheduleSheet
        open={rescheduleOpen}
        appointmentId={event.id}
        currentStartsAt={event.startsAt}
        recurringSeriesId={
          ((detail?.metadata || event.metadata || {}) as { recurringSeriesId?: string }).recurringSeriesId
        }
        onClose={() => setRescheduleOpen(false)}
        onDone={onRefresh}
        onReschedule={onReschedule}
      />
    </>
  )
}
