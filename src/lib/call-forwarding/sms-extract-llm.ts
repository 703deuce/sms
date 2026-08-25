/**
 * OpenAI nano completions for Call Forwarding SMS number extraction.
 * Uses gpt-5-nano by default — fast, cheap formatting for E.164 output.
 *
 * Env:
 *   OPENAI_API_KEY — required for LLM fallback path
 *   CALL_FORWARDING_SMS_OPENAI_MODEL — optional, defaults to gpt-5-nano
 *   OPENAI_BASE_URL — optional
 */

export function getCallForwardingSmsOpenAiModel(): string {
  return process.env.CALL_FORWARDING_SMS_OPENAI_MODEL?.trim() || "gpt-5-nano";
}

export async function callForwardingSmsOpenAiCompletion(
  system: string,
  user: string,
  options?: { temperature?: number; maxTokens?: number },
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const baseUrl = (
    process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com"
  ).replace(/\/$/, "");
  const model = getCallForwardingSmsOpenAiModel();
  const isGpt5 = model.startsWith("gpt-5");
  const maxTokens = options?.maxTokens ?? (isGpt5 ? 512 : 256);

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (!isGpt5) {
    body.temperature = options?.temperature ?? 0;
    body.max_tokens = maxTokens;
  } else {
    body.max_completion_tokens = maxTokens;
  }

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI SMS extract ${res.status}: ${errText.slice(0, 240)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content?.trim() || null;
}
