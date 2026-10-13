'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/newui-transplant/components/ui/button'
import { Input } from '@/newui-transplant/components/ui/input'
import { Label } from '@/newui-transplant/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/newui-transplant/components/ui/sheet'
import { Callout } from '@/newui-transplant/components/app/kit'

type Props = {
  open: boolean
  appointmentId: string
  currentStartsAt: string
  recurringSeriesId?: string
  onClose: () => void
  onDone: () => void
  onReschedule?: (appointmentId: string, startsAt: string) => void
}

export function ArCalendarRescheduleSheet({
  open,
  appointmentId,
  currentStartsAt,
  recurringSeriesId,
  onClose,
  onDone,
  onReschedule,
}: Props) {
  const [startsAt, setStartsAt] = useState(currentStartsAt.slice(0, 16))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setBusy(true)
    setError('')
    const iso = new Date(startsAt).toISOString()
    try {
      if (onReschedule) {
        onReschedule(appointmentId, iso)
        onDone()
        onClose()
        return
      }
      const res = await fetch(`/api/appointments/${encodeURIComponent(appointmentId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startsAt: iso }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Reschedule failed')
      onDone()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reschedule failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="flex w-full max-w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-5 text-left">
          <SheetTitle className="text-base font-semibold">Reschedule</SheetTitle>
          <p className="text-sm text-muted-foreground">Pick a new start time for this appointment.</p>
        </SheetHeader>
        <div className="space-y-4 px-6 py-5">
          {error ? (
            <Callout tone="danger" title="Reschedule failed">
              <p className="text-sm">{error}</p>
            </Callout>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="ar-reschedule-start">New start</Label>
            <Input
              id="ar-reschedule-start"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Uses the same availability and conflict rules as the full appointment editor.
            {recurringSeriesId ? ' You may be asked to choose series scope before saving.' : null}
          </p>
        </div>
        <SheetFooter className="flex-col gap-2 border-t px-6 py-4 sm:flex-col">
          <Button type="button" className="w-full" disabled={busy} onClick={() => void save()}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
            Save new time
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={onClose}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
