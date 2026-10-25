'use client'

import { X } from 'lucide-react'
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
    <div className="rounded-xl surface px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{progress.filename}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {(progress.bytes / (1024 * 1024)).toFixed(1)} MB · {progress.state}
          </p>
        </div>
        {onCancel && progress.state === 'uploading' && (
          <Button variant="ghost" size="icon" aria-label="Cancel upload" onClick={onCancel}>
            <X />
          </Button>
        )}
      </div>
      <Progress value={progress.percent} className="mt-3 h-2" aria-label="Upload progress" />
    </div>
  )
}
