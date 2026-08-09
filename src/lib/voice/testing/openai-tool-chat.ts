import { providers } from "@/lib/ai/llm-providers";
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

function resolveLlmConfig(): { apiKey: string; baseUrl: string; model: string } {
  const preset = resolveVoiceLlmPreset(process.env.VOICE_LLM_PRESET);
  if (preset?.provider === "openai") {
    const openai = providers().find((p) => p.id === "openai");
    if (openai) return openai;
  }

  const chain = providers();
  if (chain.length) return chain[0]!;

  throw new Error(
    "No LLM configured — set OPENAI_API_KEY or DEEPSEEK_API_KEY for conversation simulation",
  );
}

export async function openAiChatCompletion(input: {
  messages: OpenAiChatMessage[];
  temperature?: number;
}): Promise<OpenAiChatResult> {
  const llm = resolveLlmConfig();
  const res = await fetch(`${llm.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${llm.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: llm.model,
      temperature: input.temperature ?? 0.4,
      messages: input.messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM API ${res.status}: ${errText.slice(0, 400)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ finish_reason?: string; message?: OpenAiChatMessage }>;
  };
  const choice = json.choices?.[0];
  if (!choice?.message) throw new Error("LLM returned no message");
  return { message: choice.message, finishReason: choice.finish_reason || null };
}

export async function openAiChatWithTools(input: {
  messages: OpenAiChatMessage[];
  tools: OpenAiFunctionTool[];
  temperature?: number;
}): Promise<OpenAiChatResult> {
  const llm = resolveLlmConfig();

  const res = await fetch(`${llm.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${llm.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: llm.model,
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
