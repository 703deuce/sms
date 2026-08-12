import { TranscriptsView } from "@/components/realtor/calls/transcripts-view";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function RealtorTranscriptsPage() {
  await requireRealtorOnboardingComplete();

  return (
    <div className="px-2 py-4 lg:px-4">
      <TranscriptsView />
    </div>
  );
}
