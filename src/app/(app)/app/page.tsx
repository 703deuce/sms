import { redirect } from "next/navigation";
import { appointmentsShellHome } from "@/lib/products/appointments-routes";
import { isAppointmentsV1Primary } from "@/lib/workspace/platform-launch";

/** Product launcher hidden — Appointments V1 is the primary app surface. */
export default function ProductLauncherPage() {
  if (isAppointmentsV1Primary()) redirect(appointmentsShellHome());
  redirect("/dashboard");
}
