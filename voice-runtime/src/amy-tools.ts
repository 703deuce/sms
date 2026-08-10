import { llm, voice } from "@livekit/agents";
import type { AgentSession } from "@livekit/agents";
import { buildAmyAgentInstructions } from "@/lib/voice/agent-runtime/build-amy-instructions";
import { executeDeterministicPipeline } from "@/lib/voice/agent-runtime/deterministic-executor";
import {
  formatModelToolResult,
  taskForWorkflowState,
  type DomainActionResult,
  type LiveKitCallContext,
} from "@/lib/voice/domain-actions";
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
import { reconcileCanonicalWorkflowState } from "@/lib/voice/workflow-runtime/canonical-state";
import type { WorkflowState } from "@/lib/voice/workflow-engine/types";
import type { AmyProcessUserData } from "./metadata";
import { buildAmySemanticToolList } from "./amy-semantic-tools";

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
      const pipeline = await executeDeterministicPipeline({
        ctx,
        preferenceSpoken: ctx.session.lastUserUtterance || "",
      });
      if (pipeline.steps.length > 0) {
        ctx = pipeline.ctx;
        stashContext(opts, ctx);
        console.log(
          JSON.stringify({
            source: "transovo-voice-runtime",
            event: "deterministic_pipeline_after_tool",
            callId: ctx.callId,
            afterTool: toolName,
            steps: pipeline.steps.map((s) => ({
              toolName: s.toolName,
              ok: s.ok,
            })),
          }),
        );
        if (pipeline.lastResult && pipeline.lastToolName) {
          finalResult = pipeline.lastResult;
          finalToolName = pipeline.lastToolName;
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
  return buildAmySemanticToolList({
    callContext,
    wrapToolExecute: wrapToolExecute as Parameters<typeof buildAmySemanticToolList>[0]["wrapToolExecute"],
  });
}

export { buildAmyAgentInstructions };


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
