'use client'

import { ArAppointmentDetailOpus } from '@/newui-transplant/connected/scheduling/ar-appointment-detail-opus'

export function AppointmentDetailOpusPage({ appointmentId }: { appointmentId: string }) {
  return <ArAppointmentDetailOpus appointmentId={appointmentId} />
}
