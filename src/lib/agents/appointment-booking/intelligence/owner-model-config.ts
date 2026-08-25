/**
 * Explicit per-runtime LLM configuration — no silent "first API key found" selection.
 */

import { providers, type LlmProvider } from "@/lib/ai/llm-providers";

export type AmyLlmRuntime =
  | "owner_amy"
  | "caller_amy"
  | "workflow_architect"
  | "diagnostic";

export type RuntimeModelConfig = {
  provider: string;
  model: string;
  fallbackProvider?: string;
  fallbackModel?: string;
};

const DEFAULTS: Record<AmyLlmRuntime, RuntimeModelConfig> = {
  owner_amy: {
    provider: "deepseek",
    model: "deepseek-chat",
    fallbackProvider: "openai",
    fallbackModel: "gpt-4o-mini",
  },
  caller_amy: {
    provider: "telnyx",
    model: "anthropic/claude-haiku-4-5",
  },
  workflow_architect: {
    provider: "deepseek",
    model: "deepseek-chat",
    fallbackProvider: "openai",
    fallbackModel: "gpt-4o-mini",
  },
  diagnostic: {
    provider: "deepseek",
    model: "deepseek-chat",
    fallbackProvider: "openai",
    fallbackModel: "gpt-4o-mini",
  },
};

function envKey(runtime: AmyLlmRuntime, suffix: string): string {
  const prefix =
    runtime === "owner_amy"
      ? "OWNER_AMY"
      : runtime === "caller_amy"
        ? "CALLER_AMY"
        : runtime === "workflow_architect"
          ? "WORKFLOW_ARCHITECT"
          : "DIAGNOSTIC";
  return `${prefix}_${suffix}`;
}

export function getRuntimeModelConfig(runtime: AmyLlmRuntime): RuntimeModelConfig {
  const defaults = DEFAULTS[runtime];
  return {
    provider:
      process.env[envKey(runtime, "PROVIDER")]?.trim() || defaults.provider,
    model: process.env[envKey(runtime, "MODEL")]?.trim() || defaults.model,
    fallbackProvider:
      process.env[envKey(runtime, "FALLBACK_PROVIDER")]?.trim() ||
      defaults.fallbackProvider,
    fallbackModel:
      process.env[envKey(runtime, "FALLBACK_MODEL")]?.trim() ||
      defaults.fallbackModel,
  };
}

function findProvider(id: string, model: string): LlmProvider | null {
  const all = providers();
  const match = all.find((p) => p.id === id);
  if (!match) return null;
  return { ...match, model };
}

/** Resolve ordered provider chain for a runtime from explicit config. */
export function resolveLlmProvidersForRuntime(runtime: AmyLlmRuntime): LlmProvider[] {
  if (runtime === "caller_amy") return [];

  const cfg = getRuntimeModelConfig(runtime);
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

export function hasOwnerAmyLlmConfigured(): boolean {
  return resolveLlmProvidersForRuntime("owner_amy").length > 0;
}

export function ownerAmyModelLabel(): string {
  const cfg = getRuntimeModelConfig("owner_amy");
  const chain = resolveLlmProvidersForRuntime("owner_amy");
  if (!chain.length) return "unconfigured";
  const p = chain[0];
  return `${p.id}/${p.model} (configured: ${cfg.provider}/${cfg.model})`;
}

export type OwnerAmyRuntimeMode =
  | { mode: "llm_agent"; provider: string; model: string; fallback?: string }
  | { mode: "limited_fallback"; reason: string };

export function getOwnerAmyRuntimeMode(): OwnerAmyRuntimeMode {
  const chain = resolveLlmProvidersForRuntime("owner_amy");
  if (!chain.length) {
    return {
      mode: "limited_fallback",
      reason: "No LLM provider configured for Owner Amy runtime",
    };
  }
  const cfg = getRuntimeModelConfig("owner_amy");
  const p = chain[0];
  return {
    mode: "llm_agent",
    provider: p.id,
    model: p.model,
    fallback:
      cfg.fallbackProvider && cfg.fallbackModel
        ? `${cfg.fallbackProvider}/${cfg.fallbackModel}`
        : undefined,
  };
}
