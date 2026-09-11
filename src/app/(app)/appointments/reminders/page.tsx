import { Suspense } from "react";
import { AppointmentRemindersClient } from "@/components/appointments/reminders-client";

export default function AppointmentRemindersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading reminders…</div>}>
      <AppointmentRemindersClient />
    </Suspense>
  );
}
