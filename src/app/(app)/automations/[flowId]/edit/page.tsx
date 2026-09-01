import { requireWorkspaceContext, loadAutomationById } from "@/lib/workspace-data";
import { parseAutomationDefinition } from "@/lib/automations/types";
import { notFound } from "next/navigation";
import KimiAutomationBuilder from "@/components/kimi/automations/KimiAutomationBuilder";

function shouldStartInSetup(
  flow: { name: string; definition: unknown; description?: string | null },
  setupParam?: string,
): boolean {
  if (setupParam === "1") return true;
  const def = parseAutomationDefinition(flow.definition);
  const isFreshDraft =
    def.nodes.length === 0 &&
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
    <div className="kimi-automations">
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
