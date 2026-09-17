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
import { VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";
import { buildLiveControlPlaneSyncEvents } from "./live-backend-state-sync";
import { persistCallContext } from "@/lib/voice-v2/dialog-manager";
import {
  buildRequiredActionDispatchKey,
  mergeRuntimeDispatchIntoContext,
  shouldSkipAutoDispatch,
} from "@/lib/voice-v2/runtime-dispatch-state";
import { createLiveToolWaitProgressController } from "./live-tool-wait-commentary";

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

  let ctx = input.controlPlane.getCallContext();
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

  const skip = shouldSkipAutoDispatch({
    ctx,
    requiredAction: required,
    stage,
    schedulingGeneration: input.dispatchContext.schedulingGeneration,
  });
  if (skip.skip) {
    logAutoDispatch({ call_id: callId, tool: required, skipped: true, reason: skip.reason });
    return { dispatched: false };
  }

  if (required === VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE) {
    const ok = await validateBookArgsAgainstOfferSet(ctx.workspaceId, ctx);
    if (!ok) return { dispatched: false };
  }

  const dispatchKey = buildRequiredActionDispatchKey({
    ctx,
    requiredAction: required,
    stage,
    schedulingGeneration: input.dispatchContext.schedulingGeneration,
  });

  const args = {
    ...contract.buildArgs(ctx),
    auto_dispatch: true,
    required_action_dispatch_key: dispatchKey,
  };

  ctx = mergeRuntimeDispatchIntoContext(ctx, { inFlightRequiredAction: required });
  persistCallContext(ctx);

  inflightByCall.set(callId, required);
  logAutoDispatch({ call_id: callId, tool: required, stage, dispatch_key: dispatchKey });

  const waitProgress =
    input.sendLiveOut &&
    createLiveToolWaitProgressController({
      callId,
      liveSessionId: input.controlPlane.getLiveSessionId(),
      delegationId: null,
      toolCallId: `auto_${required}`,
      toolName: required,
      sendLiveOut: input.sendLiveOut,
    });
  waitProgress?.start();

  try {
    const result = await dispatchLiveVoiceTool({
      toolName: required,
      args,
      openAiFunctionCallId: `auto_${required}_${dispatchKey.replace(/\|/g, "_")}`,
      callContext: input.dispatchContext,
    });
    waitProgress?.complete();

    input.controlPlane.invalidateContextCache();
    await input.controlPlane.ensureHydrated();
    let after = input.controlPlane.getCallContext();
    if (after) {
      let success = true;
      try {
        const parsed = JSON.parse(result.output) as Record<string, unknown>;
        const status = String(parsed.voice_v2_status || parsed.status || "");
        if (status === "ERROR" || parsed.ok === false) success = false;
      } catch {
        success = false;
      }
      after = mergeRuntimeDispatchIntoContext(after, {
        inFlightRequiredAction: null,
        ...(success
          ? {
              lastCompletedDispatchKey: dispatchKey,
              lastCompletedAt: new Date().toISOString(),
            }
          : {}),
      });
      persistCallContext(after);
    }

    input.controlPlane.logStageTransitionIfChanged();
    if (input.sendLiveOut) {
      for (const event of buildLiveControlPlaneSyncEvents(input.controlPlane)) {
        input.sendLiveOut(event);
      }
    }
    return { dispatched: true, toolName: required, output: result.output };
  } catch (err) {
    waitProgress?.complete();
    const after = input.controlPlane.getCallContext();
    if (after) {
      persistCallContext(
        mergeRuntimeDispatchIntoContext(after, { inFlightRequiredAction: null }),
      );
    }
    logAutoDispatch({
      call_id: callId,
      tool: required,
      error: err instanceof Error ? err.message : String(err),
    });
    return { dispatched: false };
  } finally {
    inflightByCall.delete(callId);
  }
}
