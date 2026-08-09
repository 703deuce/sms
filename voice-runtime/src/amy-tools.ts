import { llm, voice } from "@livekit/agents";
import type { AgentSession } from "@livekit/agents";
import { z } from "zod";
import {
  buildAmyLiveKitPermanentPrompt,
  buildAmyTaskContextBlock,
} from "@/lib/agents/appointment-booking/intelligence/amy-livekit-prompt";
import {
  domainCheckAvailability,
  domainConfirmBooking,
  domainEndCall,
  domainGetBookingRequirements,
  domainRecordField,
  domainRecordFields,
  domainSubmitCallerInformation,
  domainSelectSlot,
  domainTakeMessage,
  domainLookupCustomer,
  domainValidateEligibility,
  domainClassifyIntent,
  domainRequestHuman,
  domainFindAppointments,
  domainRescheduleAppointment,
  domainCancelAppointment,
  domainDetectCallerIntent,
  domainGetBusinessAnswer,
  formatModelToolResult,
  taskContextPayload,
  taskForWorkflowState,
  type DomainActionResult,
  type LiveKitCallContext,
} from "@/lib/voice/domain-actions";
import { taskTypeForSession } from "@/lib/voice/workflow-tasks/registry";
import "@/lib/voice/workflow-tasks/registry";
import { applyWorkflowNodeTransition } from "@/lib/voice/workflow-runtime/node-transitions";
import { compileToolsForCallContext } from "@/lib/voice/workflow-runtime/compile-for-call";
import { resolveActiveWorkflowForAgent } from "@/lib/voice/workflow-runtime/loader";
import {
  shouldBlockRepeatedToolCall,
  fingerprintToolCall,
  hashToolResult,
  isNoProgressToolResult,
  recordToolCallHistory,
} from "@/lib/voice/workflow-runtime/loop-detection";
import { autoApplyWorkflowActionsFromUtterance } from "@/lib/voice/workflow-runtime/auto-workflow-actions";
import { reconcileCanonicalWorkflowState } from "@/lib/voice/workflow-runtime/canonical-state";
import type { WorkflowState } from "@/lib/voice/workflow-engine/types";
import type { AmyProcessUserData } from "./metadata";

function liveKitNextAction(
  state: WorkflowState,
  envelopeInstructions?: string,
  expectedNextAction?: string,
): string {
  if (envelopeInstructions?.trim()) return envelopeInstructions;
  if (expectedNextAction === "confirm_booking") {
    return "Read back the appointment details. After explicit yes from the caller, call confirm_booking({ confirmed: true }). Do not say the appointment is booked until confirm_booking succeeds.";
  }
  if (expectedNextAction === "select_slot") {
    return "Offer returned slots, then call select_slot when the caller picks one.";
  }
  if (expectedNextAction === "reschedule_appointment") {
    return "Read back the new appointment time. After explicit yes, call reschedule_appointment({ confirmed: true }) with the held slot time.";
  }
  if (expectedNextAction === "cancel_appointment") {
    return "Confirm cancellation. After explicit yes, call cancel_appointment({ confirmed: true }).";
  }
  if (expectedNextAction === "find_appointments") {
    return "Look up the caller's existing appointment with find_appointments before changing it.";
  }
  if (expectedNextAction === "check_availability") {
    return "Call check_availability before offering any appointment times.";
  }
  if (expectedNextAction === "collect_caller_information") {
    return "When the caller provides information, call submit_caller_information with extracted_fields. The runtime persists values and advances the workflow.";
  }
  switch (state) {
    case "INTENT_DISCOVERY":
    case "COLLECTING_FIELDS":
      return "When the caller provides information, call submit_caller_information with extracted_fields.";
    case "CHECKING_AVAILABILITY":
      return "Call check_availability before offering any appointment times.";
    case "SELECTING_SLOT":
      return "Offer returned slots, then call select_slot when the caller picks one.";
    case "READY_TO_BOOK":
    case "BOOKING_IN_PROGRESS":
      return "After explicit confirmation, call confirm_booking({ confirmed: true }).";
    case "COMPLETE":
      return "Booking is complete. Wrap up the call politely.";
    default:
      return "Follow the active task using only the tools currently available.";
  }
}

type AmyToolOptions = llm.ToolOptions<AmyProcessUserData>;

