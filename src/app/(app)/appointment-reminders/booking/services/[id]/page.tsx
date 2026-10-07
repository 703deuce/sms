import { ServicesWorkspaceConnected } from '@/components/appointments/services/services-workspace-connected'
import { AR_BOOKING_SERVICES_ROUTES } from '@/lib/appointments/bookable-workspace-routes'

export default async function AppointmentRemindersServiceEditorRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ServicesWorkspaceConnected serviceId={id} routes={AR_BOOKING_SERVICES_ROUTES} />
}
