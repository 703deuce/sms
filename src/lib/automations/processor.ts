import { processActiveAutomations, processAutomationWaits } from "./runner";

/** Legacy tick — now processes waiting executions. */
export async function processAutomationTick(flowId: string, workspaceId: string) {
  await processAutomationWaits();
  return { ok: true, flowId, workspaceId };
}

export { processActiveAutomations };
