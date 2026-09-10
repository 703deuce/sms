import { AppointmentsMigrationBanner } from "@/components/appointments/migration-banner";
import { ServiceBookingAdminClient } from "@/components/appointments/service-booking-admin-client";

export default function ServiceBookingReportsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <AppointmentsMigrationBanner
        message="Service booking reports are now under Analytics → Reports."
        canonicalHref="/appointments/analytics/reports"
        canonicalLabel="Open reports"
      />
      <ServiceBookingAdminClient initialSection="reports" title="Service booking reports" />
    </div>
  );
}
