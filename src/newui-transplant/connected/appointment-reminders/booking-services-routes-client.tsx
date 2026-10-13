'use client'

import { AR_BOOKING_SERVICES_ROUTES } from '@/lib/appointments/bookable-workspace-routes'
import { ArServicesWorkspaceOpus } from '@/newui-transplant/connected/appointment-reminders/ar-services-workspace-opus'

export function ArBookingServicesWorkspace({ serviceId }: { serviceId: string | null }) {
  return <ArServicesWorkspaceOpus serviceId={serviceId} routes={AR_BOOKING_SERVICES_ROUTES} />
}
