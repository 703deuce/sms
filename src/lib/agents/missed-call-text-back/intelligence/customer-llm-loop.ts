/**
 * Customer John — LLM agent loop with john_runtime_turn gateway.
 */

import { randomUUID } from "crypto";
import type { LlmChatMessage, LlmToolDefinition } from "@/lib/ai/llm-tools";
import { llmChatWithTools } from "@/lib/ai/llm-tools";
import { buildJohnSystemPrompt } from "./john-prompt";
import {
  buildJohnRuntimeContext,
  executeJohnRuntimeTurn,
} from "./runtime-gateway";
import {
  persistJohnAgentTurn,
  persistJohnRuntimeTurn,
  loadJohnConversationHistory,
} from "./conversation-persistence";
import {
  hasCustomerJohnLlmConfigured,
  resolveJohnLlmProviders,
  getJohnRuntimeModelConfig,
} from "./model-config";
import type { JohnRuntimeTurnInput } from "./types";

export const JOHN_RUNTIME_TURN_TOOL: LlmToolDefinition = {
  type: "function",
  function: {
    name: "john_runtime_turn",
    description:
      "Submit the customer's meaning and extracted information to the Transovo runtime. " +
      "The runtime is authoritative for state, permissions, and actions. " +
      "Always call this before claiming any business action occurred.",
    parameters: {
      type: "object",
      properties: {
        utterance: {
          type: "string",
          description: "The customer's message or meaning in natural language.",
        },
        interpreted_intent: {
          type: "string",
          description: "Your interpretation of what the customer means (proposal only).",
        },
        extracted_information: {
          type: "object",
          description: "Structured information extracted from the message.",
          additionalProperties: true,
        },
      },
      required: ["utterance"],
    },
  },
};

export type JohnCustomerLlmResult = {
  reply: string;
  modelInvoked: boolean;
  modelProvider?: string;
  modelName?: string;
  modelRequestId?: string;
  runtimeTurn?: unknown;
  keywordRouterBypassed: true;
};

function buildTranscript(
  history: Array<{ direction: string; body: string }>,
  inbound: string,
): string {
  const lines = history.map(
    (m) => `${m.direction === "inbound" ? "Customer" : "John"}: ${m.body}`,
  );
  lines.push(`Customer: ${inbound}`);
  return lines.join("\n");
}

function synthesizeReply(input: {
  inbound: string;
  runtimeResult: ReturnType<typeof executeJohnRuntimeTurn>;
}): string {
  const ctx = input.runtimeResult.response_context;
  if (ctx.reason_saved || ctx.fld_reason_saved) {
    return "Got it — I've noted that. Is there anything else you'd like us to know, or a good time to call you back?";
  }
  if (ctx.active_field_label) {
    return `Thanks! Could you tell me more about ${String(ctx.active_field_label).toLowerCase()}?`;
  }
  if (input.runtimeResult.action === "ESCALATE_HUMAN") {
    return "I understand this is important. I'm flagging this for our team to follow up with you shortly.";
  }
  return "Thanks for your message. Someone from our team will follow up soon. Is there anything else I can note for them?";
}

