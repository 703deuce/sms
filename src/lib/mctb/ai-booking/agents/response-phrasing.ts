import { aiBookingStructuredJson } from "@/lib/mctb/ai-booking/agents/json-llm";
import { RESPONSE_PHRASING_SYSTEM } from "@/lib/mctb/ai-booking/agents/prompts";
import { getAiBookingPhrasingModel } from "@/lib/mctb/ai-booking/agents/model-config";
import { openAiChatCompletion, getOpenAiApiKey } from "@/lib/ai/openai";

export async function phraseAiBookingSmsReply(input: {
  facts: Record<string, unknown>;
  fallbackText: string;
}): Promise<string> {
  if (!getOpenAiApiKey()) return input.fallbackText;

  const structured = await aiBookingStructuredJson<{ reply?: string }>({
    system: RESPONSE_PHRASING_SYSTEM,
    user: JSON.stringify({ facts: input.facts, required: "reply field with SMS text" }),
    model: getAiBookingPhrasingModel(),
    maxTokens: 120,
  });
  if (structured?.reply?.trim()) return structured.reply.trim();

  try {
    const raw = await openAiChatCompletion(RESPONSE_PHRASING_SYSTEM, JSON.stringify(input.facts), {
      model: getAiBookingPhrasingModel(),
      temperature: 0.2,
      maxTokens: 120,
    });
    return raw?.trim() || input.fallbackText;
  } catch {
    return input.fallbackText;
  }
}
