import "server-only";

import { getOpenAiApiKey, getOpenAiModel } from "@/lib/ai/openai";
import { chatCompletionBodyExtras } from "@/lib/ai/llm-providers";

export type ChatMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | { role: "tool"; tool_call_id: string; content: string };

export async function openAiChatWithTools(input: {
  messages: ChatMessage[];
  tools: Array<{
    type: "function";
    function: {
      name: string;
      description: string | null;
      parameters: Record<string, unknown>;
    };
  }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<{
  message: {
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }>;
  };
} | null> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) return null;

  const model = input.model?.trim() || getOpenAiModel();
  const toolExtras: Record<string, string> = {};
  // gpt-6-luna rejects tool calls unless reasoning_effort is explicitly none on chat/completions.
  if (/gpt-6/i.test(model)) {
    toolExtras.reasoning_effort = "none";
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      ...toolExtras,
      ...chatCompletionBodyExtras("openai", model, {
        temperature: input.temperature ?? 0.2,
        maxTokens: input.maxTokens ?? 900,
      }),
      messages: input.messages,
      tools: input.tools,
      tool_choice: "auto",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: ChatMessage & { tool_calls?: unknown } }>;
  };
  const message = json.choices?.[0]?.message;
  if (!message) return null;
  return {
    message: {
      content: typeof message.content === "string" ? message.content : null,
      tool_calls: message.tool_calls as
        | Array<{
            id: string;
            type: "function";
            function: { name: string; arguments: string };
          }>
        | undefined,
    },
  };
}

/** Structured JSON response (Context Agent — no tools). */
export async function openAiChatJsonResponse(input: {
  messages: ChatMessage[];
  model?: string;
  reasoningEffort?: "none" | "low" | "medium" | "high";
  jsonSchema: Record<string, unknown>;
  schemaName?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<unknown | null> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) return null;

  const model = input.model?.trim() || getOpenAiModel();
  const toolExtras: Record<string, string> = {};
  if (/gpt-6/i.test(model)) {
    toolExtras.reasoning_effort = input.reasoningEffort ?? "medium";
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      ...toolExtras,
      ...chatCompletionBodyExtras("openai", model, {
        temperature: input.temperature ?? 0.1,
        maxTokens: input.maxTokens ?? 800,
      }),
      messages: input.messages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: input.schemaName ?? "ar_sms_context_interpretation",
          strict: true,
          schema: input.jsonSchema,
        },
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  }
}
