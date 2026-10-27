'use client'

import { Check, Video, Mic } from 'lucide-react'
import { PrimaryButton } from '@/components/app/primary-button'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TrackUploadProgress } from '@/lib/recording/track-upload-manager'

/** §25.1 upload card — w360, real per-track progress */
export function RoomsUploadCard({
  rows = [],
  onDone,
  onCopyRecoveryLink,
  onStartEditing,
}: {
  rows?: TrackUploadProgress[]
  onDone?: () => void
  onCopyRecoveryLink?: () => void
  onStartEditing?: () => void
}) {
  const allDone = rows.length > 0 && rows.every((r) => r.done)
  const stalled = rows.some((r) => r.stalled)

  if (allDone) {
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
    <div
      className={cn(
        'w-[360px] rounded-xl border bg-popover p-4 shadow-lg',
        stalled ? 'border-destructive' : 'border-border',
      )}
    >
      <p className="text-sm font-semibold">Keep this browser tab open!</p>
      <p className="mt-1 text-[13px] text-muted-foreground">
        The recording has stopped — your files are uploading to the cloud.
      </p>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.trackId} className="flex h-12 items-center gap-3">
            {row.label.toLowerCase().includes('microphone') ? (
              <Mic className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <Video className="size-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px]">{row.label}</span>
                {row.done ? (
                  <Check className="size-4 text-success" />
                ) : (
                  <span className="font-mono text-xs tabular-nums">{row.percent}%</span>
                )}
              </div>
              {!row.done && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-all" style={{ width: `${row.percent}%` }} />
                </div>
              )}
              {row.stalled && (
                <p className="mt-1 text-xs text-destructive">⚠ Upload stalled — keep this tab open</p>
              )}
            </div>
          </div>
        ))}
      </div>
      {stalled && (
        <div className="mt-4 flex flex-wrap gap-2">
          {onCopyRecoveryLink ? (
            <Button variant="outline" className="h-8 text-xs" onClick={onCopyRecoveryLink}>
              Copy recovery link
            </Button>
          ) : null}
          {onStartEditing ? (
            <Button variant="ghost" className="h-8 text-xs" onClick={onStartEditing}>
              Start editing project
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}
