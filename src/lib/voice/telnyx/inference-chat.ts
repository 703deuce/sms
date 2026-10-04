import "server-only";

import { assertTelnyxConfigured, getTelnyxApiBaseUrl } from "@/lib/messaging/telnyx/config";

const DEFAULT_VOICEMAIL_SUMMARY_MODEL =
  process.env.TELNYX_VOICEMAIL_SUMMARY_MODEL?.trim() ||
  "meta-llama/Meta-Llama-3.1-8B-Instruct";

export function isTelnyxInferenceChatConfigured(): boolean {
  return Boolean(process.env.TELNYX_API_KEY?.trim());
}

/**
 * OpenAI-compatible chat completions on Telnyx Inference.
 * @see https://developers.telnyx.com/api-reference/openai-chat/create-a-chat-completion-openai-compatible
 */
export async function telnyxInferenceChatCompletion(
  system: string,
  user: string,
  options?: { temperature?: number; maxTokens?: number; model?: string },
): Promise<{ content: string; model: string } | null> {
  const { apiKey } = assertTelnyxConfigured();
  const base = getTelnyxApiBaseUrl();
  const model = options?.model?.trim() || DEFAULT_VOICEMAIL_SUMMARY_MODEL;
  const maxTokens = options?.maxTokens ?? 256;

  const res = await fetch(`${base}/ai/openai/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: options?.temperature ?? 0.2,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Telnyx chat ${res.status}: ${errText.slice(0, 400)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) return null;
  return { content, model };
}
