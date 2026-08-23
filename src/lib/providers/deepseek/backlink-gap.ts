import { logProviderRun } from "@/lib/providers/dataforseo";

const BASE_URL = "https://api.deepseek.com/v1";

export interface BacklinkGapAiOutput {
  summary: string;
  top_opportunities: string[];
  ignored_patterns: string[];
  tasks: Array<{
    title: string;
    description: string;
    priority: "low" | "medium" | "high";
    impact: "low" | "medium" | "high";
    effort: "low" | "medium" | "high";
    evidence: string;
    referring_domain?: string;
  }>;
}

export async function generateBacklinkGapAnalysis(params: {
  payload: Record<string, unknown>;
  organizationId?: string;
}): Promise<BacklinkGapAiOutput | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const start = Date.now();

  const systemPrompt = `You are a local SEO backlink strategist. Analyze backlink gap opportunities. Do not invent domains. Use only the provided backlink data. Prioritize links that are relevant, local, industry-specific, trustworthy, and realistically obtainable. Return JSON only with shape:
{"summary":"...","top_opportunities":["domain — reason"],"ignored_patterns":["pattern"],"tasks":[{"title":"...","description":"...","priority":"low|medium|high","impact":"low|medium|high","effort":"low|medium|high","evidence":"...","referring_domain":"example.com"}]}`;

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
      endpoint: "backlink-gap",
      request: { model },
      response: data,
      statusCode: res.status,
      latencyMs,
    });

    if (!res.ok) return null;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as BacklinkGapAiOutput;
  } catch {
    return null;
  }
}

export function fallbackBacklinkGapTasks(
  opportunities: Array<{ referring_domain: string; priority: string; suggested_action?: string | null }>
): BacklinkGapAiOutput {
  const high = opportunities.filter((o) => o.priority === "high").slice(0, 5);
  const tasks = high.map((o) => ({
    title: `Pursue backlink from ${o.referring_domain}`,
    description: o.suggested_action ?? `Competitors have a link from ${o.referring_domain}; investigate outreach.`,
    priority: "high" as const,
    impact: "high" as const,
    effort: "medium" as const,
    evidence: `Competitor backlink gap: ${o.referring_domain}`,
    referring_domain: o.referring_domain,
  }));

  return {
    summary: `${opportunities.length} competitor backlink opportunities found. Focus on high-priority local and industry domains first.`,
    top_opportunities: high.map((o) => o.referring_domain),
    ignored_patterns: [],
    tasks,
  };
}
