import { Pill, type Tone } from '@/newui-transplant/components/app/kit'
import type { ArCustomerResponseKind } from '@/lib/appointment-reminders/ar-sms-customer-outcome'

const toneMap: Record<ArCustomerResponseKind, Tone> = {
  none: 'neutral',
  awaiting_reply: 'neutral',
  confirmed: 'success',
  cancel_pending: 'warning',
  cancelled: 'neutral',
  reschedule_pending: 'primary',
  reschedule_requested: 'warning',
  rescheduled: 'success',
  replied: 'primary',
}

export function CustomerResponsePill({
  label,
  kind,
}: {
  label: string
  kind: ArCustomerResponseKind
}) {
  return <Pill tone={toneMap[kind]} dot={kind !== 'none'}>{label}</Pill>
}
