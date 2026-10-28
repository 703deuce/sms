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

  if (!live) {
    return (
      <span className="inline-flex h-9 items-center rounded-md border border-border/60 px-3 text-sm text-muted-foreground">
        Auto-pull off
      </span>
    )
  }

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
            setLive(false)
            if (data.stopped) {
              toast.success('Live auto-pull stopped')
            } else {
              toast.message('Auto-pull was already off')
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
