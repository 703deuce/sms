import { Suspense } from "react";
import { KimiAutomationsConnected } from "@/components/automations/kimi-automations-connected";
import { apiAutomationToKimi } from "@/lib/automations/kimi-automations-adapter";
import { loadAutomations, requireWorkspaceContext } from "@/lib/workspace-data";

export default async function AutomationsPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const flows = await loadAutomations(workspaceId);

  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading automations…</p>}>
      <div className="kimi-surface kimi-automations">
        <KimiAutomationsConnected initialWorkflows={flows.map(apiAutomationToKimi)} />
      </div>
    </Suspense>
  );
}
