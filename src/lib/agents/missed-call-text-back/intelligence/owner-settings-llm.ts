/**
 * Owner Amy → John settings — LLM interpretation (no keyword routing).
 * Scalar settings like delay_seconds are extracted via real model invocation.
 */

import { randomUUID } from "crypto";
import { llmChatWithTools, type LlmChatMessage, type LlmToolDefinition } from "@/lib/ai/llm-tools";
import { resolveJohnLlmProviders, hasCustomerJohnLlmConfigured } from "./model-config";
import type { OwnerJohnSettingChange } from "./types";
import { updateMissedCallTextConfig } from "../config";

const INTERPRET_OWNER_SETTING_TOOL: LlmToolDefinition = {
  type: "function",
  function: {
    name: "interpret_john_setting_change",
    description:
      "Extract structured John/MCTB configuration change from owner natural language.",
    parameters: {
      type: "object",
      properties: {
        change_type: {
          type: "string",
          enum: [
            "MCTB_DELAY_UPDATE",
            "MCTB_MESSAGE_UPDATE",
            "MCTB_ENABLED_UPDATE",
            "MCTB_WORKFLOW_CHANGE",
            "UNKNOWN",
          ],
        },
        delay_seconds: {
          type: "number",
          description: "Delay in seconds before texting after missed call.",
        },
        initial_message: { type: "string" },
        enabled: { type: "boolean" },
        workflow_request: {
          type: "string",
          description: "Full workflow change request for Workflow Architect.",
        },
      },
      required: ["change_type"],
    },
  },
};

export type OwnerJohnLlmInterpretResult = {
  change: OwnerJohnSettingChange;
  modelInvoked: boolean;
  modelRequestId: string;
  modelProvider?: string;
  modelName?: string;
};

/**
 * Interpret owner natural language into structured John setting change via LLM.
 * No keyword/regex routing — model must extract delay_seconds etc.
 */
export async function interpretOwnerJohnSettingRequest(
  naturalLanguage: string,
): Promise<OwnerJohnLlmInterpretResult> {
  const modelRequestId = randomUUID();

  if (!hasCustomerJohnLlmConfigured()) {
    return {
      change: { change_type: "UNKNOWN", target_agent: "john" },
      modelInvoked: false,
      modelRequestId,
    };
  }

  const messages: LlmChatMessage[] = [
    {
      role: "system",
      content: `You interpret business owner requests about John (missed-call text-back agent) settings.
Extract structured changes only. Examples:
- "Wait five minutes before texting" → MCTB_DELAY_UPDATE, delay_seconds=300
- "Text them right away" → MCTB_DELAY_UPDATE, delay_seconds=0
- "Maybe let the phone cool off for a few minutes" → MCTB_DELAY_UPDATE, delay_seconds=180
- Flow logic changes → MCTB_WORKFLOW_CHANGE with workflow_request
Never use keyword matching — understand meaning.`,
    },
    { role: "user", content: naturalLanguage },
  ];

  const result = await llmChatWithTools(messages, [INTERPRET_OWNER_SETTING_TOOL], {
    temperature: 0.1,
    maxTokens: 300,
    providerChain: resolveJohnLlmProviders("customer_john"),
  });

  let change: OwnerJohnSettingChange = {
    change_type: "UNKNOWN",
    target_agent: "john",
  };

  if (result?.message.tool_calls?.length) {
    const tc = result.message.tool_calls[0];
    try {
      const parsed = JSON.parse(tc.function.arguments || "{}") as OwnerJohnSettingChange;
      change = { ...parsed, target_agent: "john" };
    } catch {
      // keep UNKNOWN
    }
  }

  return {
    change,
    modelInvoked: Boolean(result),
    modelRequestId,
    modelProvider: result?.provider,
    modelName: result?.model,
  };
}

/** Apply owner setting change after LLM interpretation. */
export async function applyOwnerJohnSettingChange(input: {
  workspaceId: string;
  naturalLanguage: string;
  actor?: string;
  toolCallId?: string;
}) {
  const interpreted = await interpretOwnerJohnSettingRequest(input.naturalLanguage);
  const { change } = interpreted;

  if (change.change_type === "MCTB_DELAY_UPDATE" && change.delay_seconds !== undefined) {
    const result = await updateMissedCallTextConfig({
      workspaceId: input.workspaceId,
      patch: { delay_seconds: change.delay_seconds },
      actor: input.actor,
      requestedNaturalLanguage: input.naturalLanguage,
      toolCallId: input.toolCallId || interpreted.modelRequestId,
      source: "owner_amy_llm",
    });
    return {
      ok: true as const,
      interpreted,
      result,
      receipt: {
        change_type: change.change_type,
        delay_seconds: result.config.delaySeconds,
        model_request_id: interpreted.modelRequestId,
      },
    };
  }

  if (change.change_type === "MCTB_MESSAGE_UPDATE" && change.initial_message) {
    const result = await updateMissedCallTextConfig({
      workspaceId: input.workspaceId,
      patch: { initial_message: change.initial_message },
      actor: input.actor,
      requestedNaturalLanguage: input.naturalLanguage,
      toolCallId: input.toolCallId || interpreted.modelRequestId,
      source: "owner_amy_llm",
    });
    return { ok: true as const, interpreted, result };
  }

  if (change.change_type === "MCTB_ENABLED_UPDATE" && change.enabled !== undefined) {
    const result = await updateMissedCallTextConfig({
      workspaceId: input.workspaceId,
      patch: { enabled: change.enabled },
      actor: input.actor,
      requestedNaturalLanguage: input.naturalLanguage,
      toolCallId: input.toolCallId || interpreted.modelRequestId,
      source: "owner_amy_llm",
    });
    return { ok: true as const, interpreted, result };
  }

  if (change.change_type === "MCTB_WORKFLOW_CHANGE" && change.workflow_request) {
    return {
      ok: false as const,
      interpreted,
      requires_architect: true,
      workflow_request: change.workflow_request,
    };
  }

  return { ok: false as const, interpreted, error: "could_not_interpret" };
}

/** Test gate — no keyword router in source for delay parsing. */
export function assertNoKeywordDelayRouter(): { pass: boolean; detail: string } {
  const src = interpretOwnerJohnSettingRequest.toString();
  const hasKeywordRouter =
    /includes\s*\(\s*["']five minutes["']\s*\)/.test(src) ||
    /text\.includes\s*\(/.test(src);
  return {
    pass: !hasKeywordRouter,
    detail: hasKeywordRouter ? "keyword_router_detected" : "no_keyword_router",
  };
}
