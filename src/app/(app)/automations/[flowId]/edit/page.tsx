import { requireWorkspaceContext, loadAutomationById } from "@/lib/workspace-data";
import { notFound } from "next/navigation";
import AutomationBuilder from "@/components/automations/builder/automation-builder";
import { DeploymentDiagnosticsPanel } from "@/components/automations/builder/deployment-diagnostics-panel";

export default async function AutomationEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ flowId: string }>;
  searchParams?: Promise<{ diagnostics?: string }>;
}) {
  const { flowId } = await params;
  const sp = (await searchParams) || {};
  const { workspaceId } = await requireWorkspaceContext();
  const flow = await loadAutomationById(workspaceId, flowId);
  if (!flow) notFound();

  const showDiagnostics =
    sp.diagnostics === "1" ||
    (flow as { ownershipKind?: string | null }).ownershipKind ===
      "agent_workflow" ||
    Boolean((flow as { ownerAgentId?: string | null }).ownerAgentId);

  return (
    <div className="space-y-4">
      {showDiagnostics ? <DeploymentDiagnosticsPanel flowId={flowId} /> : null}
      <AutomationBuilder
        flowId={flowId}
        initialName={flow.name}
        initialDescription=""
        initialDefinition={flow.definition}
        initialStatus={flow.status}
      />
    </div>
  );
}
