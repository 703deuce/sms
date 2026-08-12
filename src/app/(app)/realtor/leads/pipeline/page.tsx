import { PipelineBoardView } from "@/components/realtor/leads/pipeline-board";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function RealtorPipelinePage() {
  await requireRealtorOnboardingComplete();

  return (
    <div className="px-2 py-4 lg:px-4">
      <PipelineBoardView />
    </div>
  );
}
