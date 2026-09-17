import "server-only";

import type { LiveControlPlane } from "./live-control-plane";
import {
  dispatchLiveVoiceTool,
  type LiveToolDispatchContext,
} from "./live-tool-runtime";
import {
  getRegistryEntry,
  validateBookArgsAgainstOfferSet,
} from "@/lib/voice-v2/live-tool-registry";
import { VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";
import { buildLiveControlPlaneSyncEvents } from "./live-backend-state-sync";

const inflightByCall = new Map<string, string>();

function logAutoDispatch(fields: Record<string, unknown>) {
  console.info(`LIVE_AUTO_DISPATCH ${JSON.stringify(fields)}`);
}

export async function tryAutoDispatchRequiredAction(input: {
  controlPlane: LiveControlPlane;
  dispatchContext: LiveToolDispatchContext;
  sendLiveOut?: (event: Record<string, unknown>) => void;
}): Promise<{ dispatched: boolean; toolName?: string; output?: string }> {
  const callId = input.controlPlane.callId;
  if (inflightByCall.get(callId)) {
    return { dispatched: false };
  }

  await input.controlPlane.ensureHydrated();
  const env = input.controlPlane.getWorkflowEnvelope();
  const required = String(env.required_action || "").trim();
  if (!required) return { dispatched: false };

  const contract = getRegistryEntry(required);
  if (!contract?.autoDispatchEligible) return { dispatched: false };

  const ctx = input.controlPlane.getCallContext();
  if (!ctx) return { dispatched: false };

  const stage = input.controlPlane.getStage();
  if (!contract.canRun(ctx, stage)) {
    logAutoDispatch({
      call_id: callId,
      tool: required,
      skipped: true,
      reason: "preconditions",
      missing: contract.missingRequirements(ctx, stage),
    });
    return { dispatched: false };
  }

  if (required === VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE) {
    const ok = await validateBookArgsAgainstOfferSet(ctx.workspaceId, ctx);
    if (!ok) return { dispatched: false };
  }

  const args = contract.buildArgs(ctx);
  inflightByCall.set(callId, required);
  logAutoDispatch({ call_id: callId, tool: required, stage, args_keys: Object.keys(args) });

  try {
    const result = await dispatchLiveVoiceTool({
      toolName: required,
      args,
      openAiFunctionCallId: `auto_${required}_${Date.now()}`,
      callContext: input.dispatchContext,
    });
    input.controlPlane.invalidateContextCache();
    await input.controlPlane.ensureHydrated();
    input.controlPlane.logStageTransitionIfChanged();
    if (input.sendLiveOut) {
      for (const event of buildLiveControlPlaneSyncEvents(input.controlPlane)) {
        input.sendLiveOut(event);
      }
    }
    return { dispatched: true, toolName: required, output: result.output };
  } finally {
    inflightByCall.delete(callId);
  }
}
