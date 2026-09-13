import { openAiChatCompletion, getOpenAiApiKey } from "@/lib/ai/openai";
import { extractJsonFromLlm } from "@/lib/ai/llm";

export async function aiBookingStructuredJson<T>(input: {
  system: string;
  user: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<T | null> {
  if (!getOpenAiApiKey()) return null;
  try {
    const raw = await openAiChatCompletion(input.system, input.user, {
      model: input.model,
      temperature: input.temperature ?? 0.1,
      maxTokens: input.maxTokens ?? 400,
    });
    if (!raw) return null;
    try {
      return extractJsonFromLlm(raw) as T;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}
