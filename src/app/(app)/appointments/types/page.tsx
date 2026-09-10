import { Suspense } from "react";
import { LegacyBookingTypesRedirect } from "@/components/appointments/legacy-booking-types-redirect";

export default function LegacyAppointmentTypesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center text-sm text-muted-foreground">
          Redirecting…
        </div>
      }
    >
      <LegacyBookingTypesRedirect />
    </Suspense>
  );
}
