'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DriveTranscribingDialog({
  open,
  fileName,
  onClose,
}: {
  open: boolean
  fileName?: string
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal>
      <div className="w-full max-w-[448px] rounded-xl border border-border bg-popover shadow-lg" data-testid="drive-transcribing-dialog">
        <div className="flex h-12 items-center justify-between border-b border-border px-4">
          <h2 className="text-sm font-semibold">Transcribing…</h2>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <div className="space-y-4 p-4 text-[13px]">
          <p className="text-muted-foreground">Your transcript will be ready in a few minutes.</p>
          <div className="flex h-10 items-center gap-2 rounded-lg bg-muted/50 px-2">
            <span className="size-4 rounded bg-muted" aria-hidden />
            <span className="truncate">{fileName ?? 'Upload'}</span>
            <span className="ml-auto text-xs text-muted-foreground">👥 1</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span>Languages</span>
            <span className="rounded-md bg-muted px-2 py-1">Auto</span>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" className="size-4" />
            Always ask before detecting speakers
          </label>
          <Button type="button" className="h-8 w-full" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  )
}
