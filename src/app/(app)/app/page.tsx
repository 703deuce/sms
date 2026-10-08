import { redirect } from "next/navigation";
import { appointmentsShellHome } from "@/lib/products/appointments-routes";
import {
  appointmentRemindersProductShellHome,
  mctbShellHome,
} from "@/lib/products/product-shell";
import {
  isAppointmentRemindersV1Primary,
  isAppointmentsV1Primary,
  isMctbV1Primary,
} from "@/lib/workspace/platform-launch";

/** Product launcher hidden — primary launch surface. */
export default function ProductLauncherPage() {
  if (isAppointmentRemindersV1Primary()) redirect(appointmentRemindersProductShellHome());
  if (isMctbV1Primary()) redirect(mctbShellHome());
  if (isAppointmentsV1Primary()) redirect(appointmentsShellHome());
  redirect("/dashboard");
}
