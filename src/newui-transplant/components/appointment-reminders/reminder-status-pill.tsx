import { Pill, type Tone } from '@/newui-transplant/components/app/kit'
import type { AggregateReminderStatus } from '@/lib/appointment-reminders/aggregate-reminder-status'

const toneMap: Record<AggregateReminderStatus, Tone> = {
  scheduled: 'neutral',
  sent: 'primary',
  delivered: 'success',
  needs_attention: 'warning',
  not_scheduled: 'neutral',
  cancelled: 'neutral',
  failed: 'danger',
}

export function ReminderStatusPill({ label, status }: { label: string; status: AggregateReminderStatus }) {
  return <Pill tone={toneMap[status]}>{label}</Pill>
}
