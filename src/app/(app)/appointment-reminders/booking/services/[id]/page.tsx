import { redirect } from 'next/navigation'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'

export default async function AppointmentRemindersBookingServicesDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`${AR_ROUTES.bookingMeetings}/${id}`)
}
