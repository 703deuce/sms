import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { RealtorAgentDetailClient } from "@/components/realtor/realtor-agent-detail-client";
import { loadRealtorProductConfig } from "@/lib/realtor/workspace-config";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";
import { compileRealtorAgents } from "@/lib/voice/real-estate/compile";

export default async function FrontDeskAgentPage() {
  const { workspaceId } = await requireRealtorOnboardingComplete();
  const config = await loadRealtorProductConfig(workspaceId);
  const compiled = compileRealtorAgents(config);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Front Desk"
        description="Structured template configuration — real_estate_front_desk"
      />
      <RealtorAgentDetailClient
        config={config}
        agentLabel="Front Desk"
        templateKey="real_estate_front_desk"
        deployedAgentId={config.deployedAgentId}
        publishedVersionId={config.frontDeskPublishedVersionId}
        workflowDefinition={compiled.frontDesk?.workflowDefinition}
        intents={compiled.frontDesk?.intents}
      />
      <Card className="p-4">
        <CardTitle className="mb-3">Caller routes</CardTitle>
        <ul className="space-y-2 text-sm">
          {Object.entries(config.frontDesk).map(([key, val]) => (
            <li key={key} className="flex justify-between border-b py-2 last:border-0">
              <span className="capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
              <span>{val.enabled ? `On · ${val.qualifiedOutcome}` : "Off"}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
