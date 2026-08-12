import { RecordingsView } from "@/components/realtor/calls/recordings-view";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function RealtorRecordingsPage() {
  await requireRealtorOnboardingComplete();

  return (
    <div className="px-2 py-4 lg:px-4">
      <RecordingsView />
    </div>
  );
}
