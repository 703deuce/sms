/**
 * Explicit LLM configuration for Smart Routing AI assistant.
 * pragma: allowlist secret
 */

import { providers, type LlmProvider } from "@/lib/ai/llm-providers";

export type AiRoutingRuntime = "smart_routing_ai";

export type RuntimeModelConfig = {
  provider: string;
  model: string;
  fallbackProvider?: string;
  fallbackModel?: string;
};

const DEFAULTS: RuntimeModelConfig = {
  provider: "deepseek",
  model: "deepseek-chat",
  fallbackProvider: "openai",
  fallbackModel: "gpt-4o-mini",
};

export function getAiRoutingModelConfig(): RuntimeModelConfig {
  return {
    provider:
      process.env.SMART_ROUTING_AI_PROVIDER?.trim() || DEFAULTS.provider,
    model: process.env.SMART_ROUTING_AI_MODEL?.trim() || DEFAULTS.model,
    fallbackProvider:
      process.env.SMART_ROUTING_AI_FALLBACK_PROVIDER?.trim() ||
      DEFAULTS.fallbackProvider,
    fallbackModel:
      process.env.SMART_ROUTING_AI_FALLBACK_MODEL?.trim() ||
      DEFAULTS.fallbackModel,
  };
}

function findProvider(id: string, model: string): LlmProvider | null {
  const all = providers();
  const match = all.find((p) => p.id === id);
  if (!match) return null;
  return { ...match, model };
}

export function resolveAiRoutingLlmProviders(): LlmProvider[] {
  const cfg = getAiRoutingModelConfig();
  const chain: LlmProvider[] = [];
  const primary = findProvider(cfg.provider, cfg.model);
  if (primary) chain.push(primary);
  if (cfg.fallbackProvider && cfg.fallbackModel) {
    const fallback = findProvider(cfg.fallbackProvider, cfg.fallbackModel);
    if (fallback && !chain.some((p) => p.id === fallback.id)) {
      chain.push(fallback);
    }
  }
  return chain;
}

export function hasAiRoutingLlmConfigured(): boolean {
  return resolveAiRoutingLlmProviders().length > 0;
}

export const AI_ROUTING_MAX_TOKENS = Number(
  process.env.SMART_ROUTING_AI_MAX_TOKENS || "4000",
);
export const AI_ROUTING_MAX_ITERATIONS = Number(
  process.env.SMART_ROUTING_AI_MAX_ITERATIONS || "6",
);
export const AI_ROUTING_TIMEOUT_MS = Number(
  process.env.SMART_ROUTING_AI_TIMEOUT_MS || "60000",
);
