import { requireWorkspaceContext, loadAutomationById } from "@/lib/workspace-data";
import { notFound } from "next/navigation";
import AutomationBuilder from "@/components/automations/builder/automation-builder";

export default async function AutomationEditPage({
  params,
}: {
  params: Promise<{ flowId: string }>;
}) {
  const { flowId } = await params;
  const { workspaceId } = await requireWorkspaceContext();
  const flow = await loadAutomationById(workspaceId, flowId);
  if (!flow) notFound();

  return (
    <div className="space-y-4">
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
