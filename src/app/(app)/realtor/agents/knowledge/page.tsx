import { KnowledgeAgentView } from "@/components/realtor/agents/knowledge-agent-view";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function RealtorKnowledgePage() {
  await requireRealtorOnboardingComplete();

  return (
    <div className="px-2 py-4 lg:px-4">
      <KnowledgeAgentView />
    </div>
  );
}
