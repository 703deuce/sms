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
    console.error('[editor:text-gaps] load-error', { name: error.name, hasDigest: Boolean(error.digest) })
  }, [error])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <h1 className="text-lg font-semibold">Text editor could not load</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Your edits have not been changed. The load stopped instead of leaving this tab on an endless loading screen.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => { console.info('[editor:text-gaps] load-retry'); reset() }}>Retry</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>Reload tab</Button>
      </div>
    </div>
  )
}
