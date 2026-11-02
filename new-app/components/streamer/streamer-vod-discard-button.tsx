'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cancelProject } from '@/lib/clips-api'
import type { ClipProjectStatus } from '@prisma/client'

const DISCARDABLE: ClipProjectStatus[] = [
  'DRAFT',
  'UPLOADING',
  'QUEUED',
  'PREPARING',
  'TRANSCRIBING',
  'SCANNING',
  'FINDING_CLIPS',
  'REFRAMING',
  'RENDERING',
]

export function StreamerVodDiscardButton({
  projectId,
  status,
}: {
  projectId: string
  status: ClipProjectStatus
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const canDiscard = DISCARDABLE.includes(status)

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy || !canDiscard}
      title={canDiscard ? 'Stop processing and cancel this import' : undefined}
      onClick={() => {
        setBusy(true)
        void (async () => {
          try {
            await cancelProject(projectId)
            toast.success('Import discarded')
            router.refresh()
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not discard')
          } finally {
            setBusy(false)
          }
        })()
      }}
    >
      {busy ? 'Discarding…' : 'Discard'}
    </Button>
  )
}
