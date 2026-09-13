import { redirect } from "next/navigation";
import { AppointmentsListClient } from "@/components/appointments/list-client";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import {
  APPOINTMENTS_V1_HOME_PATH,
  shouldRedirectAppointmentsRootToOverview,
} from "@/lib/products/appointments-home-redirect";
import { isMctbV1Primary } from "@/lib/workspace/platform-launch";

export default async function AppointmentsListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (isMctbV1Primary()) {
    redirect(MCTB_ROUTES.appointments);
  }
  const params = await searchParams;
  if (shouldRedirectAppointmentsRootToOverview(params)) {
    redirect(APPOINTMENTS_V1_HOME_PATH);
  }

  return (
    <div className="min-h-full bg-[var(--surface-muted)]">
      <AppointmentsListClient />
    </div>
  );
}
