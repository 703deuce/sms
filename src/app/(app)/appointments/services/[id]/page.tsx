import { AppointmentsServiceDetailGate } from '@/newui-transplant/connected/scheduling/appointments-booking-routes-client'

export default async function AppointmentsServiceEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <AppointmentsServiceDetailGate serviceId={id} />
}
