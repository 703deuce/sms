'use client'

import { FileVideo, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { UploadProgress } from '@/lib/clips/upload'

export function UploadProgressItem({
  progress,
  onCancel,
}: {
  progress: UploadProgress
  onCancel?: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <FileVideo className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{progress.filename}</p>
        <Progress value={progress.percent} className="mt-2 h-1.5" aria-label="Upload progress" />
        <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">{progress.percent}%</p>
      </div>
      {onCancel && progress.state === 'uploading' && (
        <Button variant="ghost" size="icon" aria-label="Cancel upload" onClick={onCancel}>
          <X className="size-4" />
        </Button>
      )}
    </div>
  )
}
