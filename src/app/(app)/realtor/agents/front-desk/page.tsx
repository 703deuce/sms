import { PageHeader } from "@/components/ui/page-header";
import { FrontDeskConfigClient } from "@/components/realtor/front-desk-config-client";
import { loadRealtorProductConfig } from "@/lib/realtor/workspace-config";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";
import { compileRealtorAgents } from "@/lib/voice/real-estate/compile";
import { getPrisma } from "@/lib/db";

export default async function FrontDeskAgentPage() {
  const { workspaceId } = await requireRealtorOnboardingComplete();
  const config = await loadRealtorProductConfig(workspaceId);
  const compiled = compileRealtorAgents(config);
  const prisma = getPrisma();
  const phoneNumbers = await prisma.phoneNumber.findMany({
    where: { workspaceId },
    orderBy: { e164: "asc" },
    select: { id: true, e164: true, friendlyName: true, status: true },
  });

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Front Desk"
        description="Configure your inbound agent — business info, caller types, booking, voice, and deploy."
      />
      <FrontDeskConfigClient
        initialConfig={config}
        deployedAgentId={config.deployedAgentId}
        publishedVersionId={config.frontDeskPublishedVersionId}
        workflowDefinition={compiled.frontDesk?.workflowDefinition}
        intents={compiled.frontDesk?.intents}
        phoneNumbers={phoneNumbers}
      />
    </div>
  );
}
