import { redirect } from "next/navigation";
import { appointmentsShellHome } from "@/lib/products/appointments-routes";
import { mctbShellHome } from "@/lib/products/product-shell";
import { isAppointmentsV1Primary, isMctbV1Primary } from "@/lib/workspace/platform-launch";

/** Legacy /dashboard URL — MCTB, Appointments V1 home, or SMS dashboard. */
export default function DashboardPage() {
  if (isMctbV1Primary()) redirect(mctbShellHome());
  if (isAppointmentsV1Primary()) redirect(appointmentsShellHome());
  redirect("/sms/dashboard");
}
