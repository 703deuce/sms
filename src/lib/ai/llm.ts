/**
 * Multi-provider chat completions for Transovo product AI features.
 *
 * Tries providers in order based on available env keys:
 *   1. DeepSeek  (DEEPSEEK_API_KEY / DEEPSEEK_MODEL)
 *   2. OpenAI    (OPENAI_API_KEY / OPENAI_MODEL)
 *   3. OpenAI-compatible base URL (LLM_API_KEY + LLM_BASE_URL + LLM_MODEL)
 */

export type LlmChatResult = {
  content: string;
  provider: string;
  model: string;
};

type Provider = {
  id: string;
  apiKey: string;
  baseUrl: string;
  model: string;
};

function providers(): Provider[] {
  const out: Provider[] = [];
  const deepseek = process.env.DEEPSEEK_API_KEY?.trim();
  if (deepseek) {
    out.push({
      id: "deepseek",
      apiKey: deepseek,
      baseUrl: (
        process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com"
      ).replace(/\/$/, ""),
      model: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat",
    });
  }
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) {
    out.push({
      id: "openai",
      apiKey: openai,
      baseUrl: (
        process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com"
      ).replace(/\/$/, ""),
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    });
  }
  const generic = process.env.LLM_API_KEY?.trim();
  const genericBase = process.env.LLM_BASE_URL?.trim();
  if (generic && genericBase) {
    out.push({
      id: "llm",
      apiKey: generic,
      baseUrl: genericBase.replace(/\/$/, ""),
      model: process.env.LLM_MODEL?.trim() || "gpt-4o-mini",
    });
  }
  return out;
}

export function hasLlmConfigured() {
  return providers().length > 0;
}

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
