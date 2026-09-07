/**
 * John LLM runtime model configuration.
 */

import { providers, type LlmProvider } from "@/lib/ai/llm-providers";
import type { JohnRuntimeId } from "./types";

export type JohnRuntimeModelConfig = {
  provider: string;
  model: string;
  fallbackProvider?: string;
  fallbackModel?: string;
};

const DEFAULTS: Record<JohnRuntimeId, JohnRuntimeModelConfig> = {
  customer_john: {
    provider: "openai",
    model: "gpt-5-nano",
    fallbackProvider: "deepseek",
    fallbackModel: "deepseek-chat",
  },
  mctb_workflow_architect: {
    provider: "openai",
    model: "gpt-5-nano",
    fallbackProvider: "deepseek",
    fallbackModel: "deepseek-chat",
  },
};

function envKey(runtime: JohnRuntimeId, suffix: string): string {
  const prefix =
    runtime === "customer_john" ? "CUSTOMER_JOHN" : "MCTB_WORKFLOW_ARCHITECT";
  return `${prefix}_${suffix}`;
}

export function getJohnRuntimeModelConfig(runtime: JohnRuntimeId): JohnRuntimeModelConfig {
  const defaults = DEFAULTS[runtime];
  return {
    provider: process.env[envKey(runtime, "PROVIDER")]?.trim() || defaults.provider,
    model: process.env[envKey(runtime, "MODEL")]?.trim() || defaults.model,
    fallbackProvider:
      process.env[envKey(runtime, "FALLBACK_PROVIDER")]?.trim() ||
      defaults.fallbackProvider,
    fallbackModel:
      process.env[envKey(runtime, "FALLBACK_MODEL")]?.trim() || defaults.fallbackModel,
  };
}

function findProvider(id: string, model: string): LlmProvider | null {
  const all = providers();
  const match = all.find((p) => p.id === id);
  if (!match) return null;
  return { ...match, model };
}

export function resolveJohnLlmProviders(runtime: JohnRuntimeId): LlmProvider[] {
  const cfg = getJohnRuntimeModelConfig(runtime);
  const chain: LlmProvider[] = [];
  const primary = findProvider(cfg.provider, cfg.model);
  if (primary) chain.push(primary);
  if (cfg.fallbackProvider && cfg.fallbackModel) {
    const fb = findProvider(cfg.fallbackProvider, cfg.fallbackModel);
    if (fb && fb.id !== primary?.id) chain.push(fb);
  }
  return chain;
}

export function hasCustomerJohnLlmConfigured(): boolean {
  return resolveJohnLlmProviders("customer_john").length > 0;
}

export function hasMctbArchitectLlmConfigured(): boolean {
  return resolveJohnLlmProviders("mctb_workflow_architect").length > 0;
}
