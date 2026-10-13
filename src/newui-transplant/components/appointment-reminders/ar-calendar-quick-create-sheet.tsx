'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/newui-transplant/components/ui/button'
import { Input } from '@/newui-transplant/components/ui/input'
import { Label } from '@/newui-transplant/components/ui/label'
import { Textarea } from '@/newui-transplant/components/ui/textarea'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/newui-transplant/components/ui/sheet'
import { Callout } from '@/newui-transplant/components/app/kit'

export type ArQuickCreatePrefill = {
  startsAt: string
  staffId?: string
  locationId?: string
  serviceId?: string
}

type Workspace = {
  staff: Array<{ id: string; name: string }>
  services: Array<{ id: string; name: string }>
  locations?: Array<{ id: string; name: string }>
}

type Props = {
  open: boolean
  prefill: ArQuickCreatePrefill | null
  workspace: Workspace | null
  onClose: () => void
  onCreated: () => void
  onOpenFullForm: (query: URLSearchParams) => void
  onViewWaitlistMatches?: (slot: { startsAt: string; serviceName?: string }) => void
}

export function ArCalendarQuickCreateSheet({
  open,
  prefill,
  workspace,
  onClose,
  onCreated,
  onOpenFullForm,
  onViewWaitlistMatches,
}: Props) {
  const [serviceId, setServiceId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [slots, setSlots] = useState<Array<{ startsAt: string; endsAt: string }>>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [waitlistCount, setWaitlistCount] = useState(0)
  const [slotWarning, setSlotWarning] = useState('')

  const service = workspace?.services.find((s) => s.id === serviceId)

  useEffect(() => {
    if (!open || !prefill) return
    setStartsAt(prefill.startsAt.slice(0, 16))
    setStaffId(prefill.staffId || '')
    setLocationId(prefill.locationId || '')
    setServiceId(prefill.serviceId || '')
    setError('')
    setSlotWarning('')
  }, [open, prefill])

  useEffect(() => {
    if (!open || !serviceId) {
      setSlots([])
      return
    }
    setSlotsLoading(true)
    const params = new URLSearchParams({ serviceId, daysAhead: '14' })
    if (service?.name) params.set('serviceName', service.name)
    if (staffId) params.set('staffId', staffId)
    if (locationId) params.set('locationId', locationId)
    fetch(`/api/appointments/availability?${params}`)
      .then((r) => r.json())
      .then((json) => setSlots(json.data?.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [open, service?.name, serviceId, staffId, locationId])

  const nearestSlots = useMemo(() => {
    if (!startsAt || !slots.length) return []
    const target = new Date(startsAt).getTime()
    return [...slots]
      .sort(
        (a, b) =>
          Math.abs(new Date(a.startsAt).getTime() - target) -
          Math.abs(new Date(b.startsAt).getTime() - target),
      )
      .slice(0, 5)
  }, [slots, startsAt])

  useEffect(() => {
    if (!open || !startsAt) return
    const iso = new Date(startsAt).toISOString()
    const exact = slots.some((s) => s.startsAt === iso)
    if (slots.length && !exact) {
      setSlotWarning('That time is not available in the canonical schedule. Pick a valid slot below.')
    } else {
      setSlotWarning('')
    }
  }, [open, slots, startsAt])

  useEffect(() => {
    if (!open || !startsAt) return
    const params = new URLSearchParams({ startsAt: new Date(startsAt).toISOString() })
    if (service?.name) params.set('serviceName', service.name)
    if (serviceId) params.set('serviceId', serviceId)
    if (staffId) params.set('staffId', staffId)
    if (locationId) params.set('locationId', locationId)
    fetch(`/api/appointments/calendar/waitlist-match?${params}`)
      .then((r) => r.json())
      .then((json) => setWaitlistCount(Number(json.data?.count || 0)))
      .catch(() => setWaitlistCount(0))
  }, [open, startsAt, service?.name, serviceId, staffId, locationId])

  async function create() {
    if (!phone.trim() || !startsAt) {
      setError('Client phone and time are required.')
      return
    }
    const iso = new Date(startsAt).toISOString()
    if (slots.length && !slots.some((s) => s.startsAt === iso)) {
      setError('Choose a canonically available time.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: serviceId || undefined,
          serviceName: service?.name || 'Appointment',
          startsAt: iso,
          firstName: firstName.trim() || 'Guest',
          lastName: lastName.trim(),
          phone: phone.trim(),
          notes: notes.trim() || undefined,
          smsConsent: false,
          source: 'admin',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not create appointment')
      onCreated()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  function openFull() {
    const baseStart = startsAt || prefill?.startsAt || new Date().toISOString()
    const q = new URLSearchParams({ startsAt: new Date(baseStart).toISOString() })
    if (staffId) q.set('staffId', staffId)
    if (locationId) q.set('locationId', locationId)
    if (serviceId) q.set('serviceId', serviceId)
    if (phone) q.set('phone', phone)
    onOpenFullForm(q)
  }

  return (
    <Sheet open={open && Boolean(prefill)} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="flex w-full max-w-full flex-col gap-0 p-0 sm:max-w-md md:max-w-lg">
        <SheetHeader className="border-b px-6 py-5 text-left">
          <SheetTitle className="text-base font-semibold">Quick create appointment</SheetTitle>
          {waitlistCount > 0 ? (
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-sm"
              onClick={() =>
                onViewWaitlistMatches?.({
                  startsAt: new Date(startsAt || prefill?.startsAt || '').toISOString(),
                  serviceName: service?.name,
                })
              }
            >
              {waitlistCount} waitlist {waitlistCount === 1 ? 'match' : 'matches'} for this slot
            </Button>
          ) : null}
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {error ? (
            <Callout tone="danger" title="Could not create">
              <p className="text-sm">{error}</p>
            </Callout>
          ) : null}
          {slotWarning ? (
            <Callout tone="warning" title="Time not in schedule">
              <p className="text-sm">{slotWarning}</p>
            </Callout>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="ar-qc-service">Service</Label>
            <SimpleSelect
              id="ar-qc-service"
              className="h-10 w-full"
              label="Service"
              value={serviceId}
              onChange={setServiceId}
              options={[
                { value: '', label: 'Select service' },
                ...(workspace?.services || []).map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ar-qc-staff">Staff</Label>
            <SimpleSelect
              id="ar-qc-staff"
              className="h-10 w-full"
              label="Staff"
              value={staffId}
              onChange={setStaffId}
              options={[
                { value: '', label: 'Any / default' },
                ...(workspace?.staff || []).map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>

          {workspace?.locations?.length ? (
            <div className="space-y-2">
              <Label htmlFor="ar-qc-location">Location</Label>
              <SimpleSelect
                id="ar-qc-location"
                className="h-10 w-full"
                label="Location"
                value={locationId}
                onChange={setLocationId}
                options={[
                  { value: '', label: 'Default' },
                  ...workspace.locations.map((l) => ({ value: l.id, label: l.name })),
                ]}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Available slots</Label>
            {slotsLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading slots…
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {nearestSlots.map((s) => (
                  <Button
                    key={s.startsAt}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStartsAt(s.startsAt.slice(0, 16))}
                  >
                    {new Date(s.startsAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ar-qc-start">Start</Label>
            <Input
              id="ar-qc-start"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ar-qc-first">First name</Label>
              <Input id="ar-qc-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ar-qc-last">Last name</Label>
              <Input id="ar-qc-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ar-qc-phone">Phone</Label>
            <Input id="ar-qc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ar-qc-notes">Notes</Label>
            <Textarea id="ar-qc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>

        <SheetFooter className="flex-col gap-2 border-t px-6 py-4 sm:flex-col">
          <Button type="button" className="w-full" disabled={busy} onClick={() => void create()}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
            Create appointment
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={openFull}>
            Open full booking form
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
