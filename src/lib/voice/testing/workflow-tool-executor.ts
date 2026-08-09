import {
  domainCancelAppointment,
  domainCheckAvailability,
  domainClassifyIntent,
  domainConfirmBooking,
  domainDetectCallerIntent,
  domainEndCall,
  domainFindAppointments,
  domainGetBusinessAnswer,
  domainLookupCustomer,
  domainRecordField,
  domainRecordFields,
  domainRequestHuman,
  domainRescheduleAppointment,
  domainSelectSlot,
  domainSubmitCallerInformation,
  domainTakeMessage,
  domainValidateEligibility,
  formatModelToolResult,
  type DomainActionResult,
  type LiveKitCallContext,
} from "@/lib/voice/domain-actions";
import { applyWorkflowNodeTransition } from "@/lib/voice/workflow-runtime/node-transitions";
import { reconcileCanonicalWorkflowState } from "@/lib/voice/workflow-runtime/canonical-state";
import { compileToolsForCallContext } from "@/lib/voice/workflow-runtime/compile-for-call";
import { resolveActiveWorkflowForAgent } from "@/lib/voice/workflow-runtime/loader";
import {
  fingerprintToolCall,
  hashToolResult,
  isNoProgressToolResult,
  recordToolCallHistory,
  shouldBlockRepeatedToolCall,
} from "@/lib/voice/workflow-runtime/loop-detection";
import type { WorkflowState } from "@/lib/voice/workflow-engine/types";

export type WorkflowToolExecution = {
  ctx: LiveKitCallContext;
  result: DomainActionResult;
  serialized: string;
  toolName: string;
  workflowStateBefore: WorkflowState;
  workflowStateAfter: WorkflowState;
  blocked?: boolean;
  blockReason?: string;
};

async function dispatchDomainAction(
  ctx: LiveKitCallContext,
  toolName: string,
  args: Record<string, unknown>,
): Promise<DomainActionResult> {
  switch (toolName) {
    case "submit_caller_information":
      return domainSubmitCallerInformation({
        ctx,
        extractedFields: (args.extracted_fields as Record<string, string>) || undefined,
        utterance: args.utterance ? String(args.utterance) : undefined,
        intent: args.intent ? String(args.intent) : undefined,
      });
    case "record_current_field":
      return domainRecordField({
        ctx,
        value: String(args.value || ""),
        fieldId: args.field_id ? String(args.field_id) : undefined,
      });
    case "record_fields":
      return domainRecordFields({
        ctx,
        fields: (args.fields as Record<string, string>) || {},
      });
    case "check_availability":
      return domainCheckAvailability({ ctx, spoken: String(args.spoken || "") });
    case "select_slot":
      return domainSelectSlot({
        ctx,
        utterance: String(args.selection || args.utterance || ""),
        slotIso: args.slot_iso ? String(args.slot_iso) : undefined,
      });
    case "confirm_booking":
      return domainConfirmBooking({ ctx, confirmed: Boolean(args.confirmed) });
    case "lookup_customer":
      return domainLookupCustomer({
        ctx,
        phone: args.phone ? String(args.phone) : undefined,
        email: args.email ? String(args.email) : undefined,
        name: args.name ? String(args.name) : undefined,
      });
    case "detect_caller_intent":
      return domainDetectCallerIntent({
        ctx,
        utterance: args.utterance ? String(args.utterance) : undefined,
      });
    case "validate_eligibility":
      return domainValidateEligibility({
        ctx,
        address: args.address ? String(args.address) : undefined,
      });
    case "classify_intent":
      return domainClassifyIntent({
        ctx,
        utterance: args.utterance ? String(args.utterance) : undefined,
      });
    case "get_business_answer":
      return domainGetBusinessAnswer({
        ctx,
        topic: String(args.topic || args.question || ""),
      });
    case "take_message":
    case "save_message":
      return domainTakeMessage({
        ctx,
        message: String(args.message || ""),
        callerName: args.caller_name ? String(args.caller_name) : undefined,
      });
    case "request_human":
      return domainRequestHuman({
        ctx,
        reason: args.reason ? String(args.reason) : undefined,
      });
    case "end_call":
      return domainEndCall({
        ctx,
        reason: args.reason ? String(args.reason) : undefined,
      });
    case "find_appointments":
      return domainFindAppointments({
        ctx,
        phone: args.phone ? String(args.phone) : undefined,
      });
    case "reschedule_appointment":
      return domainRescheduleAppointment({
        ctx,
        appointmentId: String(args.appointment_id || args.appointmentId || ""),
        newStartsAt: String(args.new_starts_at || args.newStartsAt || args.starts_at || ""),
        confirmed: Boolean(args.confirmed),
      });
    case "cancel_appointment":
      return domainCancelAppointment({
        ctx,
        appointmentId: String(args.appointment_id || args.appointmentId || ""),
        confirmed: Boolean(args.confirmed),
        reason: args.reason ? String(args.reason) : undefined,
      });
    default:
      return {
        ok: false,
        speak: `Tool ${toolName} is not supported in the text simulator.`,
        error_code: "UNSUPPORTED_TOOL",
      };
  }
}

