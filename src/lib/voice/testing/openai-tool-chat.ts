import { getOpenAiApiKey } from "@/lib/ai/openai";
import { resolveVoiceLlmPreset } from "@/lib/voice/runtime-provider/llm-presets";

export type OpenAiChatMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | { role: "tool"; tool_call_id: string; content: string };

export type OpenAiFunctionTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type OpenAiChatResult = {
  message: OpenAiChatMessage;
  finishReason: string | null;
};

function resolveModel(): string {
  const preset = resolveVoiceLlmPreset(process.env.VOICE_LLM_PRESET);
  if (preset?.provider === "openai") return preset.model;
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

export async function openAiChatWithTools(input: {
  messages: OpenAiChatMessage[];
  tools: OpenAiFunctionTool[];
  temperature?: number;
}): Promise<OpenAiChatResult> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for LLM-driven conversation simulation");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: resolveModel(),
      temperature: input.temperature ?? 0.3,
      messages: input.messages,
      tools: input.tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      })),
      tool_choice: "auto",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${errText.slice(0, 400)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{
      finish_reason?: string;
      message?: OpenAiChatMessage;
    }>;
  };

  const choice = json.choices?.[0];
  if (!choice?.message) {
    throw new Error("OpenAI returned no message");
  }

  return {
    message: choice.message,
    finishReason: choice.finish_reason || null,
  };
}
