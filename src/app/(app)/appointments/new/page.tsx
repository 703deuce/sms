import { AppointmentFormClient } from "@/components/appointments/form-client";
import { Suspense } from "react";

export default function NewAppointmentPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
            Loading form…
          </div>
        }
      >
        <AppointmentFormClient />
      </Suspense>
    </div>
  );
}
