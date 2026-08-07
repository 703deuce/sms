/**
 * Owner Amy — LLM agent loop with tool calling.
 * The model decides which tools to invoke based on the owner's question.
 */

import type { AppointmentBookingAgentView } from "@/lib/agents/appointment-booking/types";
import type { OwnerChatReply } from "@/lib/agents/appointment-booking/owner-chat";
import { llmChatWithTools, type LlmChatMessage } from "@/lib/ai/llm-tools";
import {
  buildOwnerRuntimeContext,
  buildOwnerAmySystemPrompt,
  buildOwnerAmyRuntimeDebug,
  enrichOwnerReply,
  preflightOwnerRequest,
  assertLoopLimits,
} from "@/lib/agents/appointment-booking/intelligence/owner-runtime";
import { DEFAULT_OWNER_LOOP_LIMITS } from "@/lib/agents/appointment-booking/intelligence/types";
import {
  executeOwnerLlmTool,
  OWNER_LLM_TOOL_DEFINITIONS,
} from "@/lib/agents/appointment-booking/intelligence/owner-tool-executor";
import { stringifyToolResult } from "@/lib/agents/appointment-booking/intelligence/tool-result";
import {
  resolveLlmProvidersForRuntime,
  getRuntimeModelConfig,
} from "@/lib/agents/appointment-booking/intelligence/owner-model-config";
import { getPromptVersionRecord } from "@/lib/agents/appointment-booking/intelligence/prompt-versioning";
import {
  loadOrCreateOwnerConversation,
  persistOwnerConversation,
  appendConversationTurn,
  trackToolReferences,
} from "@/lib/agents/appointment-booking/intelligence/owner-conversation";
import {
  createActionConfirmation,
  extractPendingActionConfirmation,
} from "@/lib/agents/appointment-booking/intelligence/owner-confirmation";

const TOOL_SELECTION_EXAMPLES = `
TOOL SELECTION EXAMPLES
- "Did the last caller get booked?" → search_calls(limit=1) → get_call_trace(callId) → get_booking_record if appointmentId present. Do not call metrics.
- "Make customers book at least four hours ahead." → get_agent_settings(section=booking_policy) → create_booking_policy_proposal → wait for approval.
- "Ask drain-cleaning customers what problem they are having." → get_agent_settings(section=collection_fields) → create_collection_field_proposal → wait for approval.
- "If they don't book, text a booking link ten minutes later." → get current workflow → request_workflow_draft → validate_workflow_draft → run tests → wait for approval.
- "Write custom JavaScript into the workflow." → refuse; use approved blocks only.`;

function buildOwnerLlmSystemPrompt(
  agent: AppointmentBookingAgentView,
  workspaceId: string,
  userId?: string,
  draftConfig?: unknown,
): string {
  const ctx = buildOwnerRuntimeContext({ agent, workspaceId, userId, draftConfig });
  const base = buildOwnerAmySystemPrompt(ctx);
  const cfg = getRuntimeModelConfig("owner_amy");
  return `${base}

${TOOL_SELECTION_EXAMPLES}

Model runtime (explicit): ${cfg.provider}/${cfg.model}${
    cfg.fallbackProvider ? ` (fallback: ${cfg.fallbackProvider}/${cfg.fallbackModel})` : ""
  }`;
}

function unwrapToolData(result: unknown): unknown {
  if (result && typeof result === "object" && "status" in (result as object)) {
    const r = result as { status: string; data?: unknown };
    if (r.status === "completed") return r.data;
  }
  return result;
}

