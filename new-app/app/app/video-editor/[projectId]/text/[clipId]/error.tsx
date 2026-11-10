'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function TextEditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[editor:text-gaps] load-error', { message: error.message, digest: error.digest ?? null })
  }, [error])

  return (
    <div className="flex h-dvh items-center justify-center bg-background p-6 text-foreground" role="alert">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <h1 className="text-base font-semibold">Couldn&apos;t load the text editor</h1>
        <p className="mt-2 text-sm text-muted-foreground">The editor load stopped instead of leaving this tab on an endless loading screen.</p>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => { console.info('[editor:text-gaps] load-retry'); reset() }}>Retry</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>Reload tab</Button>
        </div>
      </div>
    </div>
  )
}
