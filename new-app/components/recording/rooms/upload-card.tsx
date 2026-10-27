'use client'

import { useState } from 'react'
import { Check, Video } from 'lucide-react'
import { PrimaryButton } from '@/components/app/primary-button'

/** §25.1 upload card — w360, draggable placeholder (fixed position in parent) */
export function RoomsUploadCard({ onDone }: { onDone?: () => void }) {
  const [progress, setProgress] = useState(72)
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <div className="w-[360px] rounded-xl border border-border bg-popover p-4 shadow-lg">
        <p className="text-[13px] text-muted-foreground">
          All recordings were successfully uploaded. Thanks for recording with Transovo!
        </p>
        <PrimaryButton className="mt-4 h-9 w-full" onClick={onDone}>Got it</PrimaryButton>
      </div>
    )
  }

  return (
    <div className="w-[360px] rounded-xl border border-border bg-popover p-4 shadow-lg">
      <p className="text-sm font-semibold">Keep this browser tab open!</p>
      <p className="mt-1 text-[13px] text-muted-foreground">
        The recording has stopped — your files are uploading to the cloud.
      </p>
      <div className="mt-4 flex h-12 items-center gap-3">
        <Video className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px]">Camera · You</span>
            <span className="font-mono text-xs tabular-nums">{progress}%</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
      <div className="mt-3 flex h-12 items-center gap-3 text-[13px] text-success">
        <Check className="size-4" />
        Microphone · uploaded
      </div>
      <button
        type="button"
        className="mt-3 text-xs text-primary hover:underline"
        onClick={() => {
          setProgress(100)
          setDone(true)
        }}
      >
        Simulate complete
      </button>
    </div>
  )
}
