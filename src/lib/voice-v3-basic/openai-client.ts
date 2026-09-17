import OpenAI from "openai";

function resolveApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY is required for Voice V3 Basic");
  }
  return key;
}

let cached: OpenAI | null = null;

/** Shared OpenAI client for GPT-Live SIP accept + optional webhook unwrap. */
export function getVoiceV3BasicOpenAiClient(): OpenAI {
  if (cached) return cached;
  const webhookSecret = process.env.OPENAI_WEBHOOK_SECRET?.trim();
  cached = new OpenAI({
    apiKey: resolveApiKey(),
    webhookSecret: webhookSecret || undefined,
  });
  return cached;
}
