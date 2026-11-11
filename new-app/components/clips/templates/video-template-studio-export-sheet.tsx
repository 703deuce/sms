'use client'

import Link from 'next/link'
import type { ExportAspect } from '@/lib/clips/export-aspect'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type RenderJob = {
  id: string
  status: string
  progress: number | null
  phase: string | null
  error: string | null
  downloadUrl: string | null
  filename: string | null
}

export function VideoTemplateStudioExportSheet({
  open,
  onOpenChange,
  aspects,
  aspect,
  onAspectChange,
  resolution,
  onResolutionChange,
  busy,
  canExport,
  hint,
  onStartExport,
  render,
  onCancelQueued,
  onRetry,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  aspects: string[]
  aspect: ExportAspect
  onAspectChange: (value: ExportAspect) => void
  resolution: '720p' | '1080p'
  onResolutionChange: (value: '720p' | '1080p') => void
  busy: boolean
  canExport: boolean
  hint: string | null
  onStartExport: () => void
  render: RenderJob | null
  onCancelQueued: () => void
  onRetry: () => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm">
        <SheetHeader>
          <SheetTitle>Export video</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {hint ? <p className="text-sm text-muted-foreground" role="status">{hint}</p> : null}
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resolution</legend>
            {(['720p', '1080p'] as const).map(option => (
              <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="export-resolution"
                  checked={resolution === option}
                  onChange={() => onResolutionChange(option)}
                />
                {option} MP4
              </label>
            ))}
          </fieldset>
          {aspects.length > 1 ? (
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aspect</legend>
              {aspects.map(option => (
                <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name="export-aspect"
                    checked={aspect === option}
                    onChange={() => onAspectChange(option as ExportAspect)}
                  />
                  {option}
                </label>
              ))}
            </fieldset>
          ) : null}
          <Button
            type="button"
            className="w-full"
            disabled={!canExport || busy}
            onClick={onStartExport}
            aria-label="Start export"
          >
            Start export
          </Button>
          {render ? (
            <div className="space-y-2 rounded-xl border p-3 text-sm" role="status" data-testid="template-export-progress">
              <p className="font-medium">
                Render {render.status}
                {render.progress != null ? ` · ${render.progress}%` : ''}
              </p>
              {render.phase ? <p className="text-xs text-muted-foreground">{render.phase}</p> : null}
              {render.error ? <p className="text-xs text-destructive">{render.error}</p> : null}
              {render.downloadUrl && render.status === 'READY' ? (
                <Link
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
                  href={render.downloadUrl}
                  download={render.filename ?? undefined}
                >
                  Download video
                </Link>
              ) : null}
              {render.status === 'QUEUED' ? (
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onCancelQueued}>
                  Cancel queued render
                </Button>
              ) : null}
              {render.status === 'FAILED' && render.error !== 'Canceled before render started' ? (
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onRetry}>
                  Retry failed render
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
