'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { clipsFetch } from '@/lib/clips-api'

export function StreamerVodRetryButton({ projectId, disabled }: { projectId: string; disabled?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy || disabled}
      onClick={() => {
        setBusy(true)
        void (async () => {
          try {
            await clipsFetch(`/api/clips/projects/${projectId}/retry`, { method: 'POST' })
            toast.success('Retry queued')
            router.refresh()
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Retry failed')
          } finally {
            setBusy(false)
          }
        })()
      }}
    >
      {busy ? 'Retrying…' : 'Retry'}
    </Button>
  )
}
