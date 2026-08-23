import { logProviderRun } from "@/lib/providers/dataforseo";
import type { SuggestedPrompt } from "@/lib/ai-visibility/types";
import { priorityToScore } from "@/lib/ai-visibility/limits";
import { buildPrimaryPrompt, fallbackSuggestedPrompts } from "@/lib/ai-visibility/prompts";

const BASE_URL = "https://api.deepseek.com/v1";

export type GeneratePromptsOutput = {
  primary_prompt: string;
  suggested_prompts: Array<{
    prompt: string;
    reason: string;
    category: string;
    intent_type?: string;
    estimated_priority: "High" | "Medium" | "Low";
  }>;
};

export async function generateAiVisibilityPrompts(params: {
  organizationId?: string;
  businessName: string;
  category: string | null;
  city: string;
  state: string;
  services?: string[];
  competitors?: string[];
  promptCount?: number;
}): Promise<{
  primaryPrompt: string;
  suggestedPrompts: SuggestedPrompt[];
}> {
  const primaryPrompt = buildPrimaryPrompt({
    category: params.category,
    city: params.city,
    state: params.state,
  });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  let suggested: SuggestedPrompt[] = [];

  if (apiKey) {
    const ai = await callDeepSeek(params);
    if (ai?.suggested_prompts?.length) {
      suggested = ai.suggested_prompts.map((s) => ({
        prompt: s.prompt,
        reason: s.reason,
        category: s.category,
        intent_type: s.intent_type ?? "service_specific",
        estimated_priority: s.estimated_priority,
        opportunity_score: priorityToScore(s.estimated_priority),
      }));
    }
  }

  if (!suggested.length) {
    suggested = fallbackSuggestedPrompts({
      category: params.category,
      city: params.city,
      state: params.state,
      services: params.services,
    }).map((s) => ({
      ...s,
      intent_type: s.intent_type,
    }));
  }

  const maxSuggestions = Math.max(0, (params.promptCount ?? 1) === 1 ? 12 : 0);
  return {
    primaryPrompt,
    suggestedPrompts: suggested.slice(0, maxSuggestions),
  };
}

async function callDeepSeek(
  params: {
    organizationId?: string;
    businessName: string;
    category: string | null;
    city: string;
    state: string;
    services?: string[];
    competitors?: string[];
  }
): Promise<GeneratePromptsOutput | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY!;
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const start = Date.now();

  const systemPrompt = `You are an AI visibility strategist. Generate ONE primary buyer prompt and suggested additional prompts for monitoring how AI engines recommend local businesses.
Return JSON only:
{"primary_prompt":"...","suggested_prompts":[{"prompt":"...","reason":"why it matters for AI monitoring","category":"Furniture Removal","intent_type":"service_specific","estimated_priority":"High|Medium|Low"}]}
Do NOT duplicate the primary prompt in suggestions. Generate 8-12 diverse suggested prompts covering: same-day/emergency, affordable, top-rated, service-specific (from GBP categories/services), neighborhood, comparison, near me, problem-based.
estimated_priority reflects commercial value for spending a limited prompt slot.`;

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: JSON.stringify({
              business: params.businessName,
              category: params.category,
              city: params.city,
              state: params.state,
              services: params.services ?? [],
              competitors: params.competitors?.slice(0, 5) ?? [],
            }),
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    const latencyMs = Date.now() - start;
    const data = await res.json();

    await logProviderRun({
      organizationId: params.organizationId,
      provider: "deepseek",
      endpoint: "ai-visibility-prompts",
      request: { model },
      response: data,
      statusCode: res.status,
      latencyMs,
    });

    if (!res.ok) return null;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as GeneratePromptsOutput;
  } catch {
    return null;
  }
}

export async function generateAiVisibilitySummary(params: {
  organizationId?: string;
  businessName: string;
  prompt: string;
  engineResults: Array<{
    engine: string;
    targetMentioned: boolean;
    mentionPosition: number | null;
    competitors: string[];
  }>;
}): Promise<string | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "Summarize AI visibility results in 2-3 sentences for a local business owner. Be factual based on provided engine results only.",
          },
          { role: "user", content: JSON.stringify(params) },
        ],
        temperature: 0.3,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}
