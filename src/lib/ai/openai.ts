/**
 * OpenAI Chat Completions helper.
 *
 * Env:
 *   OPENAI_API_KEY — required for live LLM responses
 *   OPENAI_MODEL   — optional, defaults to gpt-5-nano
 */

export function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY?.trim() || "";
}

export function getOpenAiModel() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-5-nano";
}

export async function openAiChatCompletion(
  system: string,
  user: string,
  options?: { temperature?: number; maxTokens?: number; model?: string },
): Promise<string | null> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) return null;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options?.model?.trim() || getOpenAiModel(),
      temperature: options?.temperature ?? 0.4,
      max_tokens: options?.maxTokens ?? 800,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content?.trim() || null;
}
