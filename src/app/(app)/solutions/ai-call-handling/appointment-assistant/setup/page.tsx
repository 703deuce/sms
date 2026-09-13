import { AppointmentReceptionistWizard } from "@/components/solutions/appointment-receptionist/wizard";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { isMctbV1Primary } from "@/lib/workspace/platform-launch";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default function AppointmentReceptionistSetupPage() {
  if (isMctbV1Primary()) {
    redirect(MCTB_ROUTES.voiceAgent);
  }
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading setup…</div>}>
      <AppointmentReceptionistWizard />
    </Suspense>
  );
}
