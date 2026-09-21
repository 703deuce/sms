import { redirect } from "next/navigation";
import { AppointmentsListClient } from "@/components/appointments/list-client";
import { mctbShellHome } from "@/lib/products/product-shell";
import { shouldRedirectAppointmentsRootToOverview } from "@/lib/products/appointments-home-redirect";
import { isMctbV1Primary } from "@/lib/workspace/platform-launch";

export default async function AppointmentsListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (isMctbV1Primary()) {
    redirect(mctbShellHome());
  }
  const params = await searchParams;
  if (shouldRedirectAppointmentsRootToOverview(params)) {
    redirect("/appointments/overview");
  }

  return (
    <div className="min-h-full bg-[var(--surface-muted)]">
      <AppointmentsListClient />
    </div>
  );
}
