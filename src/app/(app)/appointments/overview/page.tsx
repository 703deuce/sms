import { redirect } from "next/navigation";
import { mctbShellHome } from "@/lib/products/product-shell";
import { isMctbV1Primary } from "@/lib/workspace/platform-launch";
import { AppointmentsOverviewClient } from "@/components/appointments/overview-client";

export default function AppointmentsOverviewPage() {
  if (isMctbV1Primary()) redirect(mctbShellHome());
  return <AppointmentsOverviewClient />;
}
