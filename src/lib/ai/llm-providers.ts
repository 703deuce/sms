/**
 * Shared LLM provider chain for product AI features.
 */

export type LlmProvider = {
  id: string;
  apiKey: string;
  baseUrl: string;
  model: string;
};

export function providers(): LlmProvider[] {
  const out: LlmProvider[] = [];
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

/** @deprecated Use ownerAmyModelLabel() for Owner Amy runtime. */
export function primaryLlmModelLabel(): string {
  const p = providers()[0];
  return p ? `${p.id}:${p.model}` : "unconfigured";
}
