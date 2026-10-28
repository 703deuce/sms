'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { PrimaryButton } from '@/components/app/primary-button'
import { clipsFetch } from '@/lib/clips-api'
import { Loader2 } from 'lucide-react'

export function StopAutoPullButton({
  projectId,
  initialLive,
}: {
  projectId: string
  initialLive: boolean
}) {
  const [live, setLive] = useState(initialLive)
  const [busy, setBusy] = useState(false)

  if (!live) return null

  return (
    <PrimaryButton
      type="button"
      variant="outline"
      className="h-9"
      disabled={busy}
      onClick={() => {
        setBusy(true)
        void clipsFetch<{ stopped: boolean }>(`/api/streamer/projects/${projectId}/stop-auto-pull`, {
          method: 'POST',
        })
          .then((data) => {
            if (data.stopped) {
              setLive(false)
              toast.success('Live auto-pull stopped')
            } else {
              toast.message('Auto-pull was already stopped')
              setLive(false)
            }
          })
          .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not stop auto-pull'))
          .finally(() => setBusy(false))
      }}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : 'Stop auto-pull'}
    </PrimaryButton>
  )
}
