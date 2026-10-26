'use client'

import { FileVideo, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { UploadProgress } from '@/lib/clips/upload'

export function UploadProgressItem({
  progress,
  onCancel,
  onRetry,
  onChooseFile,
}: {
  progress: UploadProgress
  onCancel?: () => void
  onRetry?: () => void
  /** Opens file picker to resume an interrupted upload */
  onChooseFile?: () => void
}) {
  const isError = progress.state === 'error'
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <FileVideo className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{progress.filename}</p>
        <Progress
          value={isError ? progress.percent : progress.percent}
          className="mt-2 h-1.5"
          aria-label="Upload progress"
        />
        <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
          {progress.state === 'uploading' && progress.percent === 0 && progress.loaded === 0
            ? 'Starting…'
            : `${progress.percent}%`}
          {progress.bytes > 0 ? ` · ${formatBytes(progress.loaded)} / ${formatBytes(progress.bytes)}` : null}
        </p>
        {isError && progress.error ? (
          <p className="mt-2 text-xs text-destructive" role="alert">{progress.error}</p>
        ) : null}
        {isError ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {onChooseFile ? (
              <Button type="button" size="sm" className="gap-1.5" onClick={onChooseFile}>
                Choose file to resume
              </Button>
            ) : null}
            {onRetry ? (
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
                <RotateCcw className="size-3.5" aria-hidden />
                Retry
              </Button>
            ) : null}
            {onCancel ? (
              <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                Cancel upload
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {onCancel && progress.state === 'uploading' && (
        <Button variant="ghost" size="icon" aria-label="Cancel upload" onClick={onCancel}>
          <X className="size-4" />
        </Button>
      )}
    </div>
  )
}

function formatBytes(n: number) {
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} B`
}
