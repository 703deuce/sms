import { Suspense } from "react";
import { MctbAppointmentsClient } from "@/components/mctb/booking/mctb-appointments-client";

export default function MctbAppointmentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading appointments…</div>}>
      <div className="mctb-booking-shell min-h-full">
        <MctbAppointmentsClient />
      </div>
    </Suspense>
  );
}
