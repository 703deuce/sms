import { redirect } from 'next/navigation'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'

export default function AppointmentRemindersBookingServicesNewRedirect() {
  redirect(`${AR_ROUTES.bookingMeetings}/new`)
}
