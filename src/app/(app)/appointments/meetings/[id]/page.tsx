import { AppointmentsMeetingDetailGate } from '@/newui-transplant/connected/scheduling/appointments-booking-routes-client'

export default async function AppointmentsMeetingEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <AppointmentsMeetingDetailGate meetingId={id} />
}
