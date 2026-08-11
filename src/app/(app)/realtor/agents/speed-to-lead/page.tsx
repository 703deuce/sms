import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { RealtorAgentDetailClient } from "@/components/realtor/realtor-agent-detail-client";
import { loadRealtorProductConfig } from "@/lib/realtor/workspace-config";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";
import { compileRealtorAgents } from "@/lib/voice/real-estate/compile";

export default async function SpeedToLeadAgentPage() {
  const { workspaceId } = await requireRealtorOnboardingComplete();
  const config = await loadRealtorProductConfig(workspaceId);
  const compiled = compileRealtorAgents(config);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Speed-to-Lead"
        description="Outbound qualification — real_estate_speed_to_lead"
      />
      <RealtorAgentDetailClient
        config={config}
        agentLabel="Speed-to-Lead"
        templateKey="real_estate_speed_to_lead"
        deployedAgentId={config.deployedOutboundAgentId}
        publishedVersionId={config.outboundPublishedVersionId}
        workflowDefinition={compiled.speedToLead?.workflowDefinition}
        qualificationFields={compiled.speedToLead?.qualification.fields}
      />
      <Card className="p-4">
        <CardTitle className="mb-2">Lead sources</CardTitle>
        <p className="text-sm">{config.leadSources.join(", ") || "None connected yet"}</p>
      </Card>
    </div>
  );
}
