import { AppointmentsListView } from "@/components/realtor/appointments/appointments-list-view";
import type { AppointmentsTab } from "@/lib/realtor/appointments-crm-mock";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

const TAB_ALIASES: Record<string, AppointmentsTab> = {
  all: "all",
  upcoming: "upcoming",
  today: "today",
  completed: "completed",
  canceled: "canceled",
  "no-show": "no-show",
};

export default async function RealtorAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRealtorOnboardingComplete();
  const params = await searchParams;
  const initialTab = TAB_ALIASES[params.tab || "all"] || "all";

  return (
    <div className="px-2 py-4 lg:px-4">
      <AppointmentsListView initialTab={initialTab} />
    </div>
  );
}
