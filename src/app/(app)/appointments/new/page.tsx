import { AppointmentFormClient } from "@/components/appointments/form-client";
import { Suspense } from "react";

export default function NewAppointmentPage() {
  return (
    <div className="p-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading form…</p>}>
        <AppointmentFormClient />
      </Suspense>
    </div>
  );
}
