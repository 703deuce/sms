'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

export function T2vBuildProgress({
  progress,
  stage,
  error,
  onCancel,
  onRetry,
}: {
  progress: number
  stage: string | null
  error: string | null
  onCancel?: () => void
  onRetry?: () => void
}) {
  if (error) {
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-md rounded-xl border border-destructive/40 bg-card p-5 shadow-lg">
          <p className="font-medium text-destructive">Build failed</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <div className="mt-4 flex justify-end gap-2">
            {onRetry ? (
              <Button type="button" size="sm" onClick={onRetry}>Retry</Button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  const label = stage?.replace(/_/g, ' ') || 'Building your video'

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-lg">
        <p className="flex items-center gap-2 font-medium">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Building your video
        </p>
        <Progress className="mt-3" value={Math.max(5, progress)} />
        <p className="mt-2 text-sm capitalize text-muted-foreground">{label} · {progress}%</p>
        <p className="mt-1 text-xs text-muted-foreground">You can leave this page; the build continues in the background.</p>
        {onCancel ? (
          <Button type="button" size="sm" variant="outline" className="mt-4" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  )
}