function requireCallContext(opts: AmyToolOptions): LiveKitCallContext {
  const callContext = opts.ctx.userData.callContext;
  if (!callContext) throw new llm.ToolError("Call context not initialized");
  return callContext;
}

function stashContext(opts: AmyToolOptions, ctx: LiveKitCallContext) {
  opts.ctx.userData.callContext = ctx;
}

async function refreshAmyAgentAfterTool(
  opts: AmyToolOptions,
  ctx: LiveKitCallContext,
  generation: number,
): Promise<void> {
  if (ctx.agentSyncGeneration !== generation) return;
  stashContext(opts, ctx);
  await syncAmyAgentFromContext(opts.ctx.session, ctx);
}

function serializeToolResult(
  result: DomainActionResult,
  options: {
    toolName: string;
    session?: LiveKitCallContext["session"];
  },
): string {
  return JSON.stringify(
    formatModelToolResult(result, {
      session: options.session,
      toolName: options.toolName,
    }),
  );
}

async function withSlowToolFiller<T>(
  opts: AmyToolOptions,
  startMessage: string,
  fn: () => Promise<T>,
): Promise<T> {
  return opts.ctx.filler(
    (step) => (step === 0 ? startMessage : "Still working on that."),
    { delay: 0, interval: 4000, maxSteps: 2 },
    fn,
  );
}

function logToolExecution(input: {
  callId: string;
  toolName: string;
  workflowStateBefore: WorkflowState;
  workflowStateAfter: WorkflowState;
  startedAt: number;
  success: boolean;
  nextAction?: string;
  toolSetBefore: readonly string[];
  toolSetAfter: readonly string[];
}) {
  console.log(
    JSON.stringify({
      source: "transovo-voice-runtime",
      event: "tool_executed",
      callId: input.callId,
      toolName: input.toolName,
      workflowStateBefore: input.workflowStateBefore,
      workflowStateAfter: input.workflowStateAfter,
      startedAt: new Date(input.startedAt).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - input.startedAt,
      success: input.success,
      nextAction: input.nextAction,
      toolSetBefore: input.toolSetBefore,
      toolSetAfter: input.toolSetAfter,
    }),
  );
}

