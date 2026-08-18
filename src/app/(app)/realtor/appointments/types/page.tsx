import { AppointmentTypesView } from "@/components/realtor/appointments/appointment-types-view";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function RealtorAppointmentTypesPage() {
  await requireRealtorOnboardingComplete();

  return (
    <div className="px-2 py-4 lg:px-4">
      <AppointmentTypesView />
    </div>
  );
}
