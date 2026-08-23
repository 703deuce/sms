import { logProviderRun } from "@/lib/providers/dataforseo";

const BASE_URL = "https://api.deepseek.com/v1";

export type LocalTrustAiOutput = {
  summary: string;
  top_opportunities: string[];
  quick_wins: string[];
  tasks: Array<{
    title: string;
    description: string;
    priority: "low" | "medium" | "high";
    impact: "low" | "medium" | "high";
    effort: "low" | "medium" | "high";
    evidence: string;
  }>;
};

export async function generateLocalTrustAnalysis(params: {
  payload: Record<string, unknown>;
  organizationId?: string;
}): Promise<LocalTrustAiOutput | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const start = Date.now();

  const systemPrompt = `You are a local SEO strategist. Analyze local trust and sponsorship opportunities.
Do not invent websites. Use only the provided search results.
Prioritize opportunities that can create real local prominence, community trust, citations, or relevant backlinks.
Return JSON only with shape:
{"summary":"...","top_opportunities":["..."],"quick_wins":["..."],"tasks":[{"title":"...","description":"...","priority":"low|medium|high","impact":"low|medium|high","effort":"low|medium|high","evidence":"..."}]}`;

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
      endpoint: "local-trust",
      request: { model },
      response: data,
      statusCode: res.status,
      latencyMs,
    });

    if (!res.ok) return null;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as LocalTrustAiOutput;
  } catch {
    return null;
  }
}

export function fallbackLocalTrustTasks(
  opportunities: Array<{ title: string; priority: string; suggestedAction: string; url: string }>
): LocalTrustAiOutput {
  const top = opportunities.filter((o) => o.priority === "high").slice(0, 5);
  return {
    summary:
      top.length > 0
        ? `Found ${opportunities.length} local trust opportunities. Start with chamber listings and community sponsorship pages.`
        : "Review local directory and sponsorship opportunities to build community prominence.",
    top_opportunities: top.map((o) => o.title),
    quick_wins: opportunities.filter((o) => o.priority === "high" || o.priority === "medium").slice(0, 3).map((o) => o.title),
    tasks: top.map((o) => ({
      title: o.suggestedAction,
      description: o.title,
      priority: "high" as const,
      impact: "high" as const,
      effort: "medium" as const,
      evidence: o.url,
    })),
  };
}
