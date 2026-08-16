import type { AgentSession } from "@livekit/agents";
import type { FrontDeskUserData } from "../userdata";
import { ensureReceptionistWorkflow } from "./workflow-engine";
import { isToolAllowedInWorkflow } from "./workflow-tool-surface";
import { workflowToolBlockedResult, prepareWorkflowForTool } from "./workflow-orchestrator";

type ToolLike = {
  name?: string;
  execute?: (args: unknown, opts: unknown) => Promise<string> | string;
};

export function wrapReceptionistToolWithWorkflowGuard(
  tool: ToolLike,
  options?: { prepareWorkflow?: boolean },
): ToolLike {
  const name = String(tool.name || "");
  const originalExecute = tool.execute;
  if (!name || !originalExecute) return tool;

  tool.execute = async (args: unknown, opts: unknown) => {
    const session = (opts as { ctx: { session: AgentSession<FrontDeskUserData> } }).ctx.session;
    const ud = session.userData;
    const wf = ensureReceptionistWorkflow(ud);
    if (!isToolAllowedInWorkflow(ud, wf, name)) {
      return workflowToolBlockedResult(ud, name);
    }
    if (options?.prepareWorkflow) {
      await prepareWorkflowForTool(session, name);
    }
    return await originalExecute(args, opts);
  };

  return tool;
}

export function wrapReceptionistToolDefs(
  toolDefs: unknown[],
  options?: { prepareWorkflow?: boolean },
): unknown[] {
  return toolDefs.map((tool) => {
    if (!tool || typeof tool !== "object") return tool;
    return wrapReceptionistToolWithWorkflowGuard(tool as ToolLike, options);
  });
}
