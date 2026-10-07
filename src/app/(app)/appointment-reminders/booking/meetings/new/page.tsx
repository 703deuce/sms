import { CreateMeetingWizard } from '@/components/appointments/meetings/create-meeting-wizard'
import { AR_BOOKING_MEETINGS_ROUTES } from '@/lib/appointments/bookable-workspace-routes'

export default function AppointmentRemindersCreateMeetingRoute() {
  return <CreateMeetingWizard routes={AR_BOOKING_MEETINGS_ROUTES} />
}
