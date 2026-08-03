import { AppointmentReceptionistWizard } from "@/components/solutions/appointment-receptionist/wizard";
import { notFound } from "next/navigation";

export default function DevAppointmentWizardPage() {
  // Preview / visual QA only — not linked from product nav.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_WIZARD_PREVIEW !== "1") {
    notFound();
  }
  return <AppointmentReceptionistWizard />;
}
