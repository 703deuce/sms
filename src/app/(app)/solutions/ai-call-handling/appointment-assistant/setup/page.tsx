import { AppointmentReceptionistWizard } from "@/components/solutions/appointment-receptionist/wizard";
import { Suspense } from "react";

export default function AppointmentReceptionistSetupPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading setup…</div>}>
      <AppointmentReceptionistWizard />
    </Suspense>
  );
}