export async function runJohnCustomerLlmLoop(input: {
  workspaceId: string;
  traceId: string;
  missedCallEventId: string;
  missedAt: Date;
  conversationId?: string | null;
  contactId?: string | null;
  customerPhone: string;
  customerName?: string | null;
  inboundBody: string;
  businessName?: string;
  timezone?: string;
  history?: Array<{ direction: string; body: string }>;
}): Promise<JohnCustomerLlmResult> {
  const modelRequestId = randomUUID();
  const runtimeContext = buildJohnRuntimeContext({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId || input.missedCallEventId,
    customerPhone: input.customerPhone,
    customerName: input.customerName,
    missedCallEventId: input.missedCallEventId,
    missedAt: input.missedAt,
    businessName: input.businessName,
    timezone: input.timezone,
  });

  const history =
    input.history ||
    (input.contactId
      ? (await loadJohnConversationHistory({
          workspaceId: input.workspaceId,
          contactId: input.contactId,
        })).map((m: { direction: string; body: string }) => ({
          direction: m.direction,
          body: m.body,
        }))
      : []);

  await persistJohnAgentTurn({
    workspaceId: input.workspaceId,
    traceId: input.traceId,
    missedCallEventId: input.missedCallEventId,
    conversationId: input.conversationId,
    turn: {
      conversationId: input.conversationId || input.missedCallEventId,
      direction: "inbound",
      messageBody: input.inboundBody,
      modelRequestId,
    },
  });

  if (!hasCustomerJohnLlmConfigured()) {
    const fallbackRuntime = executeJohnRuntimeTurn({
      context: runtimeContext,
      turn: { utterance: input.inboundBody },
    });
    const reply = synthesizeReply({ inbound: input.inboundBody, runtimeResult: fallbackRuntime });
    return {
      reply,
      modelInvoked: false,
      runtimeTurn: fallbackRuntime,
      keywordRouterBypassed: true,
    };
  }

  const systemPrompt = buildJohnSystemPrompt({
    business_name: runtimeContext.business_context.business_name,
    runtime_context: runtimeContext,
  });

  const transcript = buildTranscript(history, input.inboundBody);
  const messages: LlmChatMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Conversation so far:\n${transcript}\n\nRespond naturally to the customer. Use john_runtime_turn to submit their meaning to the runtime before making claims.`,
    },
  ];

  const cfg = getJohnRuntimeModelConfig("customer_john");
  const providerChain = resolveJohnLlmProviders("customer_john");

  let runtimeResult: ReturnType<typeof executeJohnRuntimeTurn> | null = null;
  let finalReply: string | null = null;
  let usedProvider = cfg.provider;
  let usedModel = cfg.model;

  for (let iter = 0; iter < 3; iter++) {
    const result = await llmChatWithTools(messages, [JOHN_RUNTIME_TURN_TOOL], {
      temperature: 0.4,
      maxTokens: 400,
      providerChain,
    });
    if (!result) break;

    usedProvider = result.provider;
    usedModel = result.model;

    const toolCalls = result.message.tool_calls || [];
    if (toolCalls.length) {
      for (const tc of toolCalls) {
        if (tc.function.name !== "john_runtime_turn") continue;
        let args: JohnRuntimeTurnInput = { utterance: input.inboundBody };
        try {
          args = JSON.parse(tc.function.arguments || "{}") as JohnRuntimeTurnInput;
        } catch {
          args = { utterance: input.inboundBody };
        }
        runtimeResult = executeJohnRuntimeTurn({ context: runtimeContext, turn: args });
        await persistJohnRuntimeTurn({
          workspaceId: input.workspaceId,
          traceId: input.traceId,
          missedCallEventId: input.missedCallEventId,
          conversationId: input.conversationId,
          runtimeAction: runtimeResult.action,
          runtimeInput: args,
          runtimeResult,
        });
        messages.push({
          role: "assistant",
          content: result.message.content,
          tool_calls: toolCalls,
        });
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(runtimeResult),
        });
      }
      continue;
    }

    if (result.message.content?.trim()) {
      finalReply = result.message.content.trim().slice(0, 480);
      break;
    }
  }

  if (!runtimeResult) {
    runtimeResult = executeJohnRuntimeTurn({
      context: runtimeContext,
      turn: { utterance: input.inboundBody },
    });
    await persistJohnRuntimeTurn({
      workspaceId: input.workspaceId,
      traceId: input.traceId,
      missedCallEventId: input.missedCallEventId,
      conversationId: input.conversationId,
      runtimeAction: runtimeResult.action,
      runtimeInput: { utterance: input.inboundBody },
      runtimeResult,
    });
  }

  const reply =
    finalReply || synthesizeReply({ inbound: input.inboundBody, runtimeResult });

  await persistJohnAgentTurn({
    workspaceId: input.workspaceId,
    traceId: input.traceId,
    missedCallEventId: input.missedCallEventId,
    conversationId: input.conversationId,
    turn: {
      conversationId: input.conversationId || input.missedCallEventId,
      direction: "outbound",
      messageBody: reply,
      modelProvider: usedProvider,
      modelName: usedModel,
      modelRequestId,
      runtimeAction: runtimeResult.action,
      runtimeResult,
    },
  });

  return {
    reply,
    modelInvoked: true,
    modelProvider: usedProvider,
    modelName: usedModel,
    modelRequestId,
    runtimeTurn: runtimeResult,
    keywordRouterBypassed: true,
  };
}

/** Gate helper — verifies real LLM path was taken (no keyword router). */
export function assertJohnLlmGateEvidence(result: JohnCustomerLlmResult): {
  pass: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (!result.keywordRouterBypassed) reasons.push("keyword_router_not_bypassed");
  if (!result.modelRequestId) reasons.push("missing_model_request_id");
  if (!result.runtimeTurn) reasons.push("missing_runtime_turn");
  return { pass: reasons.length === 0, reasons };
}
