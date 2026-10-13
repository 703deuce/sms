import { ArBookingServicesWorkspace } from '@/newui-transplant/connected/appointment-reminders/booking-services-routes-client'

export default async function AppointmentRemindersBookingServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ArBookingServicesWorkspace serviceId={id} />
}
