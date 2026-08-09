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
  domainSelectSlot,
  domainTakeMessage,
  formatModelToolResult,
  taskContextPayload,
  taskForWorkflowState,
  type DomainActionResult,
  type LiveKitCallContext,
} from "@/lib/voice/domain-actions";
import {
  applyWorkflowNodeTransition,
  compileToolsForCallContext,
  resolveActiveWorkflowForAgent,
} from "@/lib/voice/workflow-runtime";
import type { WorkflowState } from "@/lib/voice/workflow-engine/types";
import type { AmyProcessUserData } from "./metadata";

function liveKitNextAction(state: WorkflowState, envelopeInstructions?: string): string {
  if (envelopeInstructions?.trim()) return envelopeInstructions;
  switch (state) {
    case "INTENT_DISCOVERY":
    case "COLLECTING_FIELDS":
      return "Collect the active field from the caller, then call record_current_field({ value }).";
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
): Promise<void> {
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
  const ctx = requireCallContext(opts);
  const workflowStateBefore = ctx.session.currentState;
  const taskBefore = taskForWorkflowState(workflowStateBefore);
  const { allowedToolNames: toolSetBefore } = compileToolsForCallContext(ctx);
  const toolSetBeforeList = [...toolSetBefore];

  const run = async () => {
    const result = await execute(ctx);

    const { definition: workflow } =
      ctx.workflowDefinition || resolveActiveWorkflowForAgent(ctx.agentId);
    await applyWorkflowNodeTransition({
      workflow,
      callId: ctx.callId,
      session: ctx.session,
      toolName,
      result,
    });

    if (options?.refresh !== false) {
      await refreshAmyAgentAfterTool(opts, ctx);
    } else {
      stashContext(opts, ctx);
    }

    const workflowStateAfter = ctx.session.currentState;
    const taskAfter = taskForWorkflowState(workflowStateAfter);
    const { allowedToolNames: toolSetAfter } = compileToolsForCallContext(ctx);
    const toolSetAfterList = [...toolSetAfter];
    const payload = formatModelToolResult(result, {
      session: ctx.session,
      toolName,
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

    return serializeToolResult(result, { toolName, session: ctx.session });
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

  if (allowed.has("get_booking_requirements")) {
    tools.push(
      llm.tool({
        name: "get_booking_requirements",
        description:
          "Returns the booking fields this customer requires and which field is currently active. Call at the start of booking or when you need to know what information is still missing. Do not invent a fixed schema such as name + phone + email.",
        parameters: z.object({}),
        execute: async (_args, opts: AmyToolOptions) =>
          wrapToolExecute("get_booking_requirements", opts, async (ctx) =>
            domainGetBookingRequirements({ ctx }),
          ),
      }),
    );
  }

  if (allowed.has("record_current_field")) {
    tools.push(
      llm.tool({
        name: "record_current_field",
        description:
          "Records the caller's answer for the field currently requested by the booking workflow. Call immediately after the caller provides the requested value. The runtime determines the actual field and what comes next. Do not guess a different field.",
        parameters: z.object({
          value: z.string().describe("The caller's answer for the active field"),
        }),
        execute: async ({ value }, opts: AmyToolOptions) =>
          wrapToolExecute(
            "record_current_field",
            opts,
            async (ctx) => domainRecordField({ ctx, value }),
            { fillerMessage: "Got it, one moment." },
          ),
      }),
    );
  }

  if (allowed.has("record_fields")) {
    tools.push(
      llm.tool({
        name: "record_fields",
        description:
          "Record multiple field values at once when the caller provides several answers together. Keys must match workflow field ids.",
        parameters: z.object({
          fields: z
            .record(z.string())
            .describe("Map of field_id to caller-provided value"),
        }),
        execute: async ({ fields }, opts: AmyToolOptions) =>
          wrapToolExecute(
            "record_fields",
            opts,
            async (ctx) => domainRecordFields({ ctx, fields }),
            { fillerMessage: "Got it, one moment." },
          ),
      }),
    );
  }

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
            async (ctx) => ({
              ok: true,
              speak: "Let me connect you with someone who can help.",
              workflow_state: ctx.session.currentState,
              data: {
                action: "transfer_requested",
                reason: reason || "caller requested human",
              },
            }),
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
          "End the call politely after the workflow is complete or the caller is finished. Do not call while booking actions are still pending.",
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
  const taskId = taskForWorkflowState(callContext.session.currentState);
  const { envelope } = compileToolsForCallContext(callContext);
  return [
    buildAmyLiveKitPermanentPrompt(callContext.businessName),
    buildAmyTaskContextBlock({
      active_task: taskId,
      next_action: liveKitNextAction(callContext.session.currentState, envelope.taskInstructions),
      workflow_id: callContext.workflowRef?.workflowId,
      workflow_version: callContext.workflowRef?.version,
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

  await agent.updateInstructions(instructions);
  await agent.updateTools(llm.toToolContext(tools));
}

export function createAmyAgent(callContext: LiveKitCallContext) {
  const { tools } = buildAmyToolList(callContext);
  const instructions = buildAmyAgentInstructions(callContext);

  return voice.Agent.create<AmyProcessUserData>({
    instructions,
    tools: llm.toToolContext(tools),
  });
}
