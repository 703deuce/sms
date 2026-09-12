import { redirect } from "next/navigation";
import { AppointmentsListClient } from "@/components/appointments/list-client";
import {
  APPOINTMENTS_V1_HOME_PATH,
  shouldRedirectAppointmentsRootToOverview,
} from "@/lib/products/appointments-home-redirect";

export default async function AppointmentsListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
