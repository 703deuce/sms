import { ServiceBookingAdminClient } from "@/components/appointments/service-booking-admin-client";

export default function AppointmentPackagesPage() {
  return (
    <ServiceBookingAdminClient initialSection="packages" title="Packages" />
  );
}
