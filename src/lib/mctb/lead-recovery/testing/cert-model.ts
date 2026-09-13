/**
 * DeepSeek-only LLM for Lead Recovery production certification.
 * Fails visibly — no OpenAI fallback.
 */

import { extractJsonFromLlm } from "@/lib/ai/llm";
import { recordCertLlmUsage } from "@/lib/mctb/lead-recovery/testing/cert-metrics";

let loggedOpenAiWarning = false;

export type CertLlmResult<T> = {
  data: T;
  provider: "deepseek";
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  raw?: string;
};

export type DeepSeekCertConfig = {
  provider: "deepseek";
  model: string;
  baseUrl: string;
};

export function resolveDeepSeekCertConfig(): DeepSeekCertConfig {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("LR_CERT: DEEPSEEK_API_KEY is required (no fallback allowed)");
  }
  const model =
    process.env.LEAD_RECOVERY_CERT_MODEL?.trim() ||
    process.env.DEEPSEEK_FLASH_MODEL?.trim() ||
    process.env.DEEPSEEK_MODEL?.trim() ||
    process.env.AI_BOOKING_ROUTER_MODEL?.trim() ||
    "deepseek-chat";
  if (
    !loggedOpenAiWarning &&
    process.env.LR_CERT_DISABLE_FALLBACK === "1" &&
    process.env.OPENAI_API_KEY?.trim()
  ) {
    loggedOpenAiWarning = true;
    console.warn(
      "[lr-cert] OPENAI_API_KEY is set but LR_CERT_DISABLE_FALLBACK=1 — cert path will not use OpenAI",
    );
  }
  return {
    provider: "deepseek",
    model,
    baseUrl: (process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com").replace(
      /\/$/,
      "",
    ),
  };
}

export async function verifyDeepSeekAuth(): Promise<void> {
  const cfg = resolveDeepSeekCertConfig();
  const apiKey = process.env.DEEPSEEK_API_KEY!.trim();
  const started = Date.now();
  const res = await fetch(`${cfg.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 8,
      messages: [{ role: "user", content: "Reply with OK only." }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LR_CERT: DeepSeek auth/check failed ${res.status}: ${text.slice(0, 300)}`);
  }
  const latencyMs = Date.now() - started;
  console.info(`[lr-cert] DeepSeek OK model=${cfg.model} latencyMs=${latencyMs}`);
}

export async function deepSeekStructuredJson<T>(input: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<CertLlmResult<T>> {
  const cfg = resolveDeepSeekCertConfig();
  const apiKey = process.env.DEEPSEEK_API_KEY!.trim();
  const started = Date.now();
  const res = await fetch(`${cfg.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: input.temperature ?? 0.1,
      max_tokens: input.maxTokens ?? 500,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    }),
  });
  const latencyMs = Date.now() - started;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LR_CERT: DeepSeek ${res.status}: ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const raw = json.choices?.[0]?.message?.content?.trim() || "";
  if (!raw) throw new Error("LR_CERT: DeepSeek returned empty content");
  const parsed = extractJsonFromLlm(raw) as T;
  const usage = {
    inputTokens: json.usage?.prompt_tokens,
    outputTokens: json.usage?.completion_tokens,
  };
  recordCertLlmUsage(usage);
  return {
    data: parsed,
    provider: "deepseek",
    model: cfg.model,
    latencyMs,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    raw,
  };
}
