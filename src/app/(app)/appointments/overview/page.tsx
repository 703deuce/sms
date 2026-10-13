import { redirect } from "next/navigation";
import { appointmentRemindersShellHome } from "@/lib/appointment-reminders/routes";
import { mctbShellHome } from "@/lib/products/product-shell";
import { isUnifiedAppointmentsExperience } from "@/lib/products/unified-appointments";
import { isMctbV1Primary } from "@/lib/workspace/platform-launch";
import { AppointmentsOverviewClient } from "@/components/appointments/overview-client";

export default function AppointmentsOverviewPage() {
  if (isMctbV1Primary()) redirect(mctbShellHome());
  if (isUnifiedAppointmentsExperience()) redirect(appointmentRemindersShellHome());
  return <AppointmentsOverviewClient />;
}
