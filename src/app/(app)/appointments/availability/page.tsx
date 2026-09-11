import { Suspense } from "react";
import { AppointmentAvailabilityClient } from "@/components/appointments/availability-client";

export default function AppointmentAvailabilityPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] bg-[var(--surface-muted)]" aria-busy="true" />}>
      <AppointmentAvailabilityClient />
    </Suspense>
  );
}
