import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AiOutcome, CallOutcome, McTbState } from '@/lib/data'

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'muted'

const toneCls: Record<Tone, string> = {
  neutral: 'bg-secondary text-foreground ring-border',
  info: 'bg-primary/20 text-primary ring-primary/40',
  success: 'bg-success/20 text-success ring-success/40',
  warning: 'bg-warning/20 text-warning-foreground ring-warning/40',
  danger: 'bg-destructive/20 text-destructive ring-destructive/40',
  muted: 'bg-secondary text-foreground ring-border',
}

const dotCls: Record<Tone, string> = {
  neutral: 'bg-secondary-foreground/50',
  info: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  muted: 'bg-muted-foreground/50',
}

const onMediaShell = 'bg-black/70 text-white ring-1 ring-inset ring-white/15 backdrop-blur-sm'

export function StatusBadge({
  tone = 'neutral',
  children,
  className,
  icon,
  onMedia = false,
}: {
  tone?: Tone
  children: React.ReactNode
  className?: string
  icon?: React.ReactNode
  onMedia?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset',
        onMedia ? onMediaShell : toneCls[tone],
        className,
      )}
    >
      {icon ?? <span aria-hidden className={cn('size-1.5 rounded-full', onMedia ? dotCls[tone] : dotCls[tone])} />}
      {children}
    </span>
  )
}

export function ProjectStatusBadge({
  status,
  showSpinner = true,
  onMedia = false,
}: {
  status: string
  showSpinner?: boolean
  onMedia?: boolean
}) {
  const ui = CLIP_JOB_STATE[status as ClipProjectStatusUi]
  if (!ui) {
    return (
      <StatusBadge tone="neutral" onMedia={onMedia}>
        {status}
      </StatusBadge>
    )
  }
  const processing = !['READY', 'FAILED', 'CANCELED', 'DRAFT'].includes(status)
  if (processing) {
    return (
      <StatusBadge
        tone="info"
        onMedia={onMedia}
        icon={showSpinner ? <Loader2 className="size-3 animate-spin" aria-hidden /> : undefined}
      >
        {ui.label}
      </StatusBadge>
    )
  }
  if (status === 'READY') {
    return (
      <StatusBadge tone="success" onMedia={onMedia} icon={<CheckCircle2 className="size-3" aria-hidden />}>
        Ready
      </StatusBadge>
    )
  }
  if (status === 'FAILED') {
    return (
      <StatusBadge tone="danger" onMedia={onMedia} icon={<XCircle className="size-3" aria-hidden />}>
        Failed
      </StatusBadge>
    )
  }
  return (
    <StatusBadge tone={ui.tone} onMedia={onMedia}>
      {ui.label}
    </StatusBadge>
  )
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
