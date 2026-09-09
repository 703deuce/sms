import { ServiceBookingAdminClient } from "@/components/appointments/service-booking-admin-client";

export default function AppointmentsRestrictionsPage() {
  return (
    <ServiceBookingAdminClient
      initialSection="restrictions"
      title="Client booking restrictions"
    />
  );
}
