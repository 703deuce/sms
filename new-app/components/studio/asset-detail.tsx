'use client'

import { useState } from 'react'
import { Copy, Download, Trash2 } from 'lucide-react'
import type { StudioJob, StudioModel } from '../../lib/ai-studio/contract'
import { formatCredits, formatJobTimestamp, modeLabel, statusLabel } from '../../lib/ai-studio/format'
import type { EditorProjectOption } from '../../lib/ai-studio/projects'
import { Button } from '../ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'

export function AssetDetail({
  job,
  model,
  open,
  onOpenChange,
  onReuse,
  onSend,
  sending,
  sendError,
  sendResult,
  projects,
  projectsStatus,
  onLoadProjects,
}: {
  job: StudioJob | null
  model?: StudioModel
  open: boolean
  onOpenChange: (open: boolean) => void
  onReuse: (job: StudioJob) => void
  onSend: (projectId: string) => void
  sending: boolean
  sendError: string | null
  sendResult: { href: string } | null
  projects: EditorProjectOption[]
  projectsStatus: 'idle' | 'loading' | 'error'
  onLoadProjects: () => void
}) {
  const [projectId, setProjectId] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const output = job?.output

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-lg" data-testid="studio-asset-detail">
          {job ? (
            <>
              <SheetHeader className="border-b border-border p-4">
                <SheetTitle>Generation</SheetTitle>
                <SheetDescription>
                  {statusLabel(job.status)}
                  {model ? ` · ${model.label}` : ` · ${job.modelId}`}
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="overflow-hidden rounded-xl border border-border bg-secondary">
                  {output && job.status === 'done' && output.kind === 'video' ? (
                    <video src={output.previewUrl} controls className="w-full" playsInline />
                  ) : output && job.status === 'done' && output.kind === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={output.previewUrl} alt="" className="w-full object-contain" />
                  ) : job.status === 'failed' ? (
                    <div className="grid aspect-video place-items-center px-4 text-center text-sm text-destructive">
                      {job.error?.message || 'Generation failed'}
                    </div>
                  ) : (
                    <div className="grid aspect-video place-items-center text-sm text-muted-foreground">
                      {statusLabel(job.status)}
                    </div>
                  )}
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Prompt</p>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => void navigator.clipboard.writeText(job.prompt)}
                      >
                        <Copy className="size-3" />
                        Copy
                      </Button>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{job.prompt || '—'}</p>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Model</dt>
                      <dd className="font-medium">{model?.label ?? job.modelId}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Mode</dt>
                      <dd className="font-medium">{modeLabel(job.mode)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Quality</dt>
                      <dd className="font-medium">{job.resolution ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Size</dt>
                      <dd className="font-medium">
                        {job.aspect ?? '—'}
                        {job.durationSec ? ` · ${job.durationSec}s` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Created</dt>
                      <dd className="font-medium">{formatJobTimestamp(job.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Estimate</dt>
                      <dd className="font-medium">{formatCredits(job.creditEstimate)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              <div className="flex flex-col gap-2 border-t border-border p-4">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => onReuse(job)}>
                    Reuse settings
                  </Button>
                  {output && job.status === 'done' && (
                    <Button type="button" variant="outline" render={<a href={output.downloadUrl} download />}>
                      <Download className="size-4" />
                      Download
                    </Button>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className="inline-flex">
                            <Button type="button" variant="outline" disabled onClick={() => setConfirmDelete(true)}>
                              <Trash2 className="size-4" />
                              Delete
                            </Button>
                          </span>
                        }
                      />
                      <TooltipContent>Delete isn’t available yet. The studio API has no delete endpoint.</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {job.status === 'done' && (
                  <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                    <p className="text-xs font-medium">Send to timeline</p>
                    <Select
                      value={projectId}
                      onValueChange={(v) => v && setProjectId(v)}
                      items={projects.map((p) => ({ value: p.id, label: p.title }))}
                      disabled={projectsStatus === 'loading'}
                    >
                      <SelectTrigger
                        aria-label="Editor project"
                        className="w-full bg-card"
                        onClick={() => {
                          if (projectsStatus === 'idle' && projects.length === 0) onLoadProjects()
                        }}
                      >
                        <SelectValue placeholder="Choose a project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" size="sm" disabled={!projectId || sending} onClick={() => onSend(projectId)}>
                      {sending ? 'Sending…' : 'Send to timeline'}
                    </Button>
                    {sendError && <p className="text-xs text-destructive">{sendError}</p>}
                    {sendResult && (
                      <a href={sendResult.href} className="text-xs font-medium text-primary hover:underline">
                        Open in editor
                      </a>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-4 text-sm text-muted-foreground">No generation selected.</div>
          )}
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this generation?</AlertDialogTitle>
            <AlertDialogDescription>
              The studio API doesn’t include a delete endpoint yet, so this action can’t run.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
