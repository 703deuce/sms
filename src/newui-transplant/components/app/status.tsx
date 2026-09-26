import { Pill, type Tone } from '@/newui-transplant/components/app/kit'
import type { CallOutcome, RecoveryStatus } from '@/newui-transplant/lib/sandbox-data'

const outcomeTone: Record<CallOutcome, Tone> = {
  Appointment: 'success',
  Lead: 'primary',
  Message: 'neutral',
  Transfer: 'primary',
  Voicemail: 'warning',
  'No Answer': 'danger',
}

export function OutcomePill({ outcome }: { outcome: CallOutcome }) {
  return <Pill tone={outcomeTone[outcome]}>{outcome}</Pill>
}

const recoveryTone: Record<RecoveryStatus, Tone> = {
  Replied: 'success',
  'Needs attention': 'warning',
  'Waiting for consent': 'neutral',
  Suppressed: 'neutral',
  Failed: 'danger',
  Sent: 'primary',
}

export function RecoveryPill({ status }: { status: RecoveryStatus }) {
  return <Pill tone={recoveryTone[status]}>{status}</Pill>
}
