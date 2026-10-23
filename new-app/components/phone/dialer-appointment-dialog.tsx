'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { COMMON_IANA_TIMEZONES } from '@/lib/phone/common-timezones'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  contactName: string
  defaultTimezone?: string
  onCreated?: () => void
}

export function DialerAppointmentDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  defaultTimezone,
  onCreated,
}: Props) {
  const [title, setTitle] = useState(`Meeting with ${contactName}`)
  const [startsAt, setStartsAt] = useState('')
  const [timezone, setTimezone] = useState(defaultTimezone || 'America/Chicago')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!startsAt) {
      toast.error('Pick a start time')
      return
    }
    setBusy(true)
    try {
      const r = await fetch('/api/crm/native/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId,
          title,
          startsAt: new Date(startsAt).toISOString(),
          timezone,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Could not create appointment')
      toast.success('Appointment created')
      onOpenChange(false)
      onCreated?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule appointment</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="text-sm">
            Title
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
          </label>
          <label className="text-sm">
            Start
            <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-1" />
          </label>
          <label className="text-sm">
            Timezone
            <select
              className="mt-1 w-full rounded border px-2 py-2 text-sm"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              aria-label="Timezone"
            >
              {COMMON_IANA_TIMEZONES.map((z) => (
                <option key={z.value} value={z.value}>{z.label}</option>
              ))}
            </select>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy} onClick={() => void save()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
