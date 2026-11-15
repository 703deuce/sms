'use client'

import { Download, ExternalLink, Film } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { MS_LABELS, formatLabel } from '@/lib/motion-studio/config'
import { formatClock, formatMsCredits } from '@/lib/motion-studio/format'
import type { MsProject } from '@/lib/motion-studio/types'

/** Review and export (ST-UX-070): MP4 1080p, or open the project in the advanced (Compact) editor. */
export function MotionExportDialog({
  open,
  onOpenChange,
  project,
  busy,
  onExport,
  onDownload,
  onOpenEditor,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: MsProject
  busy: string | null
  onExport: () => void
  onDownload: () => void
  onOpenEditor: () => void
}) {
  const ex = project.export
  const canExport = project.status === 'review' || project.status === 'complete' || project.status === 'exporting'
  const renderItem = project.allowance?.items.find((i) => i.id === 'render')
  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o)}>
      <DialogContent className="sm:max-w-md" data-testid="ms-export-dialog">
        <DialogHeader>
          <DialogTitle>Export documentary</DialogTitle>
          <DialogDescription>MP4 · {formatLabel(project.settings)} · {formatClock(project.durationMs)}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Film className="size-4" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{project.title}</p>
              <p className="text-xs text-muted-foreground tabular-nums">Final render · {formatMsCredits(renderItem?.credits ?? project.allowance?.estimateCredits ?? null)}</p>
            </div>
          </div>
          {ex.status === 'queued' || ex.status === 'rendering' ? (
            <div className="flex flex-col gap-1.5" role="status" aria-live="polite">
              <div className="flex justify-between text-xs"><span>{ex.status === 'queued' ? 'Queued' : 'Rendering'}</span><span className="tabular-nums">{ex.progress}%</span></div>
              <Progress value={ex.progress} className="h-1.5" />
            </div>
          ) : null}
          {project.status === 'exporting' && ex.status !== 'rendering' && ex.status !== 'queued' ? (
            <p className="text-xs text-muted-foreground" role="status">Re-assembling with your scene changes. The download unlocks when it finishes.</p>
          ) : null}
          {ex.status === 'failed' ? <p className="text-sm text-destructive" role="alert">{ex.error ?? 'The export failed.'} You can start it again; nothing retries automatically.</p> : null}
          {!canExport ? <p className="text-xs text-muted-foreground">Export unlocks when the documentary is ready for review.</p> : null}
          {canExport ? (
            <p className="text-xs text-muted-foreground" data-testid="ms-editor-program-note">
              The advanced editor opens the assembled program MP4 (picture and full mix) in the Compact Editor, so captions and export work as usual. Per-scene changes are made here with Regenerate, then Export.
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onOpenEditor} disabled={busy != null || !canExport} data-testid="ms-open-editor">
              <ExternalLink className="size-3.5" aria-hidden />
              {MS_LABELS.openAdvanced}
            </Button>
            {ex.status === 'ready' ? (
              <Button onClick={onDownload} disabled={busy != null} data-testid="ms-download">
                <Download className="size-3.5" aria-hidden />
                Download MP4
              </Button>
            ) : (
              <Button onClick={onExport} disabled={busy != null || !canExport || ex.status === 'queued' || ex.status === 'rendering'} data-testid="ms-export-start">
                {ex.status === 'failed' ? 'Export again' : MS_LABELS.exportMp4}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
