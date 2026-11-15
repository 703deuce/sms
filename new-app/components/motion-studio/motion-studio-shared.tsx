'use client'

import { AlertTriangle, CheckCircle2, Circle, Loader2, PauseCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MsStageStatus } from '@/lib/motion-studio/types'

export function StageStatusIcon({ status, className }: { status: MsStageStatus; className?: string }) {
  const cls = cn('size-4 shrink-0', className)
  switch (status) {
    case 'done':
      return <CheckCircle2 className={cn(cls, 'text-success')} aria-label="Done" />
    case 'running':
      return <Loader2 className={cn(cls, 'animate-spin text-primary motion-reduce:animate-none')} aria-label="Running" />
    case 'needs_review':
      return <PauseCircle className={cn(cls, 'text-warning')} aria-label="Needs review" />
    case 'failed':
      return <XCircle className={cn(cls, 'text-destructive')} aria-label="Failed" />
    default:
      return <Circle className={cn(cls, 'text-muted-foreground/60')} aria-label="Pending" />
  }
}

export const STAGE_STATUS_LABEL: Record<MsStageStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  done: 'Done',
  needs_review: 'Needs review',
  failed: 'Failed',
}

/** Shown while the backend is not connected, so nobody mistakes preview data for real output. */
export function MockDataNotice({ className }: { className?: string }) {
  return (
    <div
      role="note"
      data-testid="motion-studio-mock-notice"
      className={cn('flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground', className)}
    >
      <AlertTriangle className="size-3.5 shrink-0 text-warning" aria-hidden />
      <span>
        Preview data. The production backend isn’t connected yet, so plans and renders here are simulated and nothing is charged.
      </span>
    </div>
  )
}

export function InlineError({ message, onDismiss, action }: { message: string; onDismiss?: () => void; action?: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
      <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <p className="min-w-0 flex-1 text-foreground">{message}</p>
      {action}
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="rounded text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          Dismiss
        </button>
      ) : null}
    </div>
  )
}
