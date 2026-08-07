/**
 * Owner Amy — LLM agent loop with tool calling.
 * The model decides which tools to invoke based on the owner's question.
 */

import type { AppointmentBookingAgentView } from "@/lib/agents/appointment-booking/types";
import type { OwnerChatReply } from "@/lib/agents/appointment-booking/owner-chat";
import { hasLlmConfigured, primaryLlmModelLabel } from "@/lib/ai/llm-providers";
import { llmChatWithTools, type LlmChatMessage } from "@/lib/ai/llm-tools";
import {
  buildOwnerRuntimeContext,
  buildOwnerAmySystemPrompt,
  enrichOwnerReply,
  preflightOwnerRequest,
  assertLoopLimits,
} from "@/lib/agents/appointment-booking/intelligence/owner-runtime";
import { DEFAULT_OWNER_LOOP_LIMITS } from "@/lib/agents/appointment-booking/intelligence/types";
import {
  executeOwnerLlmTool,
  OWNER_LLM_TOOL_DEFINITIONS,
  stringifyToolResult,
} from "@/lib/agents/appointment-booking/intelligence/owner-tool-executor";
import { OWNER_AMY_TOOL_DESCRIPTIONS } from "@/lib/agents/appointment-booking/intelligence/tool-descriptions";

function buildOwnerLlmSystemPrompt(agent: AppointmentBookingAgentView, workspaceId: string, userId?: string): string {
  const ctx = buildOwnerRuntimeContext({ agent, workspaceId, userId });
  const base = buildOwnerAmySystemPrompt(ctx);
  const toolSummary = OWNER_AMY_TOOL_DESCRIPTIONS.map(
    (t) => `- ${t.id}: ${t.purpose}`,
  ).join("\n");

  return `${base}

YOU ARE AN LLM AGENT WITH TOOLS
You must answer the owner using real data from tools — never invent call logs, metrics, or booking outcomes.
When the owner asks about calls, bookings, health, or configuration:
1. Choose the right tool(s).
2. Read the tool results.
3. Reply in clear plain language with evidence.

For "what happened on the last call" or similar:
- Call search_calls (limit 1) to get the latest callId
- Then get_call_trace or get_execution_trace for that callId
- Summarize who called, what they wanted, tools used, outcome, SMS/calendar status

For configuration changes:
- Create a proposal tool first — never claim a change is live until confirm_change_proposal succeeds.

Available tools (also exposed as functions):
${toolSummary}

Model runtime: ${primaryLlmModelLabel()}`;
}

function extractProposalMeta(data: unknown): {
  proposalId?: string;
  requiresConfirmation?: boolean;
} {
  if (!data || typeof data !== "object") return {};
  const d = data as Record<string, unknown>;
  return {
    proposalId: d.proposalId ? String(d.proposalId) : d.id ? String(d.id) : undefined,
    requiresConfirmation: Boolean(d.requiresConfirmation),
  };
}

export async function runOwnerAmyLlmLoop(input: {
  workspaceId: string;
  agentId: string;
  userId?: string;
  question: string;
  agent: AppointmentBookingAgentView;
  history?: Array<{ role: "user" | "agent"; text: string }>;
}): Promise<OwnerChatReply> {
  if (!hasLlmConfigured()) {
    throw new Error("No LLM provider configured for Owner Amy");
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
    );
  }

  const system = buildOwnerLlmSystemPrompt(
    input.agent,
    input.workspaceId,
    input.userId,
  );
  const messages: LlmChatMessage[] = [{ role: "system", content: system }];

  for (const turn of input.history || []) {
    messages.push({
      role: turn.role === "user" ? "user" : "assistant",
      content: turn.text,
    });
  }
  messages.push({ role: "user", content: input.question });

  const toolsUsed: string[] = [];
  let lastToolData: unknown = null;
  let proposalId: string | undefined;
  let requiresConfirmation = false;
  const startedAt = Date.now();
  let iterations = 0;

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
    });
    if (!result) throw new Error("LLM returned no response");

    const assistantMsg = result.message;
    messages.push({
      role: "assistant",
      content: assistantMsg.content,
      tool_calls: assistantMsg.tool_calls,
    });

    if (!assistantMsg.tool_calls?.length) {
      const answer =
        assistantMsg.content?.trim() ||
        "I could not produce an answer. Try rephrasing or ask me to check a specific call.";
      const evidence = lastToolData
        ? buildEvidenceFromToolData(lastToolData, input.agentId)
        : undefined;
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
          requiresConfirmation: requiresConfirmation || Boolean(proposalId),
          data: {
            model: `${result.provider}:${result.model}`,
            toolsUsed,
            iterations,
          },
        },
        preflight.state,
      );
    }

    for (const call of assistantMsg.tool_calls) {
      const toolName = call.function.name;
      toolsUsed.push(toolName);
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }

      let toolResult: unknown;
      try {
        if (!input.userId) {
          throw new Error("Sign in required to run owner tools");
        }
        toolResult = await executeOwnerLlmTool({
          workspaceId: input.workspaceId,
          agentId: input.agentId,
          userId: input.userId,
          toolName,
          args,
        });
        lastToolData = toolResult;
        const meta = extractProposalMeta(toolResult);
        if (meta.proposalId) proposalId = meta.proposalId;
        if (meta.requiresConfirmation) requiresConfirmation = true;
      } catch (err) {
        toolResult = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: stringifyToolResult(toolResult),
      });
    }
  }

  return enrichOwnerReply(
    {
      answer:
        "I reached my planning step limit while gathering data. Ask a more specific question or try again.",
      sources: ["owner_llm", ...toolsUsed],
      suggestedFollowUps: ["What happened on the last call?", "Explain your setup"],
      data: { toolsUsed, iterations },
    },
    preflight.state,
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
      label: "Confirm & put live",
      kind: "versions",
      href: `/agents/${agentId}?section=build`,
    });
  }
  return out.length ? out : undefined;
}
