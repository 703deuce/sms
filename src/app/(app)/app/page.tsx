import { redirect } from "next/navigation";
import { appointmentsShellHome } from "@/lib/products/appointments-routes";
import { mctbShellHome } from "@/lib/products/product-shell";
import { isAppointmentsV1Primary, isMctbV1Primary } from "@/lib/workspace/platform-launch";

/** Product launcher hidden — primary launch surface. */
export default function ProductLauncherPage() {
  if (isMctbV1Primary()) redirect(mctbShellHome());
  if (isAppointmentsV1Primary()) redirect(appointmentsShellHome());
  redirect("/dashboard");
}