function wrapToolExecute(
  toolName: string,
  opts: AmyToolOptions,
  execute: (ctx: LiveKitCallContext) => Promise<DomainActionResult>,
  options?: {
    refresh?: boolean;
    fillerMessage?: string;
  },
): Promise<string> {
  const startedAt = Date.now();
  let ctx = requireCallContext(opts);
  const workflowStateBefore = ctx.session.currentState;
  const nodeIdBefore =
    ctx.session.currentNodeId || ctx.session.runtime.current_node_id || "";
  const missingBefore = ctx.session.missingFieldIds.length;
  const taskBefore = taskForWorkflowState(workflowStateBefore);
  const { allowedToolNames: toolSetBefore } = compileToolsForCallContext(ctx);
  const toolSetBeforeList = [...toolSetBefore];

  const run = async () => {
    const loopFingerprint = fingerprintToolCall({
      toolName,
      nodeId: nodeIdBefore,
      missingFieldCount: missingBefore,
    });
    const loopCheck = shouldBlockRepeatedToolCall({
      history: ctx.toolCallHistory || [],
      toolName,
      fingerprint: loopFingerprint,
    });
    if (loopCheck.blocked) {
      const workflow =
        ctx.workflowDefinition ?? resolveActiveWorkflowForAgent(ctx.agentId).definition;
      reconcileCanonicalWorkflowState({
        session: ctx.session,
        workflow,
      });
      const syncGeneration = (ctx.agentSyncGeneration ?? 0) + 1;
      ctx.agentSyncGeneration = syncGeneration;
      await refreshAmyAgentAfterTool(opts, ctx, syncGeneration);
      throw new llm.ToolError(
        JSON.stringify({
          success: false,
          errorCode: "NO_PROGRESS_LOOP",
          message:
            "Repeated identical tool calls with no workflow progress were blocked. Re-read the task context and use the currently available tools.",
          repeatCount: loopCheck.repeatCount,
        }),
      );
    }

    const result = await execute(ctx);

    const workflow =
      ctx.workflowDefinition ??
      resolveActiveWorkflowForAgent(ctx.agentId).definition;
    await applyWorkflowNodeTransition({
      workflow,
      callId: ctx.callId,
      session: ctx.session,
      toolName,
      result,
    });

    const canonical = reconcileCanonicalWorkflowState({
      session: ctx.session,
      workflow,
      toolName,
      toolResult: result,
    });
    ctx.canonicalWorkflow = canonical;
    ctx.workflowState = canonical.legacyState;

    stashContext(opts, ctx);

    const workflowStateAfter = ctx.session.currentState;
    const nodeIdAfter =
      ctx.session.currentNodeId || ctx.session.runtime.current_node_id || "";
    const missingAfter = ctx.session.missingFieldIds.length;
    const { allowedToolNames: toolSetAfter } = compileToolsForCallContext(ctx);
    const toolSetAfterList = [...toolSetAfter];
    const payload = formatModelToolResult(result, {
      session: ctx.session,
      toolName,
    });

    const noProgress = isNoProgressToolResult({
      toolName,
      ok: result.ok,
      beforeMissingCount: missingBefore,
      afterMissingCount: missingAfter,
      beforeNodeId: nodeIdBefore,
      afterNodeId: nodeIdAfter,
    });
    const resultHash = hashToolResult(payload);
    ctx.toolCallHistory = recordToolCallHistory(ctx.toolCallHistory || [], {
      toolName,
      fingerprint: loopFingerprint,
      resultHash,
      atMs: Date.now(),
      noProgress,
    });

    logToolExecution({
      callId: ctx.callId,
      toolName,
      workflowStateBefore,
      workflowStateAfter,
      startedAt,
      success: result.ok,
      nextAction: payload.nextAction ? String(payload.nextAction) : undefined,
      toolSetBefore: toolSetBeforeList,
      toolSetAfter: toolSetAfterList,
    });

    let finalResult = result;
    let finalToolName = toolName;

    if (result.ok) {
      const autoChain = await autoApplyWorkflowActionsFromUtterance({
        ctx,
        userText: "",
        toolsCalledThisTurn: [toolName],
      });
      if (autoChain.actions.length > 0) {
        ctx = autoChain.ctx;
        stashContext(opts, ctx);
        console.log(
          JSON.stringify({
            source: "transovo-voice-runtime",
            event: "auto_workflow_chain_after_tool",
            callId: ctx.callId,
            afterTool: toolName,
            actions: autoChain.actions.map((a) => ({
              toolName: a.toolName,
              ok: a.ok,
            })),
          }),
        );
        const chainedAvailability = autoChain.actions.find(
          (a) => a.toolName === "check_availability" && a.ok && a.result,
        );
        if (chainedAvailability?.result) {
          finalResult = chainedAvailability.result;
          finalToolName = "check_availability";
        }
      }
    }

    const serialized = serializeToolResult(finalResult, {
      toolName: finalToolName,
      session: ctx.session,
    });

    // Return tool output to the LLM immediately; sync instructions/tools in the
    // background so updateTools() does not stall or invalidate in-flight speech.
    if (options?.refresh !== false) {
      const syncGeneration = (ctx.agentSyncGeneration ?? 0) + 1;
      ctx.agentSyncGeneration = syncGeneration;
      void refreshAmyAgentAfterTool(opts, ctx, syncGeneration).catch((err) => {
        console.error(
          JSON.stringify({
            source: "transovo-voice-runtime",
            event: "amy_agent_sync_error",
            callId: ctx.callId,
            toolName,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      });
    }

    return serialized;
  };

  if (options?.fillerMessage) {
    return withSlowToolFiller(opts, options.fillerMessage, run);
  }
  return run();
}

export function buildAmyToolList(callContext: LiveKitCallContext) {
  const taskId = taskForWorkflowState(callContext.session.currentState);
  const { envelope, allowedToolNames: allowed } = compileToolsForCallContext(callContext);
  const tools: llm.ToolContextEntry[] = [];

  if (allowed.has("submit_caller_information")) {
    tools.push(
      llm.tool({
        name: "submit_caller_information",
        description:
          "Persist structured information the caller just provided. Call whenever the caller gives name, email, phone, address, service issue, or other booking details. Pass extracted_fields with workflow field ids or common aliases (name, email, service_address, problem). The runtime validates, stores, and advances the workflow — you do not need to call record_current_field separately.",
        parameters: z.object({
          extracted_fields: z
            .record(z.string(), z.string())
            .optional()
            .describe("Map of field id or alias to the value the caller provided"),
          utterance: z
            .string()
            .optional()
            .describe("Raw caller utterance when structured fields are unclear"),
          intent: z
            .string()
            .optional()
            .describe("Caller intent if newly understood: book, reschedule, cancel, emergency"),
        }),
        execute: async ({ extracted_fields, utterance, intent }, opts: AmyToolOptions) =>
          wrapToolExecute(
            "submit_caller_information",
            opts,
            async (ctx) =>
              domainSubmitCallerInformation({
                ctx,
                extractedFields: extracted_fields,
                utterance,
                intent,
              }),
          ),
      }),
    );
  }

  // Runtime-only: record_current_field / record_fields / get_booking_requirements are
  // not exposed to the LLM — use submit_caller_information instead.

  if (allowed.has("check_availability")) {
    tools.push(
      llm.tool({
        name: "check_availability",
        description:
          "Checks the business's real connected calendar for appointment availability. Call this only after required booking information has been collected and the current workflow allows availability lookup. You MUST call this before offering specific appointment times. Never invent times. Do not call while required fields remain missing.",
        parameters: z.object({
          spoken: z
            .string()
            .describe("Caller time preference, e.g. tomorrow afternoon or next Tuesday"),
        }),
        execute: async ({ spoken }, opts: AmyToolOptions) =>
          wrapToolExecute(
            "check_availability",
            opts,
            async (ctx) => domainCheckAvailability({ ctx, spoken }),
            { fillerMessage: "Sure, let me check." },
          ),
      }),
    );
  }

  if (allowed.has("select_slot")) {
    tools.push(
      llm.tool({
        name: "select_slot",
        description:
          "Select one of the appointment slots previously returned by check_availability. Call when the caller chooses a time using natural language such as 'the first one' or '9 AM'. Do not construct arbitrary timestamps.",
        parameters: z.object({
          selection: z
            .string()
            .describe("Caller slot choice, e.g. 2 PM or the second one"),
          slot_iso: z.string().optional().describe("ISO timestamp only if explicitly known"),
        }),
        execute: async ({ selection, slot_iso }, opts: AmyToolOptions) =>
          wrapToolExecute(
            "select_slot",
            opts,
            async (ctx) =>
              domainSelectSlot({
                ctx,
                utterance: selection,
                slotIso: slot_iso,
              }),
            { fillerMessage: "One moment." },
          ),
      }),
    );
  }

  if (allowed.has("confirm_booking")) {
    tools.push(
      llm.tool({
        name: "confirm_booking",
        description:
          "Creates the real appointment for the currently selected or held slot. Call only after the caller explicitly confirms the proposed appointment. Do not call merely because a slot was selected. A successful return is required before telling the caller the appointment is booked.",
        parameters: z.object({
          confirmed: z.boolean().describe("True when caller explicitly confirms booking"),
        }),
        execute: async ({ confirmed }, opts: AmyToolOptions) =>
          wrapToolExecute(
            "confirm_booking",
            opts,
            async (ctx) => domainConfirmBooking({ ctx, confirmed }),
            { fillerMessage: "One moment." },
          ),
      }),
    );
  }

  if (allowed.has("take_message") || allowed.has("save_message")) {
    tools.push(
      llm.tool({
        name: "take_message",
        description:
          "Capture a message for the business when the caller does not want to book or needs a human follow-up. Call after collecting the caller's message.",
        parameters: z.object({
          message: z.string().describe("The caller's message"),
          caller_name: z.string().optional().describe("Caller name if known"),
        }),
        execute: async ({ message, caller_name }, opts: AmyToolOptions) =>
          wrapToolExecute(
            "take_message",
            opts,
            async (ctx) =>
              domainTakeMessage({
                ctx,
                message,
                callerName: caller_name,
              }),
          ),
      }),
    );
  }

  if (allowed.has("lookup_customer")) {
    tools.push(
      llm.tool({
        name: "lookup_customer",
        description:
          "Look up an existing customer by phone, email, or name. Do not assume ANI is the speaker.",
        parameters: z.object({
          phone: z.string().optional(),
          email: z.string().optional(),
          name: z.string().optional(),
        }),
        execute: async ({ phone, email, name }, opts: AmyToolOptions) =>
          wrapToolExecute("lookup_customer", opts, async (ctx) =>
            domainLookupCustomer({ ctx, phone, email, name }),
          ),
      }),
    );
  }

  if (allowed.has("validate_eligibility")) {
    tools.push(
      llm.tool({
        name: "validate_eligibility",
        description: "Validate whether the service address is in the business service area.",
        parameters: z.object({
          address: z.string().optional().describe("Service address if not already collected"),
        }),
        execute: async ({ address }, opts: AmyToolOptions) =>
          wrapToolExecute("validate_eligibility", opts, async (ctx) =>
            domainValidateEligibility({ ctx, address }),
          ),
      }),
    );
  }

  if (allowed.has("classify_intent")) {
    tools.push(
      llm.tool({
        name: "classify_intent",
        description: "Classify urgency and safety for triage routing per configured rules.",
        parameters: z.object({
          utterance: z.string().optional().describe("Recent caller utterance for classification"),
        }),
        execute: async ({ utterance }, opts: AmyToolOptions) =>
          wrapToolExecute("classify_intent", opts, async (ctx) =>
            domainClassifyIntent({ ctx, utterance }),
          ),
      }),
    );
  }

  if (allowed.has("detect_caller_intent")) {
    tools.push(
      llm.tool({
        name: "detect_caller_intent",
        description:
          "Detect whether the caller wants to book service, reschedule, cancel, or has an emergency. Call once you understand why they are calling.",
        parameters: z.object({
          utterance: z
            .string()
            .optional()
            .describe("Recent caller utterance summarizing their request"),
        }),
        execute: async ({ utterance }, opts: AmyToolOptions) =>
          wrapToolExecute("detect_caller_intent", opts, async (ctx) =>
            domainDetectCallerIntent({ ctx, utterance }),
          ),
      }),
    );
  }

  if (allowed.has("get_business_answer")) {
    tools.push(
      llm.tool({
        name: "get_business_answer",
        description:
          "Answer configured business questions such as pricing, fees, or business hours. Use when the caller asks about cost or hours.",
        parameters: z.object({
          topic: z.string().describe("What the caller asked about, e.g. pricing or hours"),
        }),
        execute: async ({ topic }, opts: AmyToolOptions) =>
          wrapToolExecute("get_business_answer", opts, async (ctx) =>
            domainGetBusinessAnswer({ ctx, topic }),
          ),
      }),
    );
  }

  if (allowed.has("find_appointments")) {
    tools.push(
      llm.tool({
        name: "find_appointments",
        description: "Find existing appointments for the caller before reschedule or cancel.",
        parameters: z.object({
          phone: z.string().optional(),
        }),
        execute: async ({ phone }, opts: AmyToolOptions) =>
          wrapToolExecute("find_appointments", opts, async (ctx) =>
            domainFindAppointments({ ctx, phone }),
          ),
      }),
    );
  }

  if (allowed.has("reschedule_appointment")) {
    tools.push(
      llm.tool({
        name: "reschedule_appointment",
        description: "Reschedule an appointment after explicit caller confirmation.",
        parameters: z.object({
          appointment_id: z.string(),
          new_starts_at: z.string().describe("ISO start time for the new slot"),
          confirmed: z.boolean().optional(),
        }),
        execute: async ({ appointment_id, new_starts_at, confirmed }, opts: AmyToolOptions) =>
          wrapToolExecute("reschedule_appointment", opts, async (ctx) =>
            domainRescheduleAppointment({
              ctx,
              appointmentId: appointment_id,
              newStartsAt: new_starts_at,
              confirmed,
            }),
          ),
      }),
    );
  }

  if (allowed.has("cancel_appointment")) {
    tools.push(
      llm.tool({
        name: "cancel_appointment",
        description: "Cancel an appointment after explicit caller confirmation.",
        parameters: z.object({
          appointment_id: z.string(),
          confirmed: z.boolean().optional(),
          reason: z.string().optional(),
        }),
        execute: async ({ appointment_id, confirmed, reason }, opts: AmyToolOptions) =>
          wrapToolExecute("cancel_appointment", opts, async (ctx) =>
            domainCancelAppointment({
              ctx,
              appointmentId: appointment_id,
              confirmed,
              reason,
            }),
          ),
      }),
    );
  }

  if (allowed.has("request_human")) {
    tools.push(
      llm.tool({
        name: "request_human",
        description:
          "Transfer or escalate to a human when the caller requests it or the issue cannot be resolved with available tools.",
        parameters: z.object({
          reason: z.string().optional(),
        }),
        execute: async ({ reason }, opts: AmyToolOptions) =>
          wrapToolExecute(
            "request_human",
            opts,
            async (ctx) => domainRequestHuman({ ctx, reason }),
            { refresh: false },
          ),
      }),
    );
  }

  if (allowed.has("end_call")) {
    tools.push(
      llm.tool({
        name: "end_call",
        description:
          "End the call politely after the workflow is complete or the caller is finished. Only call after confirm_booking succeeds or the caller explicitly wants to hang up without booking. Do not call while a slot is held but booking is unconfirmed.",
        parameters: z.object({
          reason: z.string().optional(),
        }),
        execute: async ({ reason }, opts: AmyToolOptions) =>
          wrapToolExecute(
            "end_call",
            opts,
            async (ctx) => domainEndCall({ ctx, reason }),
            { refresh: false },
          ),
      }),
    );
  }

  return { tools, taskId };
}

export function buildAmyAgentInstructions(callContext: LiveKitCallContext): string {
  const taskId = taskTypeForSession(callContext.session) || taskForWorkflowState(callContext.session.currentState);
  const { envelope, canonical } = compileToolsForCallContext(callContext);
  return [
    buildAmyLiveKitPermanentPrompt(callContext.businessName),
    buildAmyTaskContextBlock({
      active_task: taskId,
      next_action: liveKitNextAction(
        callContext.session.currentState,
        envelope.taskInstructions,
        canonical?.expectedNextAction,
      ),
      workflow_id: callContext.workflowRef?.workflowId,
      workflow_version: callContext.workflowRef?.version,
      current_node_id: canonical?.currentNodeId,
      expected_next_action: canonical?.expectedNextAction,
      ready_for_availability: canonical?.readyForAvailability,
      ...taskContextPayload(callContext),
    }),
  ].join("\n\n");
}

export async function syncAmyAgentFromContext(
  session: AgentSession<AmyProcessUserData>,
  callContext: LiveKitCallContext,
): Promise<void> {
  const previousState =
    callContext.lastAgentSync?.workflowState ?? callContext.session.currentState;
  const previousTask =
    callContext.lastAgentSync?.taskId ?? taskForWorkflowState(previousState);
  const previousTools = [...(callContext.lastAgentSync?.toolNames || [])];

  session.userData = { ...session.userData, callContext };
  const agent = session.currentAgent;
  const { tools, taskId } = buildAmyToolList(callContext);
  const instructions = buildAmyAgentInstructions(callContext);
  const newState = callContext.session.currentState;
  const newTools = tools.map((tool) => tool.id);

  console.log(
    JSON.stringify({
      source: "transovo-voice-runtime",
      event: "amy_agent_sync",
      callId: callContext.callId,
      previousState,
      newState,
      previousTask,
      newTask: taskId,
      previousTools,
      newTools,
      readyForAvailability: callContext.session.missingFieldIds.length === 0,
      workflowId: callContext.workflowRef?.workflowId,
      workflowVersion: callContext.workflowRef?.version,
      toolEnvelope: callContext.lastToolEnvelope
        ? {
            capabilityIds: callContext.lastToolEnvelope.capabilityIds,
            stoppedAtUserBoundary: callContext.lastToolEnvelope.stoppedAtUserBoundary,
          }
        : undefined,
    }),
  );

  callContext.lastAgentSync = {
    workflowState: newState,
    taskId,
    toolNames: newTools,
    envelope: callContext.lastToolEnvelope,
  };
  callContext.workflowState = newState;

  const toolsChanged =
    previousTools.length !== newTools.length ||
    previousTools.some((name) => !newTools.includes(name));

  await agent.updateInstructions(instructions);
  if (toolsChanged || taskId !== previousTask) {
    await agent.updateTools(llm.toToolContext(tools));
  }
}

export function createAmyAgent(callContext: LiveKitCallContext) {
  const { tools } = buildAmyToolList(callContext);
  const instructions = buildAmyAgentInstructions(callContext);

  return voice.Agent.create<AmyProcessUserData>({
    instructions,
    tools: llm.toToolContext(tools),
  });
}
