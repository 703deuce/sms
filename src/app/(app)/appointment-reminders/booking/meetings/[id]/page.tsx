import { ArBookingMeetingsWorkspace } from '@/newui-transplant/connected/appointment-reminders/booking-meetings-routes-client'

export default async function AppointmentRemindersMeetingEditorRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ArBookingMeetingsWorkspace meetingId={id} />
}
