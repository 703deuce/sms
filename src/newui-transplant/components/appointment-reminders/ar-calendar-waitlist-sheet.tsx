'use client'

import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/newui-transplant/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/newui-transplant/components/ui/sheet'
import type {
  OpenSlotSummary,
  WaitlistMatchRow,
} from '@/components/appointments/calendar/calendar-waitlist-match-drawer'

export type { OpenSlotSummary, WaitlistMatchRow }

type Props = {
  open: boolean
  slot: OpenSlotSummary | null
  matches: WaitlistMatchRow[]
  loading?: boolean
  busyEntryId?: string | null
  onClose: () => void
  onOffer: (entryId: string) => void
}

function fmtSlot(slot: OpenSlotSummary) {
  const start = new Date(slot.startsAt)
  const end = slot.endsAt ? new Date(slot.endsAt) : null
  const day = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  const t1 = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const t2 = end?.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return { day, range: `${t1}${t2 ? ` – ${t2}` : ''}` }
}

export function ArCalendarWaitlistSheet({
  open,
  slot,
  matches,
  loading,
  busyEntryId,
  onClose,
  onOffer,
}: Props) {
  const { day, range } = slot ? fmtSlot(slot) : { day: '', range: '' }

  return (
    <Sheet open={open && Boolean(slot)} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="flex w-full max-w-full flex-col gap-0 p-0 sm:max-w-md md:max-w-lg">
        <SheetHeader className="border-b px-6 py-5 text-left">
          <SheetTitle className="text-base font-semibold">{day || 'Open slot'}</SheetTitle>
          {slot ? (
            <>
              <p className="text-sm font-medium text-foreground">{range}</p>
              {slot.serviceName ? <p className="text-sm text-muted-foreground">{slot.serviceName}</p> : null}
              <p className="text-xs text-muted-foreground">
                {[slot.locationLabel, slot.staffLabel].filter(Boolean).join(' · ')}
              </p>
            </>
          ) : null}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <h2 className="mb-3 text-sm font-semibold">Waitlist matches</h2>
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading matches…
            </p>
          ) : null}
          {!loading && !matches.length ? (
            <p className="text-sm text-muted-foreground">No waitlist clients match this opening.</p>
          ) : null}
          <ul className="divide-y rounded-lg border border-border">
            {matches.map((m) => (
              <li key={m.entryId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{m.contactLabel}</p>
                  <p className="text-xs text-muted-foreground">{m.preferenceSummary}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0"
                  disabled={busyEntryId === m.entryId}
                  onClick={() => onOffer(m.entryId)}
                >
                  {busyEntryId === m.entryId ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    'Offer slot'
                  )}
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <SheetFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" className="w-full" nativeButton={false} render={<Link href="/appointments/waitlist" />}>
            Open waitlist
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
