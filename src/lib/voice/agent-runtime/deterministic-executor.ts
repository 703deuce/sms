import {
  domainCheckAvailability,
  domainClassifyIntent,
  domainFindAppointments,
  domainValidateEligibility,
  type DomainActionResult,
  type LiveKitCallContext,
} from "@/lib/voice/domain-actions";
import { applyWorkflowNodeTransition } from "@/lib/voice/workflow-runtime/node-transitions";
import {
  reconcileCanonicalWorkflowState,
  type CanonicalNextAction,
} from "@/lib/voice/workflow-runtime/canonical-state";
import { compileToolsForCallContext } from "@/lib/voice/workflow-runtime/compile-for-call";
import { hasAvailableSlots } from "@/lib/voice/workflow-runtime/completion-guards";
import { resolveActiveWorkflowForAgent } from "@/lib/voice/workflow-runtime/loader";
import {
  isDeterministicNextAction,
  toolNameForDeterministicAction,
} from "./deterministic-actions";

export type DeterministicExecutionStep = {
  toolName: string;
  ok: boolean;
  speak: string;
  expectedNextAction: CanonicalNextAction;
};

export type DeterministicExecutorResult = {
  ctx: LiveKitCallContext;
  steps: DeterministicExecutionStep[];
  /** Last successful step result surfaced to the conversational layer. */
  lastResult?: DomainActionResult;
  lastToolName?: string;
};

const MAX_DETERMINISTIC_STEPS = 8;

async function applyDomainResult(input: {
  ctx: LiveKitCallContext;
  toolName: string;
  result: DomainActionResult;
}): Promise<LiveKitCallContext> {
  const workflow =
    input.ctx.workflowDefinition ?? resolveActiveWorkflowForAgent(input.ctx.agentId).definition;
  await applyWorkflowNodeTransition({
    workflow,
    callId: input.ctx.callId,
    session: input.ctx.session,
    toolName: input.toolName,
    result: input.result,
  });
  const canonical = reconcileCanonicalWorkflowState({
    session: input.ctx.session,
    workflow,
    toolName: input.toolName,
    toolResult: input.result,
  });
  input.ctx.canonicalWorkflow = canonical;
  input.ctx.workflowState = canonical.legacyState;
  compileToolsForCallContext(input.ctx);
  return input.ctx;
}

async function runDeterministicAction(input: {
  ctx: LiveKitCallContext;
  action: CanonicalNextAction;
  preferenceSpoken?: string;
}): Promise<{ ctx: LiveKitCallContext; result: DomainActionResult; toolName: string } | null> {
  const toolName = toolNameForDeterministicAction(input.action);
  if (!toolName) return null;

  let result: DomainActionResult;

  switch (input.action) {
    case "validate_eligibility":
      result = await domainValidateEligibility({ ctx: input.ctx });
      break;
    case "classify":
      result = await domainClassifyIntent({
        ctx: input.ctx,
        utterance: input.ctx.session.lastUserUtterance || "",
      });
      break;
    case "check_availability":
      if (hasAvailableSlots(input.ctx.session)) {
        return null;
      }
      result = await domainCheckAvailability({
        ctx: input.ctx,
        spoken: input.preferenceSpoken?.trim() || "next available",
      });
      break;
    case "find_appointments":
      result = await domainFindAppointments({
        ctx: input.ctx,
        phone: input.ctx.session.callerAni || undefined,
      });
      break;
    default:
      return null;
  }

  const ctx = await applyDomainResult({
    ctx: input.ctx,
    toolName,
    result,
  });

  return { ctx, result, toolName };
}

/**
 * Execute authoritative workflow steps that require no additional caller/LLM judgment.
 * Runs after every state mutation until a conversational boundary is reached.
 */
export async function executeDeterministicPipeline(input: {
  ctx: LiveKitCallContext;
  preferenceSpoken?: string;
}): Promise<DeterministicExecutorResult> {
  const steps: DeterministicExecutionStep[] = [];
  let ctx = input.ctx;
  let lastResult: DomainActionResult | undefined;
  let lastToolName: string | undefined;

  for (let i = 0; i < MAX_DETERMINISTIC_STEPS; i++) {
    const { canonical } = compileToolsForCallContext(ctx);
    const action = canonical?.expectedNextAction;
    if (!action || !isDeterministicNextAction(action)) break;

    const executed = await runDeterministicAction({
      ctx,
      action,
      preferenceSpoken: input.preferenceSpoken,
    });
    if (!executed) break;

    ctx = executed.ctx;
    lastResult = executed.result;
    lastToolName = executed.toolName;
    steps.push({
      toolName: executed.toolName,
      ok: executed.result.ok,
      speak: executed.result.speak,
      expectedNextAction: action,
    });

    if (!executed.result.ok) break;
  }

  if (steps.length > 0) {
    console.log(
      JSON.stringify({
        source: "transovo-voice-runtime",
        event: "deterministic_pipeline_executed",
        callId: ctx.callId,
        steps: steps.map((s) => ({
          tool: s.toolName,
          ok: s.ok,
          action: s.expectedNextAction,
        })),
      }),
    );
  }

  return { ctx, steps, lastResult, lastToolName };
}
