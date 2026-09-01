import { requireWorkspaceContext, loadAutomationById } from "@/lib/workspace-data";
import { parseAutomationDefinition } from "@/lib/automations/types";
import { notFound } from "next/navigation";
import KimiAutomationBuilder from "@/components/kimi/automations/KimiAutomationBuilder";

function shouldStartInSetup(
  flow: { name: string; definition: unknown; description?: string | null },
  setupParam?: string,
): boolean {
  const def = parseAutomationDefinition(flow.definition);
  if (def.nodes.length > 0) return false;
  if (setupParam === "1") return true;
  const isFreshDraft =
    (!flow.description || !String(flow.description).trim()) &&
    /^New automation ·/.test(flow.name);
  return isFreshDraft;
}

export default async function AutomationEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ flowId: string }>;
  searchParams?: Promise<{ setup?: string; diagnostics?: string }>;
}) {
  const { flowId } = await params;
  const sp = (await searchParams) || {};
  const { workspaceId } = await requireWorkspaceContext();
  const flow = await loadAutomationById(workspaceId, flowId);
  if (!flow) notFound();

  return (
    <div className="kimi-surface kimi-automations kimi-automation-builder fixed inset-y-0 right-0 z-10 flex flex-col overflow-hidden bg-background">
      <KimiAutomationBuilder
        flowId={flowId}
        initialName={flow.name}
        initialDescription={flow.description || ""}
        initialDefinition={flow.definition}
        initialStatus={flow.status}
        startInSetup={shouldStartInSetup(flow, sp.setup)}
      />
    </div>
  );
}
