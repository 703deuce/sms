'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function TemplatesModeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[editor:templates-mode] route-error', {
      path: typeof window === 'undefined' ? null : window.location.pathname,
      message: error.message,
      digestPresent: Boolean(error.digest),
    })
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold">Templates could not load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your clip was not changed. Retry this editor mode, or return to the project and open it again.
        </p>
        <Button
          className="mt-5"
          onClick={() => {
            console.info('[editor:templates-mode] route-retry', {
              path: typeof window === 'undefined' ? null : window.location.pathname,
            })
            reset()
          }}
        >
          Retry
        </Button>
      </div>
    </div>
  )
}
