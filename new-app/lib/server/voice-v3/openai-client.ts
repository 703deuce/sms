import "server-only";

import OpenAI from "openai";

function resolveApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY is required for receptionist knowledge / Voice V3");
  }
  return key;
}

let cached: OpenAI | null = null;

export function getReceptionistOpenAiClient(): OpenAI {
  if (cached) return cached;
  const webhookSecret = process.env.OPENAI_WEBHOOK_SECRET?.trim();
  cached = new OpenAI({
    apiKey: resolveApiKey(),
    webhookSecret: webhookSecret || undefined,
  });
  return cached;
}
