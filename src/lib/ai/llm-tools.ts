/**
 * OpenAI-compatible chat completions with tool calling.
 * Uses the same provider chain as llm.ts.
 */

import { providers, type LlmProvider } from "@/lib/ai/llm-providers";

export type LlmToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type LlmChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: LlmToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type LlmToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type LlmToolChatResult = {
  message: {
    role: "assistant";
    content: string | null;
    tool_calls?: LlmToolCall[];
  };
  provider: string;
  model: string;
  finishReason?: string;
};

export async function llmChatWithTools(
  messages: LlmChatMessage[],
  tools: LlmToolDefinition[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    toolChoice?: "auto" | "none";
    providerChain?: LlmProvider[];
  },
): Promise<LlmToolChatResult | null> {
  const list = options?.providerChain?.length ? options.providerChain : providers();
  if (!list.length) return null;

  let lastError: Error | null = null;
  for (const p of list) {
    try {
      const res = await fetch(`${p.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${p.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: p.model,
          temperature: options?.temperature ?? 0.2,
          max_tokens: options?.maxTokens ?? 2500,
          messages,
          tools: tools.length ? tools : undefined,
          tool_choice: tools.length ? options?.toolChoice || "auto" : undefined,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${p.id} ${res.status}: ${errText.slice(0, 300)}`);
      }
      const json = (await res.json()) as {
        choices?: Array<{
          finish_reason?: string;
          message?: {
            role?: string;
            content?: string | null;
            tool_calls?: LlmToolCall[];
          };
        }>;
      };
      const choice = json.choices?.[0];
      const message = choice?.message;
      if (!message) throw new Error(`${p.id} returned no message`);
      return {
        message: {
          role: "assistant",
          content: message.content?.trim() || null,
          tool_calls: message.tool_calls,
        },
        provider: p.id,
        model: p.model,
        finishReason: choice?.finish_reason,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn("[llm-tools]", lastError.message);
    }
  }
  if (lastError) throw lastError;
  return null;
}
