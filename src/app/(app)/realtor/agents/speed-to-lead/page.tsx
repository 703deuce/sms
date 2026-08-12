import { SpeedToLeadAgentView } from "@/components/realtor/agents/speed-to-lead-agent-view";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function SpeedToLeadAgentPage() {
  await requireRealtorOnboardingComplete();

  return (
    <div className="px-2 py-4 lg:px-4">
      <SpeedToLeadAgentView />
    </div>
  );
}
