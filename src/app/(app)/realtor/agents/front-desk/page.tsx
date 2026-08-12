import { FrontDeskAgentView } from "@/components/realtor/agents/front-desk-agent-view";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function FrontDeskAgentPage() {
  await requireRealtorOnboardingComplete();

  return (
    <div className="px-2 py-4 lg:px-4">
      <FrontDeskAgentView />
    </div>
  );
}
