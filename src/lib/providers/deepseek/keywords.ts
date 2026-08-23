import { logProviderRun } from "@/lib/providers/dataforseo";

const BASE_URL = "https://api.deepseek.com/v1";

export type KeywordSuggestionAi = {
  keyword: string;
  intent_type: "service" | "city" | "problem" | "near_me" | "commercial";
  priority: "low" | "medium" | "high";
  reason: string;
  estimated_volume?: number | null;
};

export type KeywordSuggestAiOutput = {
  summary: string;
  groups: {
    service: KeywordSuggestionAi[];
    city: KeywordSuggestionAi[];
    problem: KeywordSuggestionAi[];
    near_me: KeywordSuggestionAi[];
    commercial: KeywordSuggestionAi[];
  };
};

export async function generateKeywordSuggestions(params: {
  payload: Record<string, unknown>;
  organizationId?: string;
}): Promise<KeywordSuggestAiOutput | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const start = Date.now();

  const systemPrompt = `You are a local SEO keyword strategist for Google Maps. Suggest realistic local keywords a business should track. Do not invent search volumes — omit estimated_volume unless provided in input. Return JSON only:
{"summary":"...","groups":{"service":[{"keyword":"...","intent_type":"service","priority":"low|medium|high","reason":"..."}],"city":[],"problem":[],"near_me":[],"commercial":[]}}
Each group should have 3-6 keywords. Keywords must be natural local search phrases.`;

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
          { role: "user", content: JSON.stringify(params.payload) },
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
      endpoint: "keyword-suggestions",
      request: { model },
      response: data,
      statusCode: res.status,
      latencyMs,
    });

    if (!res.ok) return null;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as KeywordSuggestAiOutput;
  } catch {
    return null;
  }
}

export function fallbackKeywordSuggestions(ctx: {
  category?: string | null;
  city?: string | null;
  primaryKeyword?: string | null;
}): KeywordSuggestAiOutput {
  const cat = ctx.category ?? "local service";
  const city = ctx.city ?? "your city";
  const base = ctx.primaryKeyword ?? cat;

  const mk = (keyword: string, intent_type: KeywordSuggestionAi["intent_type"], reason: string): KeywordSuggestionAi => ({
    keyword,
    intent_type,
    priority: "medium",
    reason,
  });

  return {
    summary: `Suggested keywords for ${cat} in ${city}.`,
    groups: {
      service: [
        mk(base, "service", "Core service term"),
        mk(`${cat} near me`, "service", "High-intent service search"),
        mk(`affordable ${base}`, "service", "Price-sensitive searchers"),
      ],
      city: [
        mk(`${base} ${city}`, "city", "City-modified local query"),
        mk(`${cat} ${city}`, "city", "Category + city"),
        mk(`best ${cat} ${city}`, "city", "Comparison intent in city"),
      ],
      problem: [
        mk(`emergency ${base}`, "problem", "Urgent need query"),
        mk(`same day ${cat}`, "problem", "Time-sensitive problem"),
      ],
      near_me: [mk(`${cat} near me`, "near_me", "Classic near-me Maps query"), mk(`local ${base}`, "near_me", "Local intent")],
      commercial: [
        mk(`${cat} cost`, "commercial", "Commercial research"),
        mk(`${cat} quotes`, "commercial", "Quote-seeking intent"),
      ],
    },
  };
}
