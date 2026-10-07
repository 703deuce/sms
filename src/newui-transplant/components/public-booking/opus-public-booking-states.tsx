'use client'

import { AlertTriangle, Loader2 } from 'lucide-react'
import { OPUS_CARD } from '@/newui-transplant/components/app/opus-surfaces'
import { Button } from '@/newui-transplant/components/ui/button'

export function OpusPublicBookingLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className={OPUS_CARD + ' flex items-center gap-3 px-6 py-8'}>
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">Loading booking…</p>
      </div>
    </div>
  )
}

export function OpusPublicBookingError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className={OPUS_CARD + ' max-w-md px-6 py-8 text-center'}>
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-600" aria-hidden />
        <h2 className="text-base font-semibold">Booking unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Button type="button" className="mt-4" size="sm" onClick={onRetry}>Try again</Button>
      </div>
    </div>
  )
}

export function OpusPublicBookingNotFound() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className={OPUS_CARD + ' max-w-md px-6 py-8 text-center'}>
        <h2 className="text-base font-semibold">This booking page is not available</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Online booking may be turned off or this link may be incorrect.
        </p>
      </div>
    </div>
  )
}