export async function runOwnerAmyLlmLoop(input: {
  workspaceId: string;
  agentId: string;
  userId?: string;
  question: string;
  agent: AppointmentBookingAgentView;
  history?: Array<{ role: "user" | "agent"; text: string }>;
  draftConfig?: unknown;
}): Promise<OwnerChatReply> {
  const providerChain = resolveLlmProvidersForRuntime("owner_amy");
  if (!providerChain.length) {
    throw new Error("No LLM provider configured for Owner Amy");
  }
  if (!input.userId) {
    throw new Error("Sign in required for Owner Amy LLM agent");
  }

  const preflight = preflightOwnerRequest(input.question, input.agent);
  if (preflight.blocked) {
    return enrichOwnerReply(
      {
        answer: preflight.blocked,
        sources: ["capability_boundary"],
        suggestedFollowUps: ["Explain your setup", "What can you do?"],
      },
      preflight.state,
      buildOwnerAmyRuntimeDebug({
        loopState: preflight.state,
        promptText: "",
      }),
    );
  }

  let conversation = await loadOrCreateOwnerConversation({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    userId: input.userId,
  });

  const system = buildOwnerLlmSystemPrompt(
    input.agent,
    input.workspaceId,
    input.userId,
    input.draftConfig,
  );
  const promptVersion = getPromptVersionRecord("owner_amy");
  const messages: LlmChatMessage[] = [{ role: "system", content: system }];

  for (const turn of conversation.messages.slice(-20)) {
    messages.push({
      role: turn.role === "user" ? "user" : "assistant",
      content: turn.text,
    });
  }
  for (const turn of input.history || []) {
    messages.push({
      role: turn.role === "user" ? "user" : "assistant",
      content: turn.text,
    });
  }
  messages.push({ role: "user", content: input.question });

  conversation = appendConversationTurn(conversation, {
    role: "user",
    text: input.question,
    at: new Date().toISOString(),
  });
  conversation.lastIntent = preflight.state.route.intent;

  const toolsUsed: string[] = [];
  let lastToolData: unknown = null;
  let proposalId: string | undefined;
  let workflowDraftId: string | undefined;
  let requiresConfirmation = false;
  let pendingConfirmationId: string | undefined;
  const startedAt = Date.now();
  let iterations = 0;
  let lastModel = "";

  while (iterations < DEFAULT_OWNER_LOOP_LIMITS.maxPlanningIterations) {
    iterations += 1;
    preflight.state.iteration = iterations;
    assertLoopLimits(preflight.state);

    if (Date.now() - startedAt > DEFAULT_OWNER_LOOP_LIMITS.timeoutMs) {
      throw new Error("Owner Amy request timed out");
    }

    const result = await llmChatWithTools(messages, OWNER_LLM_TOOL_DEFINITIONS, {
      temperature: 0.2,
      maxTokens: 2000,
      providerChain,
    });
    if (!result) throw new Error("LLM returned no response");

    lastModel = `${result.provider}:${result.model}`;
    const assistantMsg = result.message;
    messages.push({
      role: "assistant",
      content: assistantMsg.content,
      tool_calls: assistantMsg.tool_calls,
    });

    if (!assistantMsg.tool_calls?.length) {
      const answer =
        assistantMsg.content?.trim() ||
        "I could not complete this request safely within the current operation. I created no production changes.";
      const evidence = buildEvidenceFromToolData(lastToolData, input.agentId);
      conversation = appendConversationTurn(conversation, {
        role: "assistant",
        text: answer,
        at: new Date().toISOString(),
        model: lastModel,
        promptVersion: promptVersion.promptVersion,
        toolCalls: toolsUsed.map((name) => ({ name })),
      });
      if (pendingConfirmationId) {
        conversation.pendingConfirmationId = pendingConfirmationId;
      }
      if (proposalId) conversation.activeProposalId = proposalId;
      await persistOwnerConversation(input.workspaceId, input.agentId, conversation);

      const debug = buildOwnerAmyRuntimeDebug({ loopState: preflight.state, promptText: system });
      return enrichOwnerReply(
        {
          answer,
          sources: ["owner_llm", result.provider, ...toolsUsed],
          suggestedFollowUps: [
            "What happened on the last call?",
            "How many appointments did you book this week?",
            "Change the minimum notice to four hours",
          ],
          evidence,
          proposalId,
          workflowDraftId,
          requiresConfirmation:
            requiresConfirmation || Boolean(proposalId) || Boolean(workflowDraftId),
          data: {
            model: lastModel,
            toolsUsed,
            iterations,
            runtimeMode: "llm_agent",
            confirmationId: pendingConfirmationId,
          },
        },
        preflight.state,
        debug,
      );
    }

    for (const call of assistantMsg.tool_calls) {
      const toolName = call.function.name;
      toolsUsed.push(toolName);
      preflight.state.lastToolCalls.push(toolName);
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }

      let toolResult: unknown;
      try {
        toolResult = await executeOwnerLlmTool({
          workspaceId: input.workspaceId,
          agentId: input.agentId,
          userId: input.userId,
          toolName,
          args,
        });
        lastToolData = unwrapToolData(toolResult);
        conversation = trackToolReferences(conversation, toolName, toolResult);

        const spec = (await import("./owner-tool-executor")).OWNER_LLM_TOOL_SPECS[toolName];
        if (spec?.specialist) {
          preflight.state.specialistCalls += 1;
          preflight.state.specialistsExecuted.push(spec.specialist);
        }
        if (toolName === "request_workflow_draft") {
          const data = unwrapToolData(toolResult) as Record<string, unknown> | null;
          const architectResult = data?.architectResult as { creationMode?: string } | undefined;
          if (architectResult?.creationMode === "llm_architect") {
            preflight.state.specialistsExecuted.push("appointment_workflow_architect");
            preflight.state.specialistCalls += 1;
          }
        }

        const pending = extractPendingActionConfirmation(toolName, toolResult);
        if (pending) {
          if (pending.actionType === "confirm_change_proposal") {
            proposalId = pending.targetId;
          } else if (pending.actionType === "promote_workflow_draft") {
            workflowDraftId = pending.targetId;
          }
          const confirmation = await createActionConfirmation({
            workspaceId: input.workspaceId,
            agentId: input.agentId,
            userId: input.userId,
            actionType: pending.actionType,
            targetId: pending.targetId,
          });
          pendingConfirmationId = confirmation.id;
          requiresConfirmation = true;
        }
      } catch (err) {
        toolResult = {
          status: "failed",
          code: "execution_error",
          retryable: true,
          message: err instanceof Error ? err.message : String(err),
        };
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: stringifyToolResult(toolResult),
      });
    }
  }

  const debug = buildOwnerAmyRuntimeDebug({
    loopState: preflight.state,
    promptText: system,
    failureReason: "iteration_limit",
  });
  return enrichOwnerReply(
    {
      answer:
        "I could not complete this request safely within the current operation. I created no production changes.",
      sources: ["owner_llm", ...toolsUsed],
      suggestedFollowUps: ["What happened on the last call?", "Explain your setup"],
      data: { toolsUsed, iterations, runtimeMode: "llm_agent" },
    },
    preflight.state,
    debug,
  );
}

function buildEvidenceFromToolData(
  data: unknown,
  agentId: string,
): OwnerChatReply["evidence"] {
  const out: NonNullable<OwnerChatReply["evidence"]> = [];
  if (!data || typeof data !== "object") return out;

  const d = data as Record<string, unknown>;
  const traces = d.traces as Array<{ callId?: string }> | undefined;
  const callId =
    (d.callId as string) ||
    traces?.[0]?.callId ||
    (d.trace as { callId?: string })?.callId;
  if (callId) {
    out.push({
      label: "Open call",
      kind: "call",
      href: `/voice/calls/${callId}`,
      refId: callId,
    });
    out.push({
      label: "View timeline",
      kind: "timeline",
      href: `/agents/${agentId}?section=work&callId=${callId}`,
      refId: callId,
    });
  }
  if (d.proposalId || d.id) {
    out.push({
      label: "Review proposal",
      kind: "versions",
      href: `/agents/${agentId}?section=build`,
    });
  }
  return out.length ? out : undefined;
}
