'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function ClipsDriveError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[clips-drive]', error.message, error.digest)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-3 p-6" data-testid="clips-drive-error">
      <h2 className="text-lg font-semibold">Could not load projects</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message.includes('_timeout')
          ? 'Loading timed out. The database or workspace lookup may be slow.'
          : 'Something went wrong while loading your clips workspace.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button type="button" variant="outline" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    </div>
  )
}
