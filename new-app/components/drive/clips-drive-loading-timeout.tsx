'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

/** Shown when the drive route loading UI stays up too long (stuck RSC / hydration). */
export function ClipsDriveLoadingTimeout({ timeoutMs = 20_000 }: { timeoutMs?: number }) {
  const router = useRouter()
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), timeoutMs)
    return () => clearTimeout(t)
  }, [timeoutMs])

  if (!slow) return null

  return (
    <div
      className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
      role="alert"
      data-testid="clips-drive-load-timeout"
    >
      <p className="font-medium text-foreground">Projects are taking longer than usual.</p>
      <p className="mt-1 text-muted-foreground">Check your connection, then retry loading the list.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => router.refresh()}>
          Retry
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    </div>
  )
}
