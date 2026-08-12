import { AvailabilityView } from "@/components/realtor/appointments/availability-view";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function RealtorAvailabilityPage() {
  await requireRealtorOnboardingComplete();

  return (
    <div className="px-2 py-4 lg:px-4">
      <AvailabilityView />
    </div>
  );
}
