'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  CalendarCheck,
  Loader2,
  MessageSquare,
  Phone,
  RefreshCcw,
  XCircle,
} from 'lucide-react'
import { mapApiAppointment } from '@/features/appointments/kimi/detail/map-detail'
import type { Appointment } from '@/components/appointments/kimi-ui/detail/types'
import { ContextBackLink } from '@/components/navigation/context-back-link'
import { ArOpusPage } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { ArAppointmentSlotPicker } from '@/newui-transplant/components/scheduling/ar-appointment-slot-picker'
import {
  OpusSchedulingHero,
  appointmentStatusTone,
} from '@/newui-transplant/components/appointment-reminders/opus-scheduling-chrome'
import { Callout, Panel, Pill } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/newui-transplant/components/ui/dialog'
import { Textarea } from '@/newui-transplant/components/ui/textarea'

const TERMINAL = new Set(['canceled', 'completed', 'no_show'])

export function ArAppointmentDetailOpus({ appointmentId }: { appointmentId: string }) {
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [appt, setAppt] = useState<Appointment | null>(null)
  const [acting, setActing] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [rescheduleSlots, setRescheduleSlots] = useState<Array<{ startsAt: string }>>([])
  const [rescheduleAt, setRescheduleAt] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [internalNote, setInternalNote] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const fetchAppt = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    setNotFound(false)
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`)
      if (res.status === 404) {
        setNotFound(true)
        setAppt(null)
        return
      }
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json()
      setAppt(mapApiAppointment(json.data))
    } catch {
      setLoadError(true)
      setAppt(null)
    } finally {
      setLoading(false)
    }
  }, [appointmentId])

  useEffect(() => {
    void fetchAppt()
  }, [fetchAppt])

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2600)
  }

  async function patch(update: Record<string, unknown>, toastMsg: string) {
    setActing(true)
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      })
      if (!res.ok) throw new Error('patch failed')
      await fetchAppt()
      showToast(toastMsg)
    } catch {
      showToast('Something went wrong. Try again.')
    } finally {
      setActing(false)
    }
  }

  async function openReschedule() {
    if (!appt?.serviceName) return
    setRescheduleOpen(true)
    setLoadingSlots(true)
    setRescheduleSlots([])
    try {
      const res = await fetch(
        `/api/appointments/availability?serviceName=${encodeURIComponent(appt.serviceName)}&daysAhead=14`,
      )
      const json = await res.json()
      setRescheduleSlots(json.data?.slots || [])
    } finally {
      setLoadingSlots(false)
    }
  }

  async function saveReschedule() {
    if (!rescheduleAt) return
    await patch({ startsAt: new Date(rescheduleAt).toISOString() }, 'Appointment rescheduled')
    setRescheduleOpen(false)
  }

  async function cancelAppt() {
    await patch({ action: 'cancel' }, 'Appointment canceled')
    setCancelOpen(false)
  }

  async function addNote() {
    if (!internalNote.trim()) return
    setActing(true)
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: internalNote.trim() }),
      })
      if (!res.ok) throw new Error('note failed')
      setInternalNote('')
      await fetchAppt()
      showToast('Note added')
    } catch {
      showToast('Could not add note')
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return (
      <ArOpusPage>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading appointment…
        </p>
      </ArOpusPage>
    )
  }

  if (notFound) {
    return (
      <ArOpusPage>
        <Callout tone="warning" title="Appointment not found" />
      </ArOpusPage>
    )
  }

  if (loadError || !appt) {
    return (
      <ArOpusPage>
        <Callout tone="danger" title="Could not load appointment">
          <Button type="button" size="sm" className="mt-2" onClick={() => void fetchAppt()}>Retry</Button>
        </Callout>
      </ArOpusPage>
    )
  }

  const terminal = TERMINAL.has(appt.status)
  const when = new Date(appt.startsAt).toLocaleString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <ArOpusPage wide>
      <ContextBackLink fallbackHref="/appointments/scheduled" returnTo={returnTo} fallbackLabel="Back to appointments" />

      <OpusSchedulingHero
        icon={CalendarCheck}
        title={appt.serviceName}
        description={when}
        meta={<Pill tone={appointmentStatusTone(appt.status)}>{appt.status}</Pill>}
        actions={
          terminal ? null : (
            <div className="flex flex-wrap gap-2">
              {appt.contactId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/conversations?contactId=${appt.contactId}`} />}
                >
                  <MessageSquare className="mr-1.5 size-3.5" aria-hidden />
                  Message
                </Button>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={() => void openReschedule()} disabled={acting}>
                <RefreshCcw className="mr-1.5 size-3.5" aria-hidden />
                Reschedule
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={() => setCancelOpen(true)} disabled={acting}>
                <XCircle className="mr-1.5 size-3.5" aria-hidden />
                Cancel
              </Button>
            </div>
          )
        }
      />

      {toast ? (
        <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm" role="status">{toast}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Customer">
          <p className="text-sm font-semibold">{appt.inviteeName}</p>
          {appt.inviteePhone ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Phone className="size-3.5" aria-hidden />
              {appt.inviteePhone}
            </p>
          ) : null}
          {appt.inviteeEmail ? <p className="text-sm text-muted-foreground">{appt.inviteeEmail}</p> : null}
          {appt.contactId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              nativeButton={false}
              render={<Link href={`/contacts/${appt.contactId}`} />}
            >
              Open contact
            </Button>
          ) : null}
        </Panel>

        <Panel title="Appointment details">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Staff</dt>
              <dd className="font-medium">{appt.staffName || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Location</dt>
              <dd className="font-medium">{appt.location || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Payment</dt>
              <dd className="font-medium">{appt.paymentStatus || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Source</dt>
              <dd className="font-medium">{appt.source || '—'}</dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Reminders" className="lg:col-span-2">
          {appt.reminderSchedule.length ? (
            <ul className="divide-y rounded-lg border">
              {appt.reminderSchedule.map((r) => (
                <li key={r.key} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span>{r.label}</span>
                  <Pill tone="neutral">{r.status}</Pill>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No reminder steps configured for this appointment.</p>
          )}
        </Panel>

        <Panel title="Activity" className="lg:col-span-2">
          {appt.timeline.length ? (
            <ol className="space-y-2 text-sm">
              {appt.timeline.map((e) => (
                <li key={e.id} className="rounded-lg border px-3 py-2">
                  <p className="font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString()}</p>
                  {e.detail ? <p className="mt-1 text-muted-foreground">{e.detail}</p> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          )}
        </Panel>

        {!terminal ? (
          <Panel title="Internal note" className="lg:col-span-2">
            <Textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} rows={3} />
            <Button type="button" size="sm" className="mt-2" disabled={acting} onClick={() => void addNote()}>
              Add note
            </Button>
            {appt.internalNotes.length ? (
              <ul className="mt-4 space-y-2 border-t pt-4 text-sm">
                {appt.internalNotes.map((n) => (
                  <li key={n.id}>
                    <p className="font-medium">{n.authorName}</p>
                    <p className="text-muted-foreground">{n.body}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </Panel>
        ) : null}
      </div>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reschedule appointment</DialogTitle>
          </DialogHeader>
          <ArAppointmentSlotPicker
            slots={rescheduleSlots}
            loading={loadingSlots}
            selected={rescheduleAt}
            onSelect={setRescheduleAt}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRescheduleOpen(false)}>Close</Button>
            <Button type="button" disabled={!rescheduleAt || acting} onClick={() => void saveReschedule()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this appointment?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Pending reminders will stop and the customer may be notified per your policies.</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>Keep appointment</Button>
            <Button type="button" variant="destructive" disabled={acting} onClick={() => void cancelAppt()}>Cancel appointment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ArOpusPage>
  )
}
