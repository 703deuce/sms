import { AppointmentFormClient } from "@/components/appointments/form-client";
import { Suspense } from "react";

/**
 * MCTB light-booking new appointment — reuses canonical AppointmentsNewConnected backend.
 */
export default function MctbNewAppointmentPage() {
  return (
    <div className="mctb-booking-shell mx-auto w-full max-w-3xl px-4 py-6 lg:px-8">
      <header className="mctb-booking-page-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <div>
          <h1 className="mctb-booking-page-title">New appointment</h1>
          <p className="mctb-booking-page-subtitle">Book a customer using your real availability.</p>
        </div>
      </header>
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading form…</div>}>
        <AppointmentFormClient />
      </Suspense>
    </div>
  );
}
