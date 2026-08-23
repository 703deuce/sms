import { createId } from "@/lib/supabase/id";
import { llmChatWithTools, type LlmChatMessage } from "@/lib/ai/llm-tools";
import {
  AI_ROUTING_MAX_ITERATIONS,
  AI_ROUTING_TIMEOUT_MS,
  resolveAiRoutingLlmProviders,
  getAiRoutingModelConfig,
} from "./model-config";
import { buildAiRoutingSystemPrompt, AI_ROUTING_PROMPT_VERSION } from "./prompt";
import {
  AI_ROUTING_READ_TOOLS,
  executeAiRoutingTool,
  parseSubmitPayload,
  type AiRoutingToolContext,
} from "./tools";
import {
  buildAiRoutingFlowContext,
  buildAiRoutingWorkspaceContext,
  loadAiRoutingDestinations,
} from "./context-builder";
import type { AiRoutingInvocationRecord, AiRoutingProposalPayload } from "./types";

function stringifyToolResult(data: Record<string, unknown>): string {
  return JSON.stringify({ status: "ok", data });
}

export async function runAiRoutingLlmLoop(
  ctx: AiRoutingToolContext,
  userRequest: string,
): Promise<{
  payload?: AiRoutingProposalPayload;
  clarificationQuestion?: string;
  record: AiRoutingInvocationRecord;
  error?: string;
}> {
  const providerChain = resolveAiRoutingLlmProviders();
  const requestId = createId();
  const startedAt = Date.now();
  const toolCalls: string[] = [];
  const cfg = getAiRoutingModelConfig();

  if (!providerChain.length) {
    return {
      record: {
        requestId,
        runtimeId: "smart_routing_ai",
        model: "none",
        promptVersion: AI_ROUTING_PROMPT_VERSION,
        toolCalls: [],
        latencyMs: 0,
      },
      error: "AI provider not configured",
    };
  }

  const workspace = await buildAiRoutingWorkspaceContext(ctx.workspaceId);
  const destinations = await loadAiRoutingDestinations(ctx.workspaceId);
  const flow = ctx.flowId
    ? await buildAiRoutingFlowContext(ctx.workspaceId, ctx.flowId)
    : null;

  const system = buildAiRoutingSystemPrompt({
    workspace,
    flow,
    destinations,
    userRequest,
  });

  const messages: LlmChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: userRequest },
  ];

  let submitPayload: AiRoutingProposalPayload | null = null;
  let clarificationQuestion: string | undefined;
  let lastModel = `${cfg.provider}/${cfg.model}`;
  let iterations = 0;

  while (iterations < AI_ROUTING_MAX_ITERATIONS) {
    iterations += 1;
    if (Date.now() - startedAt > AI_ROUTING_TIMEOUT_MS) {
      return {
        record: {
          requestId,
          runtimeId: "smart_routing_ai",
          model: lastModel,
          promptVersion: AI_ROUTING_PROMPT_VERSION,
          toolCalls,
          latencyMs: Date.now() - startedAt,
        },
        error: "AI Routing Assistant timed out",
      };
    }

    const response = await llmChatWithTools(messages, AI_ROUTING_READ_TOOLS, {
      temperature: 0.15,
      maxTokens: 4000,
      providerChain,
    });

    if (!response) {
      return {
        record: {
          requestId,
          runtimeId: "smart_routing_ai",
          model: lastModel,
          promptVersion: AI_ROUTING_PROMPT_VERSION,
          toolCalls,
          latencyMs: Date.now() - startedAt,
        },
        error: "AI returned no response",
      };
    }

    lastModel = `${response.provider}:${response.model}`;
    messages.push({
      role: "assistant",
      content: response.message.content,
      tool_calls: response.message.tool_calls,
    });

    if (!response.message.tool_calls?.length) break;

    for (const call of response.message.tool_calls) {
      const name = call.function.name;
      toolCalls.push(name);
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }

      if (name === "submit_routing_proposal") {
        submitPayload = parseSubmitPayload(args);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: stringifyToolResult({ accepted: true }),
        });
        continue;
      }

      if (name === "ask_clarification") {
        clarificationQuestion = String(args.question ?? "");
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: stringifyToolResult({ accepted: true }),
        });
        continue;
      }

      if (name === "validate_routing_proposal") {
        const result = await executeAiRoutingTool(name, args, ctx);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: stringifyToolResult(result),
        });
        continue;
      }

      const toolResult = await executeAiRoutingTool(name, args, ctx);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: stringifyToolResult(toolResult),
      });
    }

    if (submitPayload || clarificationQuestion) break;
  }

  const record: AiRoutingInvocationRecord = {
    requestId,
    runtimeId: "smart_routing_ai",
    model: lastModel,
    promptVersion: AI_ROUTING_PROMPT_VERSION,
    toolCalls,
    latencyMs: Date.now() - startedAt,
  };

  return {
    payload: submitPayload ?? undefined,
    clarificationQuestion,
    record,
  };
}
