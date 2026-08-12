import { VoicemailsView } from "@/components/realtor/calls/voicemails-view";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function RealtorVoicemailsPage() {
  await requireRealtorOnboardingComplete();

  return (
    <div className="px-2 py-4 lg:px-4">
      <VoicemailsView />
    </div>
  );
}
