import { TestAgentView } from "@/components/realtor/agents/test-agent-view";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function RealtorTestPage() {
  await requireRealtorOnboardingComplete();

  return (
    <div className="px-2 py-4 lg:px-4">
      <TestAgentView />
    </div>
  );
}
