/**
 * Multi-provider chat completions for Transovo product AI features.
 *
 * Tries providers in order based on available env keys:
 *   1. OpenAI    (OPENAI_API_KEY / OPENAI_MODEL — default gpt-5-nano)
 *   2. DeepSeek  (DEEPSEEK_API_KEY / DEEPSEEK_MODEL) — fallback when configured
 *   3. OpenAI-compatible base URL (LLM_API_KEY + LLM_BASE_URL + LLM_MODEL)
 */

import { hasLlmConfigured, primaryLlmModelLabel, providers } from "@/lib/ai/llm-providers";

export type LlmChatResult = {
  content: string;
  provider: string;
  model: string;
};

export { hasLlmConfigured, primaryLlmModelLabel };

export async function llmChatCompletion(
  system: string,
  user: string,
  options?: { temperature?: number; maxTokens?: number },
): Promise<LlmChatResult | null> {
  const list = providers();
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
          temperature: options?.temperature ?? 0.3,
          max_tokens: options?.maxTokens ?? 2000,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${p.id} ${res.status}: ${errText.slice(0, 240)}`);
      }
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error(`${p.id} returned empty content`);
      return { content, provider: p.id, model: p.model };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn("[llm]", lastError.message);
    }
  }
  if (lastError) throw lastError;
  return null;
}

/** Extract first JSON object/array from an LLM response. */
export function extractJsonFromLlm(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return JSON.parse(fenced[1].trim());
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("No JSON object found in model response");
}
