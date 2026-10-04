/**
 * Canonical structured JSON LLM for MCTB Lead Recovery + AI Booking semantics.
 * Product default: DeepSeek deepseek-chat (no keyword fallbacks).
 */
import { extractJsonFromLlm, llmChatCompletion } from "@/lib/ai/llm";
import { getOpenAiApiKey } from "@/lib/ai/openai";
import { providers } from "@/lib/ai/llm-providers";

export type MctbSemanticLlmProvider = "deepseek" | "openai" | string;

export function mctbSemanticModelId(): string {
  return (
    process.env.LEAD_RECOVERY_LLM_MODEL?.trim() ||
    process.env.LEAD_RECOVERY_CERT_MODEL?.trim() ||
    process.env.DEEPSEEK_MODEL?.trim() ||
    "deepseek-chat"
  );
}

/** DeepSeek is the product semantic provider unless explicitly overridden. */
export function resolveMctbSemanticLlmProvider(): MctbSemanticLlmProvider {
  if (process.env.LR_CERT_FORCE_DEEPSEEK === "1" || process.env.LR_CERT_DISABLE_FALLBACK === "1") {
    return "deepseek";
  }
  const forced = process.env.MCTB_SEMANTIC_LLM_PROVIDER?.trim().toLowerCase();
  if (forced === "openai") return "openai";
  if (forced === "deepseek") return "deepseek";
  // Prefer OpenAI when both are configured — DeepSeek is opt-in (billing/outages).
  if (getOpenAiApiKey()) return "openai";
  if (process.env.DEEPSEEK_API_KEY?.trim()) return "deepseek";
  if (providers().length > 0) return providers()[0].id;
  return "openai";
}

export type MctbSemanticStructuredResult<T> = {
  data: T;
  provider: MctbSemanticLlmProvider;
  model: string;
  latencyMs: number;
  raw?: string;
};

async function deepSeekChat(input: {
  system: string;
  user: string;
  model: string;
  temperature: number;
  maxTokens: number;
}): Promise<{ raw: string; latencyMs: number }> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY required for semantic LLM");
  const baseUrl = (process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com").replace(
    /\/$/,
    "",
  );
  const timeoutMs = Math.max(
    5_000,
    Number(process.env.MCTB_SEMANTIC_LLM_TIMEOUT_MS || 28_000) || 28_000,
  );
  const started = Date.now();
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: input.model,
      temperature: input.temperature,
      max_tokens: input.maxTokens,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    }),
  });
  const latencyMs = Date.now() - started;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek semantic LLM ${res.status}: ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = json.choices?.[0]?.message?.content?.trim() || "";
  if (!raw) throw new Error("DeepSeek semantic LLM returned empty content");
  return { raw, latencyMs };
}

export async function mctbSemanticStructuredJson<T>(input: {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  provider?: MctbSemanticLlmProvider;
}): Promise<MctbSemanticStructuredResult<T> | null> {
  const temperature = input.temperature ?? 0.1;
  const maxTokens = input.maxTokens ?? 500;
  const preferred = input.provider?.trim() || resolveMctbSemanticLlmProvider();

  if (preferred === "deepseek" && process.env.DEEPSEEK_API_KEY?.trim()) {
    try {
      const model = input.model?.trim() || mctbSemanticModelId();
      const { raw, latencyMs } = await deepSeekChat({
        system: input.system,
        user: input.user,
        model,
        temperature,
        maxTokens,
      });
      const data = extractJsonFromLlm(raw) as T;
      return { data, provider: "deepseek", model, latencyMs, raw };
    } catch {
      // fall through to shared provider chain
    }
  }

  try {
    const started = Date.now();
    const hit = await llmChatCompletion(input.system, input.user, {
      temperature,
      maxTokens,
    });
    if (!hit?.content) return null;
    const data = extractJsonFromLlm(hit.content) as T;
    return {
      data,
      provider: hit.provider,
      model: hit.model,
      latencyMs: Date.now() - started,
      raw: hit.content,
    };
  } catch {
    return null;
  }
}
