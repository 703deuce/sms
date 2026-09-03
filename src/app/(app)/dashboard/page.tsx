import { redirect } from "next/navigation";
import { appointmentsShellHome } from "@/lib/products/appointments-routes";
import { isAppointmentsV1Primary } from "@/lib/workspace/platform-launch";

/** Legacy /dashboard URL — Appointments V1 home or SMS dashboard. */
export default function DashboardPage() {
  if (isAppointmentsV1Primary()) redirect(appointmentsShellHome());
  redirect("/sms/dashboard");
}
