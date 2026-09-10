import { ServiceBookingAdminClient } from "@/components/appointments/service-booking-admin-client";

export default function AppointmentMembershipsPage() {
  return (
    <ServiceBookingAdminClient initialSection="memberships" title="Memberships" />
  );
}
