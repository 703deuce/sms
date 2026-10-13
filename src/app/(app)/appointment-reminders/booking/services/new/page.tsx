import { CreateServiceWizard } from '@/components/appointments/services/create-service-wizard'
import { AR_BOOKING_SERVICES_ROUTES } from '@/lib/appointments/bookable-workspace-routes'

export default function AppointmentRemindersBookingServiceCreateRoute() {
  return <CreateServiceWizard routes={AR_BOOKING_SERVICES_ROUTES} />
}
