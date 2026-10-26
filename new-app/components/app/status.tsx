import { Ban, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AiOutcome, CallOutcome, McTbState } from '@/lib/data'

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'muted'

const toneCls: Record<Tone, string> = {
  neutral: 'bg-secondary text-secondary-foreground ring-foreground/10',
  info: 'bg-accent text-accent-foreground ring-primary/20',
  success: 'bg-success/12 text-success ring-success/25',
  warning: 'bg-warning/15 text-warning-foreground ring-warning/30',
  danger: 'bg-destructive/10 text-destructive ring-destructive/25',
  muted: 'bg-muted text-foreground/70 ring-foreground/8',
}

const dotCls: Record<Tone, string> = {
  neutral: 'bg-secondary-foreground/50',
  info: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  muted: 'bg-muted-foreground/50',
}

export function StatusBadge({
  tone = 'neutral',
  children,
  className,
  icon,
}: {
  tone?: Tone
  children: React.ReactNode
  className?: string
  icon?: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        toneCls[tone],
        className,
      )}
    >
      {icon ?? <span aria-hidden className={cn('size-1.5 rounded-full', dotCls[tone])} />}
      {children}
    </span>
  )
}

export function ProjectStatusBadge({
  status,
  showSpinner = true,
}: {
  status: string
  showSpinner?: boolean
}) {
  const ui = CLIP_JOB_STATE[status as ClipProjectStatusUi]
  if (!ui) {
    return <StatusBadge tone="neutral">{status}</StatusBadge>
  }
  const processing = !['READY', 'FAILED', 'CANCELED', 'DRAFT'].includes(status)
  if (processing) {
    return (
      <StatusBadge
        tone="info"
        icon={showSpinner ? <Loader2 className="size-3 animate-spin" aria-hidden /> : undefined}
      >
        {ui.label}
      </StatusBadge>
    )
  }
  if (status === 'READY') {
    return (
      <StatusBadge tone="success" icon={<CheckCircle2 className="size-3" aria-hidden />}>
        Ready
      </StatusBadge>
    )
  }
  if (status === 'FAILED') {
    return (
      <StatusBadge tone="danger" icon={<XCircle className="size-3" aria-hidden />}>
        Failed
      </StatusBadge>
    )
  }
  return <StatusBadge tone={ui.tone}>{ui.label}</StatusBadge>
}

export const CALL_OUTCOME: Record<CallOutcome, { label: string; tone: Tone }> = {
  answered: { label: 'Answered', tone: 'success' },
  missed: { label: 'Missed', tone: 'danger' },
  voicemail: { label: 'Voicemail', tone: 'warning' },
  ai_handled: { label: 'AI handled', tone: 'info' },
  failed: { label: 'Failed', tone: 'danger' },
}

export const AI_OUTCOME: Record<AiOutcome, { label: string; tone: Tone }> = {
  booked: { label: 'Booked', tone: 'success' },
  transferred: { label: 'Transferred', tone: 'info' },
  callback: { label: 'Callback requested', tone: 'warning' },
  message: { label: 'Message taken', tone: 'neutral' },
  unresolved: { label: 'Unresolved', tone: 'warning' },
  failed: { label: 'Ended — spam', tone: 'muted' },
}

export type ClipProjectStatusUi =
  | 'DRAFT'
  | 'UPLOADING'
  | 'QUEUED'
  | 'PREPARING'
  | 'TRANSCRIBING'
  | 'SCANNING'
  | 'FINDING_CLIPS'
  | 'REFRAMING'
  | 'RENDERING'
  | 'READY'
  | 'FAILED'
  | 'CANCELED'

export const CLIP_JOB_STATE: Record<ClipProjectStatusUi, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Draft', tone: 'muted' },
  UPLOADING: { label: 'Uploading', tone: 'muted' },
  QUEUED: { label: 'Queued', tone: 'neutral' },
  PREPARING: { label: 'Transcribing', tone: 'info' },
  TRANSCRIBING: { label: 'Transcribing', tone: 'info' },
  SCANNING: { label: 'Scanning scenes', tone: 'info' },
  FINDING_CLIPS: { label: 'Finding clips', tone: 'info' },
  REFRAMING: { label: 'Reframing & captioning', tone: 'info' },
  RENDERING: { label: 'Reframing & captioning', tone: 'info' },
  READY: { label: 'Ready', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  CANCELED: { label: 'Canceled', tone: 'muted' },
}

export const CLIP_RENDER_STATE = {
  QUEUED: { label: 'Queued', tone: 'neutral' as Tone },
  RENDERING: { label: 'Rendering', tone: 'info' as Tone },
  READY: { label: 'Ready', tone: 'success' as Tone },
  FAILED: { label: 'Failed', tone: 'danger' as Tone },
  EXPIRED: { label: 'Expired', tone: 'muted' as Tone },
}

export const MCTB_STATE: Record<McTbState, { label: string; tone: Tone }> = {
  eligible: { label: 'Eligible', tone: 'neutral' },
  consent_pending: { label: 'No consent', tone: 'muted' },
  declined: { label: 'Declined', tone: 'muted' },
  texted: { label: 'Texted', tone: 'info' },
  replied: { label: 'Replied', tone: 'success' },
  needs_callback: { label: 'Needs callback', tone: 'warning' },
  suppressed: { label: 'Suppressed', tone: 'muted' },
  failed: { label: 'Send failed', tone: 'danger' },
}
