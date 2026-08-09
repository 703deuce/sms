import { detectCallerIntent, type CallerIntent } from "@/lib/voice/intent/detect";
import { domainDetectCallerIntent, type LiveKitCallContext } from "@/lib/voice/domain-actions";
import { applyWorkflowNodeTransition } from "./node-transitions";
import { reconcileCanonicalWorkflowState } from "./canonical-state";
import { compileToolsForCallContext } from "./compile-for-call";
import { resolveActiveWorkflowForAgent } from "./loader";

const MODIFY_INTENTS = new Set<CallerIntent>(["reschedule", "cancel", "emergency"]);

/**
 * When the caller clearly states reschedule/cancel/emergency but the model did not call
 * detect_caller_intent, apply authoritative intent routing from the utterance.
 */
export async function autoApplyCallerIntentFromUtterance(input: {
  ctx: LiveKitCallContext;
  userText: string;
  intentToolAlreadyCalled: boolean;
}): Promise<{ ctx: LiveKitCallContext; applied: boolean }> {
  if (input.intentToolAlreadyCalled) return { ctx: input.ctx, applied: false };

  const detected = detectCallerIntent({
    utterance: input.userText,
    collectedFields: input.ctx.session.collectedFields,
  });
  if (detected.confidence !== "high" || !MODIFY_INTENTS.has(detected.intent)) {
    return { ctx: input.ctx, applied: false };
  }

  const { canonical } = compileToolsForCallContext(input.ctx);
  const nodeId = canonical?.currentNodeId || input.ctx.session.currentNodeId;
  if (nodeId === "reschedule_lookup" || nodeId === "cancel_lookup" || nodeId === "emergency_handoff") {
    return { ctx: input.ctx, applied: false };
  }

  let ctx = input.ctx;
  ctx.session.lastUserUtterance = input.userText;
  const result = await domainDetectCallerIntent({ ctx, utterance: input.userText });
  const workflow =
    ctx.workflowDefinition ?? resolveActiveWorkflowForAgent(ctx.agentId).definition;
  await applyWorkflowNodeTransition({
    workflow,
    callId: ctx.callId,
    session: ctx.session,
    toolName: "detect_caller_intent",
    result,
  });
  const canonicalAfter = reconcileCanonicalWorkflowState({
    session: ctx.session,
    workflow,
    toolName: "detect_caller_intent",
    toolResult: result,
  });
  ctx.canonicalWorkflow = canonicalAfter;
  ctx.workflowState = canonicalAfter.legacyState;
  compileToolsForCallContext(ctx);
  return { ctx, applied: true };
}
