import { cn } from '@/lib/utils'
import type { AiOutcome, CallOutcome, McTbState } from '@/lib/data'

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'muted'

const toneCls: Record<Tone, string> = {
  neutral: 'bg-secondary text-secondary-foreground ring-foreground/10',
  info: 'bg-accent text-accent-foreground ring-primary/15',
  success: 'bg-success/10 text-success ring-success/20',
  warning: 'bg-warning/15 text-warning-foreground ring-warning/30',
  danger: 'bg-destructive/8 text-destructive ring-destructive/20',
  muted: 'bg-muted text-muted-foreground ring-foreground/8',
}

const dotCls: Record<Tone, string> = {
  neutral: 'bg-secondary-foreground/50',
  info: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  muted: 'bg-muted-foreground/50',
}

export function StatusBadge({ tone = 'neutral', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset',
        toneCls[tone],
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', dotCls[tone])} />
      {children}
    </span>
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