/**
 * Execute a workflow tool against a LiveKit call context — same path as voice-runtime
 * amy-tools, without LiveKit AgentSession plumbing.
 */
export async function executeWorkflowTool(input: {
  ctx: LiveKitCallContext;
  toolName: string;
  args?: Record<string, unknown>;
}): Promise<WorkflowToolExecution> {
  const startedAt = Date.now();
  const workflowStateBefore = input.ctx.session.currentState;
  const nodeIdBefore =
    input.ctx.session.currentNodeId || input.ctx.session.runtime.current_node_id || "";
  const missingBefore = input.ctx.session.missingFieldIds.length;
  const { allowedToolNames: toolSetBefore } = compileToolsForCallContext(input.ctx);

  const loopFingerprint = fingerprintToolCall({
    toolName: input.toolName,
    nodeId: nodeIdBefore,
    missingFieldCount: missingBefore,
  });
  const loopCheck = shouldBlockRepeatedToolCall({
    history: input.ctx.toolCallHistory || [],
    toolName: input.toolName,
    fingerprint: loopFingerprint,
  });
  if (loopCheck.blocked) {
    const workflow =
      input.ctx.workflowDefinition ?? resolveActiveWorkflowForAgent(input.ctx.agentId).definition;
    reconcileCanonicalWorkflowState({ session: input.ctx.session, workflow });
    return {
      ctx: input.ctx,
      toolName: input.toolName,
      result: {
        ok: false,
        speak: "Repeated identical tool calls were blocked.",
        error_code: "NO_PROGRESS_LOOP",
      },
      serialized: JSON.stringify({
        success: false,
        errorCode: "NO_PROGRESS_LOOP",
        repeatCount: loopCheck.repeatCount,
      }),
      workflowStateBefore,
      workflowStateAfter: input.ctx.session.currentState,
      blocked: true,
      blockReason: "NO_PROGRESS_LOOP",
    };
  }

  if (!toolSetBefore.has(input.toolName)) {
    return {
      ctx: input.ctx,
      toolName: input.toolName,
      result: {
        ok: false,
        speak: `${input.toolName} is not available in the current workflow state.`,
        error_code: "TOOL_NOT_ALLOWED",
      },
      serialized: JSON.stringify({
        success: false,
        errorCode: "TOOL_NOT_ALLOWED",
        availableTools: [...toolSetBefore],
      }),
      workflowStateBefore,
      workflowStateAfter: workflowStateBefore,
      blocked: true,
      blockReason: "TOOL_NOT_ALLOWED",
    };
  }

  const result = await dispatchDomainAction(input.ctx, input.toolName, input.args || {});

  const workflow =
    input.ctx.workflowDefinition ?? resolveActiveWorkflowForAgent(input.ctx.agentId).definition;
  await applyWorkflowNodeTransition({
    workflow,
    callId: input.ctx.callId,
    session: input.ctx.session,
    toolName: input.toolName,
    result,
  });

  const canonical = reconcileCanonicalWorkflowState({
    session: input.ctx.session,
    workflow,
    toolName: input.toolName,
    toolResult: result,
  });
  input.ctx.canonicalWorkflow = canonical;
  input.ctx.workflowState = canonical.legacyState;

  const workflowStateAfter = input.ctx.session.currentState;
  const nodeIdAfter =
    input.ctx.session.currentNodeId || input.ctx.session.runtime.current_node_id || "";
  const missingAfter = input.ctx.session.missingFieldIds.length;
  const { allowedToolNames: toolSetAfter } = compileToolsForCallContext(input.ctx);

  const payload = formatModelToolResult(result, {
    session: input.ctx.session,
    toolName: input.toolName,
  });
  const serialized = JSON.stringify(payload);

  const noProgress = isNoProgressToolResult({
    toolName: input.toolName,
    ok: result.ok,
    beforeMissingCount: missingBefore,
    afterMissingCount: missingAfter,
    beforeNodeId: nodeIdBefore,
    afterNodeId: nodeIdAfter,
  });
  input.ctx.toolCallHistory = recordToolCallHistory(input.ctx.toolCallHistory || [], {
    toolName: input.toolName,
    fingerprint: loopFingerprint,
    resultHash: hashToolResult(payload),
    atMs: startedAt,
    noProgress,
  });

  console.log(
    JSON.stringify({
      source: "amy-text-simulator",
      event: "tool_executed",
      callId: input.ctx.callId,
      toolName: input.toolName,
      ok: result.ok,
      workflowStateBefore,
      workflowStateAfter,
      currentNodeId: canonical.currentNodeId,
      expectedNextAction: canonical.expectedNextAction,
      toolSetBefore: [...toolSetBefore],
      toolSetAfter: [...toolSetAfter],
      speak: result.speak,
    }),
  );

  return {
    ctx: input.ctx,
    toolName: input.toolName,
    result,
    serialized,
    workflowStateBefore,
    workflowStateAfter,
  };
}
