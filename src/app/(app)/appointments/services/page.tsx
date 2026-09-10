import { Suspense } from "react";
import { ServicesClient } from "@/components/appointments/services-client";

export default function AppointmentsServicesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading services…</div>}>
      <ServicesClient />
    </Suspense>
  );
}
