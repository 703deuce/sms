/**
 * Shared LLM provider chain for product AI features.
 */

export type LlmProvider = {
  id: string;
  apiKey: string;
  baseUrl: string;
  model: string;
};

/** Default OpenAI model for product AI when OPENAI_MODEL is unset. */
export const DEFAULT_OPENAI_MODEL = "gpt-5-nano";

export function providers(): LlmProvider[] {
  const out: LlmProvider[] = [];
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) {
    out.push({
      id: "openai",
      apiKey: openai,
      baseUrl: (
        process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com"
      ).replace(/\/$/, ""),
      model: process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
    });
  }
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
  const generic = process.env.LLM_API_KEY?.trim();
  const genericBase = process.env.LLM_BASE_URL?.trim();
  if (generic && genericBase) {
    out.push({
      id: "llm",
      apiKey: generic,
      baseUrl: genericBase.replace(/\/$/, ""),
      model: process.env.LLM_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
    });
  }
  return out;
}

export function hasLlmConfigured() {
  return providers().length > 0;
}

/** OpenAI newer models reject `max_tokens` — use `max_completion_tokens`. */
export function chatCompletionTokenFields(
  providerId: string,
  model: string,
  maxTokens: number,
): Record<string, number> {
  if (providerId === "openai" && /^gpt-[56]|^o[134]/.test(model)) {
    return { max_completion_tokens: maxTokens };
  }
  return { max_tokens: maxTokens };
}

function isOpenAiReasoningStyleModel(providerId: string, model: string): boolean {
  return providerId === "openai" && /^gpt-[56]|^o[134]/.test(model);
}

/** Merge temperature + token limits; gpt-5/o-series only support default temperature. */
export function chatCompletionBodyExtras(
  providerId: string,
  model: string,
  options?: { temperature?: number; maxTokens?: number },
): Record<string, number> {
  const extras: Record<string, number> = {
    ...chatCompletionTokenFields(providerId, model, options?.maxTokens ?? 2000),
  };
  if (!isOpenAiReasoningStyleModel(providerId, model) && options?.temperature !== undefined) {
    extras.temperature = options.temperature;
  }
  return extras;
}

/** @deprecated Use ownerAmyModelLabel() for Owner Amy runtime. */
export function primaryLlmModelLabel(): string {
  const p = providers()[0];
  return p ? `${p.id}:${p.model}` : "unconfigured";
}
