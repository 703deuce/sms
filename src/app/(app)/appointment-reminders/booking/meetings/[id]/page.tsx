import { MeetingsWorkspaceConnected } from '@/components/appointments/meetings/meetings-workspace-connected'
import { AR_BOOKING_MEETINGS_ROUTES } from '@/lib/appointments/bookable-workspace-routes'

export default async function AppointmentRemindersMeetingEditorRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <MeetingsWorkspaceConnected meetingId={id} routes={AR_BOOKING_MEETINGS_ROUTES} />
}
